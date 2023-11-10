import "dotenv/config";
import { formatEther } from "viem";
import { walletClient } from "./lib/viem";
import { pongLoop, getPingMap, getPendingPings } from "./lib/utils";
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
  const pendingPings = getPendingPings(pingMap);

  console.log(
    `Found ${pingMap.size} pings, ${pendingPings.length} pings pending`
  );

  // using the task queue the pings are executed in order,
  // and it only tries to execute the next pong once the current one has been confirmed
  // the bot will never have more than 1 pending tx
  const q = new Queue({
    concurrency: 1,
    results: [],
  });

  // initialize the queue with the pending pings
  pendingPings.forEach((pingHash) => {
    q.push(() => pongLoop(pingHash));
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
