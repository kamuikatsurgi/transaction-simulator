"use client";

import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { 
  abstractTestnet, 
  megaethTestnet, 
  monadTestnet, 
  baseSepolia, 
  sepolia,
  // Add common testnets users might search for
  arbitrumSepolia,
  optimismSepolia,
  polygonAmoy,
  avalancheFuji,
  bscTestnet,
  lineaSepolia,
  scrollSepolia,
  zkSyncSepoliaTestnet,
  mantleSepoliaTestnet,
  blastSepolia,
  // Add some mainnets too
  mainnet,
  arbitrum,
  optimism,
  polygon,
  avalanche,
  bsc,
  base,
  linea,
  scroll,
  zkSync,
  mantle,
  blast,
} from "viem/chains";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";

// Configure wagmi with RainbowKit defaults
// Include featured chains + popular testnets + mainnets
const config = getDefaultConfig({
  appName: "Transaction Latency Simulator",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [
    // Featured chains
    abstractTestnet, 
    monadTestnet, 
    megaethTestnet, 
    baseSepolia, 
    sepolia,
    // Popular testnets
    arbitrumSepolia,
    optimismSepolia,
    polygonAmoy,
    avalancheFuji,
    bscTestnet,
    lineaSepolia,
    scrollSepolia,
    zkSyncSepoliaTestnet,
    mantleSepoliaTestnet,
    blastSepolia,
    // Mainnets
    mainnet,
    arbitrum,
    optimism,
    polygon,
    avalanche,
    bsc,
    base,
    linea,
    scroll,
    zkSync,
    mantle,
    blast,
  ],
  ssr: true,
});

// Create a stable query client
const queryClient = new QueryClient();

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#10b981",
            accentColorForeground: "white",
            borderRadius: "medium",
            fontStack: "system",
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

