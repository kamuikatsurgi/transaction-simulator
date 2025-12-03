import { createWalletClient, createPublicClient, PublicClient, WalletClient, Transport, Chain, http } from "viem";
import { Account } from "viem/accounts";
import { eip712WalletActions, publicActionsL2 } from "viem/zksync";
import { createInstrumentedTransport, RPCCallLog } from "@/lib/instrumented-transport";
import { ChainConfig } from "@/config/chains";

/**
 * Extended wallet client type that may include zkSync extensions
 */
export type BenchmarkWalletClient = WalletClient & ReturnType<typeof eip712WalletActions>;

/**
 * Extended public client type that may include zkSync extensions
 */
export type BenchmarkPublicClient = PublicClient & ReturnType<typeof publicActionsL2>;

/**
 * Creates wallet and public clients configured for the specified chain with a local account
 * Used for Abstract sponsored transactions in disconnected mode
 */
export function createBenchmarkClients(
  account: Account,
  chainConfig: ChainConfig,
  rpcCallLogger: (log: RPCCallLog) => void,
  rpcStartLogger?: (log: Omit<RPCCallLog, 'endTime' | 'duration'>) => void,
  prefetchChainId: boolean = false
) {
  const chain = chainConfig.chain;
  const rpcUrl = chain.rpcUrls.default.http[0];

  if (chainConfig.isZkSync) {
    // zkSync-family chains need EIP-712 wallet actions and L2 public actions
    const walletClient = createWalletClient({
      account,
      chain,
      transport: createInstrumentedTransport(rpcUrl, rpcCallLogger, rpcStartLogger, prefetchChainId, chain.id),
    }).extend(eip712WalletActions());

    const publicClient = createPublicClient({
      chain,
      transport: createInstrumentedTransport(rpcUrl, rpcCallLogger, rpcStartLogger),
    }).extend(publicActionsL2());

    return { walletClient, publicClient };
  } else {
    // Standard EVM chains
    const walletClient = createWalletClient({
      account,
      chain,
      transport: createInstrumentedTransport(rpcUrl, rpcCallLogger, rpcStartLogger, prefetchChainId, chain.id),
    });

    const publicClient = createPublicClient({
      chain,
      transport: createInstrumentedTransport(rpcUrl, rpcCallLogger, rpcStartLogger),
    });

    return { walletClient, publicClient };
  }
}

/**
 * Creates instrumented public client for use with a connected wallet
 * The wallet client comes from wagmi, we just create an instrumented public client
 */
export function createInstrumentedPublicClient(
  chainConfig: ChainConfig,
  rpcCallLogger: (log: RPCCallLog) => void,
  rpcStartLogger?: (log: Omit<RPCCallLog, 'endTime' | 'duration'>) => void,
) {
  const chain = chainConfig.chain;
  const rpcUrl = chain.rpcUrls.default.http[0];

  if (chainConfig.isZkSync) {
    return createPublicClient({
      chain,
      transport: createInstrumentedTransport(rpcUrl, rpcCallLogger, rpcStartLogger),
    }).extend(publicActionsL2());
  } else {
    return createPublicClient({
      chain,
      transport: createInstrumentedTransport(rpcUrl, rpcCallLogger, rpcStartLogger),
    });
  }
}

/**
 * Creates a non-instrumented public client for setup operations (nonce fetching, gas estimation)
 * These calls happen before the benchmark timer starts
 */
export function createSetupPublicClient(chainConfig: ChainConfig) {
  const chain = chainConfig.chain;
  const rpcUrl = chain.rpcUrls.default.http[0];

  if (chainConfig.isZkSync) {
    return createPublicClient({
      chain,
      transport: http(rpcUrl),
    }).extend(publicActionsL2());
  } else {
    return createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
  }
}
