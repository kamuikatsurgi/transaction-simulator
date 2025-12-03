import { RPCCallLog } from "@/lib/instrumented-transport";

/**
 * Mock RPC call data for displaying before the first benchmark run
 * These represent typical call patterns for each transaction mode (simplified)
 */

export const MOCK_ASYNC_CALLS: RPCCallLog[] = [
  { method: "eth_getTransactionCount", startTime: 0, endTime: 473, duration: 473 },
  { method: "eth_estimateGas", startTime: 0, endTime: 340, duration: 340 },
  { method: "eth_sendRawTransaction", startTime: 0, endTime: 265, duration: 265 },
  { method: "eth_getTransactionReceipt", startTime: 0, endTime: 236, duration: 236 },
  { method: "eth_getTransactionReceipt", startTime: 0, endTime: 233, duration: 233 },
];

export const MOCK_SYNC_CALLS: RPCCallLog[] = [
  { method: "eth_getTransactionCount", startTime: 0, endTime: 476, duration: 476 },
  { method: "eth_estimateGas", startTime: 0, endTime: 341, duration: 341 },
  { method: "eth_sendRawTransactionSync", startTime: 0, endTime: 470, duration: 470 },
];

/**
 * Get mock calls based on sync mode
 */
export function getMockCalls(syncMode: boolean): RPCCallLog[] {
  return syncMode ? MOCK_SYNC_CALLS : MOCK_ASYNC_CALLS;
}
