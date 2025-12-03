"use client";

import { useState, useRef, useEffect } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { RPCCallLog } from "@/lib/instrumented-transport";
import { createBenchmarkClients, createInstrumentedPublicClient, createSetupPublicClient } from "@/lib/benchmark-clients";
import { runTransaction, runConnectedWalletTransaction, TransactionOptions, ConnectedWalletContext } from "@/lib/benchmark-runner";
import { BenchmarkResult } from "@/types/benchmark";
import { PartialResult } from "@/types/partial-result";
import { ResultCard } from "./ResultCard";
import { SettingsControlPanel } from "./PrefetchControlPanel";
import { APP_CONFIG } from "@/constants/app-config";
import { DEFAULT_CHAIN_ID, getChainConfig, ChainConfig, CUSTOM_CHAIN_ID } from "@/config/chains";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function TransactionBenchmark() {
  const [selectedChainId, setSelectedChainId] = useState(DEFAULT_CHAIN_ID);
  const [customChainConfig, setCustomChainConfig] = useState<ChainConfig | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isWaitingForWallet, setIsWaitingForWallet] = useState(false);
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [partialResult, setPartialResult] = useState<PartialResult | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [options, setOptions] = useState<TransactionOptions>({
    nonce: false,
    gasParams: false,
    chainId: false,
    syncMode: false,
  });
  
  const timerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  
  // Wagmi hooks for wallet connection
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  
  // Get the appropriate chain config
  const chainConfig = selectedChainId === CUSTOM_CHAIN_ID && customChainConfig 
    ? customChainConfig 
    : getChainConfig(selectedChainId === CUSTOM_CHAIN_ID ? DEFAULT_CHAIN_ID : selectedChainId);

  // Reset sync mode when switching to a chain that doesn't support it
  useEffect(() => {
    if (!chainConfig.supportsSyncMode && options.syncMode) {
      setOptions(prev => ({ ...prev, syncMode: false }));
    }
  }, [selectedChainId, chainConfig.supportsSyncMode, options.syncMode]);

  // Clear results when switching chains, and switch wallet chain if connected
  const handleChainChange = async (chainId: string, customConfig?: ChainConfig) => {
    setSelectedChainId(chainId);
    if (customConfig) {
      setCustomChainConfig(customConfig);
    } else if (chainId !== CUSTOM_CHAIN_ID) {
      setCustomChainConfig(null);
    }
    setResult(null);
    setPartialResult(null);
    setElapsedTime(0);
    
    // If wallet is connected, switch to the new chain
    if (isConnected) {
      if (chainId === CUSTOM_CHAIN_ID && customConfig) {
        // For custom chains, the network was already added in PrefetchControlPanel
        // Just try to switch to it
        try {
          await switchChainAsync({ chainId: customConfig.chain.id });
        } catch (error) {
          // User might reject the switch, that's okay
          console.log("Chain switch cancelled or failed:", error);
        }
      } else if (chainId !== CUSTOM_CHAIN_ID) {
        // For known chains, switch normally
        const targetChain = getChainConfig(chainId).chain;
        try {
          await switchChainAsync({ chainId: targetChain.id });
        } catch (error) {
          // User might reject the switch, that's okay
          console.log("Chain switch cancelled or failed:", error);
        }
      }
    }
  };

  // Determine if we can run a transaction
  const canRunTransaction = isConnected || !chainConfig.requiresWallet;
  
  // Use connected wallet mode when wallet is connected
  // Use local account mode (Abstract sponsored) when disconnected on Abstract
  const useConnectedWalletMode = isConnected;

  const runBenchmark = async () => {
    if (!canRunTransaction) return;
    
    setIsPreparing(true);
    setIsRunning(false);
    setResult(null);
    setElapsedTime(0);

    // Create RPC call log array
    const rpcCalls: RPCCallLog[] = [];

    if (useConnectedWalletMode && walletClient && address) {
      // ========== CONNECTED WALLET MODE ==========
      // Simple flow: wallet handles everything, we just measure confirmation time
      // No pre-fetch toggles apply here - the wallet handles gas/nonce internally
      
      // Create instrumented public client for monitoring confirmation RPC calls
      const publicClient = createInstrumentedPublicClient(
        chainConfig,
        (log) => {
          const pendingIndex = rpcCalls.findIndex(
            call => call.method === log.method && call.isPending && call.startTime === log.startTime
          );
          if (pendingIndex >= 0) {
            rpcCalls[pendingIndex] = { ...log, isPending: false };
          } else {
            rpcCalls.push({ ...log, isPending: false });
          }
          setPartialResult(prev => prev ? { ...prev, rpcCalls: [...rpcCalls] } : null);
        },
        (log) => {
          rpcCalls.push({ ...log, endTime: 0, duration: 0, isPending: true });
          setPartialResult(prev => prev ? { ...prev, rpcCalls: [...rpcCalls] } : null);
        }
      );

      // Show "waiting for wallet" state immediately
      setIsPreparing(false);
      setIsWaitingForWallet(true);

      // Create context for connected wallet transaction
      const context: ConnectedWalletContext = {
        walletClient,
        publicClient,
        address,
      };

      // Run the transaction - timer starts AFTER user confirms in wallet
      const txResult = await runConnectedWalletTransaction(
        context,
        chainConfig,
        0, // nonce handled by wallet
        rpcCalls,
        options,
        null, // gas handled by wallet
        // Callback when user confirms in wallet - NOW start the timer
        (startTime: number) => {
          startTimeRef.current = startTime;
          setIsWaitingForWallet(false);
          setIsRunning(true);
          
          setPartialResult({
            startTime,
            rpcCalls: [],
            isComplete: false,
            syncMode: false,
          });

          timerRef.current = setInterval(() => {
            setElapsedTime(Date.now() - startTimeRef.current);
          }, APP_CONFIG.TIMER_UPDATE_INTERVAL);
        }
      );

      // Stop timer and set final result
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedTime(txResult.duration);
      setPartialResult(null);
      setResult(txResult);
      setIsRunning(false);
      setIsWaitingForWallet(false);
      
    } else {
      // ========== LOCAL ACCOUNT MODE (Abstract Sponsored) ==========
      // Generate a fresh wallet and use paymaster for gas sponsorship
      
      const account = privateKeyToAccount(generatePrivateKey());

      // Pre-fetch gas parameters if enabled
      let prefetchedGas = null;
      if (options.gasParams) {
        const prefetchClients = createBenchmarkClients(
          account,
          chainConfig,
          () => {},
          undefined,
          options.chainId
        );
        
        const [block, maxPriorityFee, gasEstimate] = await Promise.all([
          prefetchClients.publicClient.getBlock({ blockTag: 'latest' }),
          prefetchClients.publicClient.request({ method: 'eth_maxPriorityFeePerGas' }),
          prefetchClients.publicClient.estimateGas({
            account: account.address,
            to: "0x0000000000000000000000000000000000000000",
            value: BigInt(0),
          }),
        ]);
        
        prefetchedGas = {
          maxFeePerGas: block.baseFeePerGas ? block.baseFeePerGas + BigInt(maxPriorityFee as string) : BigInt(maxPriorityFee as string),
          maxPriorityFeePerGas: BigInt(maxPriorityFee as string),
          gas: gasEstimate,
        };
      }

      // Create clients for the transaction
      const clients = createBenchmarkClients(
        account,
        chainConfig,
        (log) => {
          const pendingIndex = rpcCalls.findIndex(
            call => call.method === log.method && call.isPending && call.startTime === log.startTime
          );
          if (pendingIndex >= 0) {
            rpcCalls[pendingIndex] = { ...log, isPending: false };
          } else {
            rpcCalls.push({ ...log, isPending: false });
          }
          setPartialResult(prev => prev ? { ...prev, rpcCalls: [...rpcCalls] } : null);
        },
        (log) => {
          rpcCalls.push({ ...log, endTime: 0, duration: 0, isPending: true });
          setPartialResult(prev => prev ? { ...prev, rpcCalls: [...rpcCalls] } : null);
        },
        options.chainId
      );

      // For sponsored transactions with fresh wallet, we can use nonce 0
      // since it's a brand new account
      let nonce = 0;
      if (!options.nonce) {
        // Fetch nonce from network if not pre-fetching
        const tempClient = createBenchmarkClients(
          account,
          chainConfig,
          () => {},
          undefined,
          options.chainId
        );
        nonce = await tempClient.publicClient.getTransactionCount({
          address: account.address,
        });
      }

      // Start the timer
      const startTime = Date.now();
      setIsPreparing(false);
      setIsRunning(true);

      setPartialResult({
        startTime,
        rpcCalls: [],
        isComplete: false,
        syncMode: options.syncMode,
      });

      timerRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, APP_CONFIG.TIMER_UPDATE_INTERVAL);

      // Run the transaction
      const txResult = await runTransaction(
        { ...clients, account },
        chainConfig,
        nonce,
        rpcCalls,
        options,
        prefetchedGas
      );

      // Stop timer and set final result
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedTime(txResult.duration);
      setPartialResult(null);
      setResult(txResult);
      setIsRunning(false);
    }
  };

  // Determine button state
  const buttonDisabled = isRunning || isPreparing || isWaitingForWallet || !canRunTransaction;
  const buttonText = isPreparing 
    ? "Preparing..." 
    : isWaitingForWallet
      ? "Confirm in Wallet..."
      : isRunning 
        ? "Sending Transaction..." 
        : !canRunTransaction
          ? "Connect Wallet to Continue"
          : "Send Transaction";

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      <div className="flex flex-col items-center gap-6">
        <ConnectButton.Custom>
          {({ openConnectModal, openAccountModal }) => (
            <SettingsControlPanel
              options={options}
              onChange={setOptions}
              disabled={isRunning || isPreparing}
              chainConfig={chainConfig}
              selectedChainId={selectedChainId}
              onChainChange={handleChainChange}
              isWalletConnected={isConnected}
              walletAddress={address}
              onConnectWallet={openConnectModal}
              onManageWallet={openAccountModal}
              onSendTransaction={runBenchmark}
              canSendTransaction={canRunTransaction}
              buttonText={buttonText}
              isLoading={isRunning || isPreparing || isWaitingForWallet}
            />
          )}
        </ConnectButton.Custom>
        
        <ResultCard 
          result={result} 
          isRunning={isRunning}
          isPreparing={isPreparing}
          isWaitingForWallet={isWaitingForWallet}
          isConnectedWallet={useConnectedWalletMode}
          syncMode={options.syncMode}
          partialResult={partialResult}
          elapsedTime={elapsedTime}
          chainConfig={chainConfig}
        />
      </div>
    </div>
  );
}
