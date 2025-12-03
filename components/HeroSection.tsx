"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function HeroSection() {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div className="w-full">
      {/* Header with ConnectButton */}
      <div className="w-full max-w-6xl mx-auto px-4 py-4 flex justify-end">
        <ConnectButton 
          showBalance={false}
          chainStatus="none"
          accountStatus={{
            smallScreen: 'avatar',
            largeScreen: 'full',
          }}
        />
      </div>

      <div className="flex flex-col items-center justify-center gap-4 pt-2 pb-4">
        {/* Ethereum icon with glow effects */}
        <div
          className="relative group"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div
            className={`absolute inset-0 bg-emerald-400/15 md:bg-emerald-400/20 lg:bg-emerald-400/30 blur-3xl rounded-full transition-all duration-700 ${
              isHovering ? "scale-150 opacity-100" : "scale-100 opacity-60"
            }`}
          />
          <div
            className={`hidden md:block absolute inset-0 bg-green-500/20 blur-2xl rounded-full transition-all duration-500 ${
              isHovering ? "scale-125 opacity-80" : "scale-100 opacity-40"
            }`}
          />
          <div
            className={`hidden lg:block absolute inset-0 bg-teal-500/10 blur-xl rounded-full transition-all duration-300 ${
              isHovering ? "scale-110 opacity-70" : "scale-100 opacity-30"
            }`}
          />

          {/* Ethereum diamond icon */}
          <div className="relative p-2">
            <svg
              width="80"
              height="80"
              viewBox="0 0 256 417"
              xmlns="http://www.w3.org/2000/svg"
              className={`relative z-10 transition-all duration-500 ${
                isHovering
                  ? "scale-110 drop-shadow-[0_0_20px_rgba(16,185,129,0.6)]"
                  : "scale-100"
              }`}
            >
              <g>
                <polygon
                  fill="#10b981"
                  points="127.9611 0 125.1661 9.5 125.1661 285.168 127.9611 287.958 255.9231 212.32"
                />
                <polygon
                  fill="#34d399"
                  points="127.962 0 0 212.32 127.962 287.959 127.962 154.158"
                />
                <polygon
                  fill="#059669"
                  points="127.9611 312.1866 126.3861 314.1066 126.3861 412.3056 127.9611 416.9066 255.9991 236.5866"
                />
                <polygon
                  fill="#34d399"
                  points="127.962 416.9052 127.962 312.1852 0 236.5852"
                />
                <polygon
                  fill="#065f46"
                  points="127.9611 287.9577 255.9211 212.3207 127.9611 154.1587"
                />
                <polygon
                  fill="#10b981"
                  points="0.0009 212.3208 127.9609 287.9578 127.9609 154.1588"
                />
              </g>
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-center bg-gradient-to-b from-white via-white to-zinc-400 bg-clip-text text-transparent leading-tight">
          Transaction Latency Simulator
        </h1>

        {/* Subtitle */}
        <p className="text-sm md:text-base text-zinc-400 text-center max-w-2xl px-4 leading-snug">
          Visualize real-time RPC latency when sending transactions across different chains
        </p>
      </div>
    </div>
  );
}
