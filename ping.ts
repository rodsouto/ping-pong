import "dotenv/config";
import { PING_PONG_ABI } from "./lib/utils";
import { walletClient } from "./lib/viem";

(async () => {
  const { request } = await walletClient.simulateContract({
    address: process.env.PING_PONG_CONTRACT_ADDRESS as `0x${string}`,
    abi: PING_PONG_ABI,
    functionName: "ping",
  });
  const pingHash = await walletClient.writeContract(request);
  console.log("ping sent", pingHash);
})();
