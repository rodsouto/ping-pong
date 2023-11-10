import "dotenv/config";
import { formatEther } from "viem";
import { walletClient } from "./lib/viem";
import { getPong } from "./lib/supabase";
import { pongLoop, getPingMap } from "./lib/utils";
import { PING_EVENT } from "./lib/logs";

(async () => {
  console.log(`Bot address: ${walletClient.account.address}`);

  const balance = await walletClient.getBalance({
    address: walletClient.account.address,
  });
  console.log(`Bot balance: ${formatEther(balance)}`);

  const latestBlock = await walletClient.getBlockNumber();

  // ping events emitted by the smart contract
  const pingMap = await getPingMap(latestBlock);

  console.log(`Found ${pingMap.size} pings`);

  // send pending pong events
  console.log("CHECKING PENDING PING EVENTS...");
  for (const [pingHash, pongEvent] of pingMap) {
    if (pongEvent?.mined) {
      // pong already sent
      continue;
    }

    await pongLoop(pingHash, pongEvent);
  }

  console.log("WATCHING NEW PING EVENTS...");
  walletClient.watchEvent({
    address: process.env.PING_PONG_CONTRACT_ADDRESS as `0x${string}`,
    event: PING_EVENT,
    onLogs: async (logs: any) => {
      const pingHash = logs[0].transactionHash;
      const pongEvent = await getPong(pingHash);

      await pongLoop(pingHash, pongEvent);
    },
  });
})();
