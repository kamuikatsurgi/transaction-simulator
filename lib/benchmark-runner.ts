import { zeroAddress, WalletClient } from "viem";
import { Account } from "viem/accounts";
import { paymasterConfig } from "@/config/paymaster-config";
import { ChainConfig } from "@/config/chains";
import { BenchmarkResult } from "@/types/benchmark";
import { RPCCallLog } from "@/lib/instrumented-transport";
import { TransactionClientsWithAccount, TransactionParams } from "@/types/client-types";
import { BenchmarkPublicClient } from "./benchmark-clients";

/**
 * Configuration for transaction parameters
 */
export interface TransactionOptions {
  /** Whether to pre-fetch the nonce */
  nonce: boolean;
  /** Whether to pre-fetch gas parameters (maxFeePerGas, maxPriorityFeePerGas, gas) */
  gasParams: boolean;
  /** Whether to pre-fetch the chain ID */
  chainId: boolean;
  /** Whether to use sync mode (eth_sendRawTransactionSync) */
  syncMode: boolean;
}

/**
 * Pre-fetched gas parameters for transactions
 */
export interface PrefetchedGas {
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  gas: bigint;
}

/**
 * Runs a transaction with a local account (Abstract sponsored mode)
 */
export async function runTransaction(
  clients: TransactionClientsWithAccount,
  chainConfig: ChainConfig,
  nonce: number,
  rpcCalls: RPCCallLog[],
  options: TransactionOptions,
  prefetchedGas: PrefetchedGas | null = null
): Promise<BenchmarkResult> {
  const startTime = Date.now();
  const modeLabel = options.syncMode ? "SYNC" : "ASYNC";
  console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Transaction started at:`, startTime);
  
  try {
    const paramsStartTime = Date.now();
    const txParams: TransactionParams = {
      to: zeroAddress,
      value: BigInt(0),
    };

    // Only add paymaster config for zkSync-family chains
    if (chainConfig.supportsPaymaster) {
      txParams.paymaster = paymasterConfig.paymaster;
      txParams.paymasterInput = paymasterConfig.paymasterInput;
    }

    // Add pre-fetched nonce if enabled
    if (options.nonce) {
      txParams.nonce = nonce;
    }

    // Add pre-fetched gas parameters if enabled
    if (options.gasParams && prefetchedGas) {
      txParams.maxFeePerGas = prefetchedGas.maxFeePerGas;
      txParams.maxPriorityFeePerGas = prefetchedGas.maxPriorityFeePerGas;
      txParams.gas = prefetchedGas.gas;
    }
    const paramsEndTime = Date.now();
    console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Params prepared in:`, paramsEndTime - paramsStartTime, "ms");

    let hash: string;

    if (options.syncMode && chainConfig.supportsSyncMode) {
      // SYNC MODE: Use eth_sendRawTransactionSync (zkSync-family only)
      const prepareStartTime = Date.now();
      const request = await clients.walletClient.prepareTransactionRequest(txParams);
      const prepareEndTime = Date.now();
      console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] prepareTransactionRequest completed in:`, prepareEndTime - prepareStartTime, "ms");

      const signStartTime = Date.now();
      const serializedTransaction = await clients.walletClient.signTransaction(request);
      const signEndTime = Date.now();
      console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Transaction signed in:`, signEndTime - signStartTime, "ms");
      
      const sendStartTime = Date.now();
      const receipt = await clients.publicClient.sendRawTransactionSync({
        serializedTransaction,
      });
      const sendEndTime = Date.now();
      console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] sendRawTransactionSync completed in:`, sendEndTime - sendStartTime, "ms");
      console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Transaction hash:`, receipt.transactionHash);

      hash = receipt.transactionHash;
    } else {
      // ASYNC MODE: Use sendTransaction + waitForTransactionReceipt
      // When all params are prefetched, skip prepareTransactionRequest to avoid re-estimation
      if (options.nonce && options.gasParams && options.chainId && prefetchedGas) {
        const requestStartTime = Date.now();
        // Add account and chain directly since we're skipping prepare
        const requestToSign = {
          ...txParams,
          from: clients.account.address,
          chainId: chainConfig.chain.id,
        };
        const requestEndTime = Date.now();
        console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Request prepared in:`, requestEndTime - requestStartTime, "ms");
        
        const signStartTime = Date.now();
        const serializedTransaction = await clients.walletClient.signTransaction(requestToSign);
        const signEndTime = Date.now();
        console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Transaction signed in:`, signEndTime - signStartTime, "ms");
        
        const sendStartTime = Date.now();
        hash = await clients.publicClient.sendRawTransaction({ serializedTransaction });
        const sendEndTime = Date.now();
        console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] sendRawTransaction completed in:`, sendEndTime - sendStartTime, "ms");
        console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Transaction hash:`, hash);
      } else {
        // Use normal flow when some params aren't prefetched
        const sendTxStartTime = Date.now();
        hash = await clients.walletClient.sendTransaction(txParams);
        const sendTxEndTime = Date.now();
        console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] sendTransaction completed in:`, sendTxEndTime - sendTxStartTime, "ms");
        console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Transaction hash:`, hash);
      }

      const waitStartTime = Date.now();
      await clients.publicClient.waitForTransactionReceipt({ hash });
      const waitEndTime = Date.now();
      console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] waitForTransactionReceipt completed in:`, waitEndTime - waitStartTime, "ms");
    }

    const endTime = Date.now();
    console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Total transaction time:`, endTime - startTime, "ms");

    return {
      startTime,
      endTime,
      duration: endTime - startTime,
      txHash: hash,
      status: "success",
      rpcCalls,
      syncMode: options.syncMode,
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      startTime,
      endTime,
      duration: endTime - startTime,
      txHash: "",
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      rpcCalls,
      syncMode: options.syncMode,
    };
  }
}

