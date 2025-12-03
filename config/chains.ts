import { Chain, defineChain } from "viem";
import { abstractTestnet, megaethTestnet, monadTestnet, baseSepolia, sepolia } from "viem/chains";
import * as allChains from "viem/chains";

/**
 * Look up a chain by ID from viem's chain definitions
 */
export function getViemChainById(chainId: number): Chain | undefined {
  return Object.values(allChains).find(
    (chain): chain is Chain => 
      typeof chain === 'object' && 
      chain !== null && 
      'id' in chain && 
      chain.id === chainId
  );
}

/**
 * Chain feature flags and configuration
 */
export interface ChainConfig {
  id: string;
  chain: Chain;
  name: string;
  shortName: string;
  logo: string;
  blockExplorerUrl: string;
  faucetUrl?: string;
  // Feature flags
  supportsPaymaster: boolean;
  supportsSyncMode: boolean;
  isZkSync: boolean;
  /** Whether this chain requires a connected wallet (false = can use sponsored local account) */
  requiresWallet: boolean;
  // Branding
  accentColor: string;
}

/**
 * Supported chains configuration
 */
export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  abstract: {
    id: "abstract",
    chain: abstractTestnet,
    name: "Abstract Testnet",
    shortName: "Abstract",
    logo: "/abs.png",
    blockExplorerUrl: "https://sepolia.abscan.org",
    faucetUrl: "https://faucet.abs.xyz",
    supportsPaymaster: true,
    supportsSyncMode: true,
    isZkSync: true,
    requiresWallet: false, // Abstract can use sponsored local account
    accentColor: "#10b981", // emerald
  },
  monad: {
    id: "monad",
    chain: monadTestnet,
    name: "Monad Testnet",
    shortName: "Monad",
    logo: "/monad.png",
    blockExplorerUrl: "https://testnet.monadscan.com",
    faucetUrl: "https://faucet.monad.xyz",
    supportsPaymaster: false,
    supportsSyncMode: false,
    isZkSync: false,
    requiresWallet: true,
    accentColor: "#a855f7", // purple
  },
  megaeth: {
    id: "megaeth",
    chain: megaethTestnet,
    name: "MegaETH Testnet",
    shortName: "MegaETH",
    logo: "/megaeth.png",
    blockExplorerUrl: "https://megaexplorer.xyz",
    faucetUrl: "https://faucet.megaeth.xyz",
    supportsPaymaster: false,
    supportsSyncMode: false,
    isZkSync: false,
    requiresWallet: true,
    accentColor: "#f59e0b", // amber
  },
  baseSepolia: {
    id: "baseSepolia",
    chain: baseSepolia,
    name: "Base Sepolia",
    shortName: "Base",
    logo: "/base.svg",
    blockExplorerUrl: "https://sepolia.basescan.org",
    faucetUrl: "https://www.alchemy.com/faucets/base-sepolia",
    supportsPaymaster: false,
    supportsSyncMode: false,
    isZkSync: false,
    requiresWallet: true,
    accentColor: "#0052FF", // Base blue
  },
  sepolia: {
    id: "sepolia",
    chain: sepolia,
    name: "Ethereum Sepolia",
    shortName: "Sepolia",
    logo: "/eth.svg",
    blockExplorerUrl: "https://sepolia.etherscan.io",
    faucetUrl: "https://www.alchemy.com/faucets/ethereum-sepolia",
    supportsPaymaster: false,
    supportsSyncMode: false,
    isZkSync: false,
    requiresWallet: true,
    accentColor: "#627EEA", // Ethereum blue
  },
} as const;

/**
 * Custom chain ID for user-provided RPC
 */
export const CUSTOM_CHAIN_ID = "custom";

/**
 * Create a custom chain config from RPC URL and detected chain ID
 * Attempts to look up chain info from viem's chain definitions for proper naming
 */
export function createCustomChainConfig(
  rpcUrl: string,
  chainId: number
): ChainConfig {
  // Try to find the chain in viem's definitions
  const knownChain = getViemChainById(chainId);
  
  const chainName = knownChain?.name || `Custom Chain (${chainId})`;
  const nativeCurrency = knownChain?.nativeCurrency || {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  };
  const blockExplorer = knownChain?.blockExplorers?.default?.url || "";
  
  // Create the chain with the custom RPC but use known chain info if available
  const customChain = defineChain({
    id: chainId,
    name: chainName,
    nativeCurrency,
    rpcUrls: {
      default: {
        http: [rpcUrl],
      },
    },
    blockExplorers: knownChain?.blockExplorers,
  });

  return {
    id: CUSTOM_CHAIN_ID,
    chain: customChain,
    name: chainName,
    shortName: knownChain ? chainName.split(' ')[0] : "Custom", // First word of name or "Custom"
    logo: "/custom-chain.svg",
    blockExplorerUrl: blockExplorer,
    supportsPaymaster: false,
    supportsSyncMode: false,
    isZkSync: false,
    requiresWallet: true,
    accentColor: "#6366f1", // indigo
  };
}

/**
 * Get chain metadata for adding to wallet (wallet_addEthereumChain)
 */
export function getChainMetadataForWallet(rpcUrl: string, chainId: number) {
  const knownChain = getViemChainById(chainId);
  
  return {
    chainId: `0x${chainId.toString(16)}`,
    chainName: knownChain?.name || `Custom Chain (${chainId})`,
    nativeCurrency: knownChain?.nativeCurrency || {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [rpcUrl],
    blockExplorerUrls: knownChain?.blockExplorers?.default?.url 
      ? [knownChain.blockExplorers.default.url] 
      : undefined,
  };
}

/**
 * Default chain ID
 */
export const DEFAULT_CHAIN_ID = "abstract";

/**
 * Get chain config by ID
 */
export function getChainConfig(chainId: string): ChainConfig {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unknown chain: ${chainId}`);
  }
  return config;
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): string[] {
  return Object.keys(CHAIN_CONFIGS);
}
