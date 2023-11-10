import { GetLogsReturnType, parseAbiItem } from "viem";
import { walletClient } from "./viem";

export const PING_EVENT = parseAbiItem("event Ping()");
export const PONG_EVENT = parseAbiItem("event Pong(bytes32)");

export async function getAllEvents(
  eventType: "ping" | "pong",
  fromBlock: bigint,
  latestBlock: bigint,
  blockRange: bigint,
  address: `0x${string}`
): Promise<GetLogsReturnType> {
  const promises: Promise<GetLogsReturnType>[] = [];

  while (fromBlock < latestBlock) {
    const toBlock =
      fromBlock + blockRange < latestBlock
        ? fromBlock + blockRange
        : latestBlock;

    console.log(`fetching logs from ${fromBlock} to ${toBlock}`);

    promises.push(
      walletClient.getLogs({
        address,
        event: eventType === "ping" ? PING_EVENT : PONG_EVENT,
        fromBlock: fromBlock,
        toBlock: toBlock,
        strict: true,
      })
    );

    fromBlock += blockRange + 1n;
  }

  const logs = await Promise.all(promises);

  return logs.flat();
}