/**
 * Connected wallet transaction context
 */
export interface ConnectedWalletContext {
  walletClient: WalletClient;
  publicClient: BenchmarkPublicClient;
  address: `0x${string}`;
}

/**
 * Callback to notify when user has confirmed the transaction in their wallet
 */
export type OnTransactionSubmitted = (startTime: number) => void;

/**
 * Runs a transaction with a connected wallet (user signs via wallet popup)
 * 
 * Note: Most wallets (MetaMask, etc.) don't support eth_signTransaction separately.
 * They only support eth_sendTransaction which signs AND sends atomically.
 * 
 * This means we can't capture eth_sendRawTransaction timing - the wallet handles
 * the send internally. We CAN capture:
 * - eth_getTransactionReceipt (polling for confirmation)
 * 
 * The timer starts AFTER the wallet returns the tx hash (user confirmed + sent).
 */
export async function runConnectedWalletTransaction(
  context: ConnectedWalletContext,
  chainConfig: ChainConfig,
  nonce: number,
  rpcCalls: RPCCallLog[],
  options: TransactionOptions,
  prefetchedGas: PrefetchedGas | null = null,
  onTransactionSubmitted?: OnTransactionSubmitted
): Promise<BenchmarkResult> {
  const modeLabel = "CONNECTED";
  
  try {
    // Build transaction params - send to self instead of zero address
    // This avoids MetaMask's "burn address" warning
    const txParams: any = {
      to: context.address, // Self-transfer
      value: BigInt(0),
      account: context.address,
      chain: chainConfig.chain,
    };

    // Add pre-fetched nonce if enabled
    if (options.nonce) {
      txParams.nonce = nonce;
    }

    // Add pre-fetched gas parameters if enabled
    if (options.gasParams && prefetchedGas) {
      txParams.maxFeePerGas = prefetchedGas.maxFeePerGas;
      txParams.maxPriorityFeePerGas = prefetchedGas.maxPriorityFeePerGas;
      txParams.gas = prefetchedGas.gas;
    }

    // Send transaction via connected wallet
    // The wallet will prompt the user to confirm, sign, AND send
    // We DON'T start timing until AFTER this returns (tx is in mempool)
    console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Waiting for user to confirm in wallet...`);
    const hash = await context.walletClient.sendTransaction(txParams);
    
    // NOW start the timer - transaction has been sent to the network
    const startTime = Date.now();
    console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Transaction sent! Timer started at:`, startTime);
    console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Transaction hash:`, hash);
    
    // Notify that transaction was submitted (for UI to start timer)
    if (onTransactionSubmitted) {
      onTransactionSubmitted(startTime);
    }

    // Wait for receipt through our instrumented client
    // This captures eth_getTransactionReceipt timing (the confirmation latency)
    const waitStartTime = Date.now();
    await context.publicClient.waitForTransactionReceipt({ hash });
    const waitEndTime = Date.now();
    console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] waitForTransactionReceipt completed in:`, waitEndTime - waitStartTime, "ms");

    const endTime = Date.now();
    console.log(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Total confirmation time:`, endTime - startTime, "ms");

    return {
      startTime,
      endTime,
      duration: endTime - startTime,
      txHash: hash,
      status: "success",
      rpcCalls,
      syncMode: false, // Connected wallet mode doesn't support sync
    };
  } catch (error) {
    const endTime = Date.now();
    console.error(`⏱️  [${chainConfig.shortName}] [${modeLabel}] Transaction failed:`, error);
    return {
      startTime: endTime, // If we never started, use end time
      endTime,
      duration: 0,
      txHash: "",
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      rpcCalls,
      syncMode: false,
    };
  }
}
