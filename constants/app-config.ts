/**
 * Application-wide configuration constants
 */

export const APP_CONFIG = {
  /**
   * Interval for updating elapsed time during benchmark (ms)
   */
  TIMER_UPDATE_INTERVAL: 50,
  
  /**
   * Duration for animated counter transitions (ms)
   */
  COUNTER_ANIMATION_DURATION: 100,
} as const;

export const APP_METADATA = {
  title: "Transaction Latency Simulator",
  description: "Visualize real-time RPC latency when sending transactions across different EVM chains",
  appName: "Transaction Latency Simulator",
} as const;
