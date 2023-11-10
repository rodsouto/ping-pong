import "dotenv/config";
import { formatEther } from "viem";
import { walletClient } from "./lib/viem";
import { pongLoop, getPingMap } from "./lib/utils";
import { PING_EVENT } from "./lib/logs";
import Queue from "queue";

(async () => {
  console.log(`Bot address: ${walletClient.account.address}`);

  const balance = await walletClient.getBalance({
    address: walletClient.account.address,
  });
  console.log(`Bot balance: ${formatEther(balance)}`);

  const latestBlock = await walletClient.getBlockNumber();

  // ping events emitted by the smart contract
  const pingMap = await getPingMap(latestBlock);

  // get pings without a pong
  const pendingPings = Array.from(pingMap).filter((entry) => {
    const [pingHash, pongEvent] = entry;
    if (pongEvent?.mined) {
      // pong already sent
      return false;
    }

    return true;
  });

  console.log(
    `Found ${pingMap.size} pings, ${pendingPings.length} pings pending`
  );

  // task queue
  const q = new Queue({
    concurrency: 1,
    results: [],
  });

  // initialize the queue with the pending pings
  pendingPings.forEach((entry) => {
    q.push(() => {
      const [pingHash, pongEvent] = entry;
      return pongLoop(pingHash, pongEvent);
    });
  });

  walletClient.watchEvent({
    address: process.env.PING_PONG_CONTRACT_ADDRESS as `0x${string}`,
    event: PING_EVENT,
    onLogs: async (logs: any) => {
      // add new ping to the queue and process it
      const pingHash = logs[0].transactionHash;
      console.log(`new ping event received ${pingHash}`);
      q.push(() => pongLoop(pingHash));
      q.start();
    },
  });

  // process current pings
  q.start();
})();
