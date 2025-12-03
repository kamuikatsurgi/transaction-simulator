"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { Chain } from "viem";
import * as allChains from "viem/chains";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Info, ChevronDown, Loader2, Globe, Search } from "lucide-react";
import { ChainConfig, CHAIN_CONFIGS, getSupportedChainIds, CUSTOM_CHAIN_ID, createCustomChainConfig, getChainMetadataForWallet } from "@/config/chains";

// Extract all chains from viem for search
const viemChains: Chain[] = (Object.values(allChains) as unknown[]).filter(
  (chain): chain is Chain =>
    typeof chain === "object" &&
    chain !== null &&
    "id" in chain &&
    "name" in chain &&
    typeof chain.id === "number"
);

export interface TransactionOptions {
  nonce: boolean;
  gasParams: boolean;
  chainId: boolean;
  syncMode: boolean;
}

interface SettingsControlPanelProps {
  options: TransactionOptions;
  onChange: (options: TransactionOptions) => void;
  disabled?: boolean;
  chainConfig: ChainConfig;
  selectedChainId: string;
  onChainChange: (chainId: string, customConfig?: ChainConfig) => Promise<void> | void;
  isWalletConnected: boolean;
  walletAddress?: `0x${string}`;
  onConnectWallet: () => void;
  onManageWallet: () => void;
  // Transaction button props
  onSendTransaction: () => void;
  canSendTransaction: boolean;
  buttonText: string;
  isLoading: boolean;
}

