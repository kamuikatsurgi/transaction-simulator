"use client";

import Image from "next/image";
import { ChainConfig, CHAIN_CONFIGS, getSupportedChainIds } from "@/config/chains";

interface ChainSelectorProps {
  selectedChainId: string;
  onChange: (chainId: string) => void;
  disabled?: boolean;
}

export function ChainSelector({ selectedChainId, onChange, disabled = false }: ChainSelectorProps) {
  const chainIds = getSupportedChainIds();
  
  return (
    <div className="w-full md:flex-1 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-white">Select Chain</h3>
        
        <div className="flex flex-wrap gap-2">
          {chainIds.map((chainId) => {
            const config = CHAIN_CONFIGS[chainId];
            const isSelected = chainId === selectedChainId;
            
            return (
              <button
                key={chainId}
                onClick={() => onChange(chainId)}
                disabled={disabled}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-zinc-600'}
                  ${isSelected 
                    ? 'bg-zinc-800 border-zinc-600' 
                    : 'bg-zinc-900/50 border-zinc-800'
                  }
                `}
                style={{
                  borderColor: isSelected ? config.accentColor : undefined,
                  boxShadow: isSelected ? `0 0 10px ${config.accentColor}30` : undefined,
                }}
              >
                <Image
                  src={config.logo}
                  alt={config.name}
                  width={20}
                  height={20}
                  className="object-contain"
                />
                <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-zinc-400'}`}>
                  {config.shortName}
                </span>
                {isSelected && (
                  <div 
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: config.accentColor }}
                  />
                )}
              </button>
            );
          })}
        </div>
        
        {/* Chain info */}
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>Chain ID: {CHAIN_CONFIGS[selectedChainId].chain.id}</span>
          {CHAIN_CONFIGS[selectedChainId].supportsSyncMode && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Sync Mode Available
            </span>
          )}
          {CHAIN_CONFIGS[selectedChainId].supportsPaymaster && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Gas Sponsored
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