export function SettingsControlPanel({ 
  options, 
  onChange, 
  disabled = false,
  chainConfig,
  selectedChainId,
  onChainChange,
  isWalletConnected,
  walletAddress,
  onConnectWallet,
  onManageWallet,
  onSendTransaction,
  canSendTransaction,
  buttonText,
  isLoading,
}: SettingsControlPanelProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chainIds = getSupportedChainIds();
  
  // Filter viem chains based on search, excluding our featured chains
  const featuredChainIds = new Set(Object.values(CHAIN_CONFIGS).map(c => c.chain.id));
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return viemChains
      .filter(chain => 
        !featuredChainIds.has(chain.id) && // Exclude featured chains
        (chain.name.toLowerCase().includes(query) ||
         chain.id.toString().includes(query) ||
         chain.nativeCurrency?.symbol?.toLowerCase().includes(query))
      )
      .slice(0, 10); // Limit results
  }, [searchQuery]);

  const handleToggle = (key: keyof TransactionOptions) => {
    onChange({ ...options, [key]: !options[key] });
  };

  const syncModeDisabled = disabled || !chainConfig.supportsSyncMode;
  const isCustomChain = selectedChainId === CUSTOM_CHAIN_ID;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setSearchQuery(""); // Clear search on close
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [isSwitchingChain, setIsSwitchingChain] = useState(false);

  const handleChainSelect = async (chainId: string) => {
    setIsDropdownOpen(false);
    setSearchQuery(""); // Clear search
    
    if (chainId === CUSTOM_CHAIN_ID) {
      onChainChange(chainId);
    } else {
      // If connected, this will trigger a chain switch in the wallet
      if (isWalletConnected) {
        setIsSwitchingChain(true);
      }
      try {
        await onChainChange(chainId);
      } finally {
        setIsSwitchingChain(false);
      }
    }
  };

  // Handle selection from the chain search
  const handleSearchChainSelect = async (chain: Chain) => {
    setIsDropdownOpen(false);
    setSearchQuery(""); // Clear search
    setIsSwitchingChain(true);
    
    try {
      // Get the default RPC URL from the chain
      const rpcUrl = chain.rpcUrls.default.http[0];
      
      // Create a custom chain config using viem's chain info
      const customConfig = createCustomChainConfig(rpcUrl, chain.id);
      
      // If wallet is connected, add the network and switch to it
      if (isWalletConnected && typeof window !== 'undefined' && window.ethereum) {
        try {
          const chainMetadata = getChainMetadataForWallet(rpcUrl, chain.id);
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [chainMetadata],
          });
        } catch (addError: any) {
          if (addError.code === 4001) {
            throw new Error("User rejected adding the network");
          }
          // Chain might already exist, continue anyway
          console.log("Chain might already exist, continuing...", addError);
        }
      }
      
      await onChainChange(CUSTOM_CHAIN_ID, customConfig);
    } catch (error) {
      console.error("Failed to switch chain:", error);
    } finally {
      setIsSwitchingChain(false);
    }
  };

  // Check if the chain requires wallet connection
  const chainRequiresWallet = chainConfig.requiresWallet && !isWalletConnected;

  return (
    <div className="w-full bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl">
      <div className="p-5 space-y-6">
        
        {/* Header: Network & Send Button */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Left: Network Selector */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => !disabled && !isSwitchingChain && setIsDropdownOpen(!isDropdownOpen)}
                  disabled={disabled || isSwitchingChain}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg border transition-all min-w-[200px]
                    ${disabled || isSwitchingChain ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-zinc-600'}
                    bg-zinc-800 border-zinc-700
                  `}
                >
                  {isSwitchingChain ? (
                    <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                  ) : isCustomChain ? (
                    <Globe className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <Image
                      src={chainConfig.logo}
                      alt={chainConfig.name}
                      width={20}
                      height={20}
                      className="object-contain"
                    />
                  )}
                  <span className="text-sm font-medium text-white flex-1 text-left">
                    {isSwitchingChain ? "Switching..." : chainConfig.shortName}
                  </span>
                  {!isSwitchingChain && (
                    <ChevronDown 
                      className={`w-4 h-4 text-zinc-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
                    />
                  )}
                </button>

                {/* Dropdown menu */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full min-w-[280px] bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-20 overflow-hidden">
                    {/* Featured Chains */}
                    <div className="py-1">
                      {chainIds.map((chainId) => {
                        const config = CHAIN_CONFIGS[chainId];
                        const isSelected = chainId === selectedChainId && !isCustomChain;
                        const needsWallet = config.requiresWallet && !isWalletConnected;
                        
                        return (
                          <button
                            key={chainId}
                            onClick={() => handleChainSelect(chainId)}
                            disabled={needsWallet}
                            className={`
                              w-full flex items-center gap-2 px-3 py-2 transition-colors text-left
                              ${isSelected 
                                ? 'bg-zinc-700' 
                                : needsWallet
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:bg-zinc-700/50'
                              }
                            `}
                          >
                            <Image
                              src={config.logo}
                              alt={config.name}
                              width={18}
                              height={18}
                              className="object-contain"
                            />
                            <span className={`text-sm flex-1 ${isSelected ? 'text-white font-medium' : 'text-zinc-300'}`}>
                              {config.shortName}
                            </span>
                            {needsWallet && (
                              <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                                Connect
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    
                    {/* Search Section - only show when connected */}
                    {isWalletConnected && (
                      <>
                        <div className="border-t border-zinc-700 px-2 py-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                            <input
                              ref={searchInputRef}
                              type="text"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              placeholder="Search 500+ chains..."
                              className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        
                        {/* Search Results */}
                        {searchResults.length > 0 && (
                          <div className="border-t border-zinc-700 py-1 max-h-[200px] overflow-y-auto">
                            {searchResults.map((chain) => {
                              const isTestnet = chain.testnet === true || 
                                chain.name.toLowerCase().includes('testnet') || 
                                chain.name.toLowerCase().includes('sepolia');
                              
                              return (
                                <button
                                  key={chain.id}
                                  onClick={() => handleSearchChainSelect(chain)}
                                  className="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left hover:bg-zinc-700/50"
                                >
                                  <Globe className="w-[18px] h-[18px] text-indigo-400 shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-zinc-300 truncate">{chain.name}</span>
                                      {isTestnet && (
                                        <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 shrink-0">
                                          Testnet
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-zinc-500">
                                      ID: {chain.id} • {chain.nativeCurrency?.symbol || 'ETH'}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        
                        {/* No results message */}
                        {searchQuery && searchResults.length === 0 && (
                          <div className="border-t border-zinc-700 px-3 py-3 text-center">
                            <span className="text-xs text-zinc-500">No chains found for "{searchQuery}"</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Send Button (Moved here) */}
          <div className="shrink-0 flex flex-col gap-2 items-start md:items-end">
             <button
                onClick={() => {
                    if (!isWalletConnected && chainRequiresWallet) {
                        onConnectWallet();
                    } else {
                        onSendTransaction();
                    }
                }}
                disabled={(!canSendTransaction && !chainRequiresWallet) || isLoading}
                className={`
                  px-6 py-2 rounded-lg font-semibold text-base transition-all
                  flex items-center justify-center gap-2
                  ${(canSendTransaction || chainRequiresWallet) && !isLoading
                    ? 'bg-white text-zinc-900 hover:bg-zinc-200 shadow-lg shadow-white/5' 
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }
                `}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {buttonText}
              </button>
          </div>
        </div>

        {/* Toggles (Disconnected Only) */}
        {!isWalletConnected && (
          <div className="p-4 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sync-toggle" className={`text-xs cursor-pointer ${syncModeDisabled ? 'text-zinc-600' : 'text-zinc-400'}`}>
                  Sync Mode
                </Label>
                <Switch 
                  id="sync-toggle"
                  checked={options.syncMode}
                  onCheckedChange={() => handleToggle("syncMode")}
                  disabled={syncModeDisabled}
                />
              </div>
              
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="nonce-toggle" className="text-xs text-zinc-400 cursor-pointer">Nonce</Label>
                <Switch 
                  id="nonce-toggle"
                  checked={options.nonce}
                  onCheckedChange={() => handleToggle("nonce")}
                  disabled={disabled}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="gas-toggle" className="text-xs text-zinc-400 cursor-pointer">Gas Params</Label>
                <Switch 
                  id="gas-toggle"
                  checked={options.gasParams}
                  onCheckedChange={() => handleToggle("gasParams")}
                  disabled={disabled}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="chain-toggle" className="text-xs text-zinc-400 cursor-pointer">Chain ID</Label>
                <Switch 
                  id="chain-toggle"
                  checked={options.chainId}
                  onCheckedChange={() => handleToggle("chainId")}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        )}
        
        {!isWalletConnected && !chainRequiresWallet && (
            <p className="text-center text-xs text-zinc-500">
              <span className="text-emerald-400">Free Sponsored Mode</span> • No wallet needed on Abstract
            </p>
        )}
      </div>
    </div>
  );
}
