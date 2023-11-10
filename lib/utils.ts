import { TransactionNotFoundError, parseGwei } from "viem";
import { getAllEvents } from "./logs";
import { Pong, getPongs, savePong, setPongStatus } from "./supabase";
import { walletClient } from "./viem";

export const PING_PONG_ABI = [
  { inputs: [], stateMutability: "nonpayable", type: "constructor" },
  { anonymous: false, inputs: [], name: "Ping", type: "event" },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: "bytes32",
        name: "txHash",
        type: "bytes32",
      },
    ],
    name: "Pong",
    type: "event",
  },
  {
    inputs: [],
    name: "ping",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "pinger",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "_txHash", type: "bytes32" }],
    name: "pong",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const BLOCK_RANGE = 500000n;

export async function getPingMap(latestBlock: bigint) {
  const pingEvents = await getAllEvents(
    "ping",
    BigInt(process.env.STARTING_BLOCK!),
    latestBlock,
    BLOCK_RANGE,
    process.env.PING_PONG_CONTRACT_ADDRESS as `0x${string}`
  );

  const pingMap = pingEvents.reduce((acc, curr) => {
    acc.set(curr.transactionHash, undefined);

    return acc;
  }, new Map<`0x${string}`, Pong | undefined>());

  // pong events loaded from supabase
  const pongEvents = await getPongs();

  // assign pongs to pings
  pongEvents.forEach((pongEvent) => {
    const pingHash = pongEvent.ping_tx;

    if (!pingMap.has(pingHash)) {
      //console.error(`Invalid pong txHash: ${pingHash}`);
      return;
    }

    pingMap.set(pingHash, pongEvent);
  });

  return pingMap;
}

async function sendPong(pingHash: `0x${string}`) {
  console.log("sending pong...");

  const { request } = await walletClient.simulateContract({
    address: process.env.PING_PONG_CONTRACT_ADDRESS as `0x${string}`,
    abi: PING_PONG_ABI,
    functionName: "pong",
    args: [pingHash],
    //maxFeePerGas: parseGwei("0.000000009"), // NOTE: to test with failing gas
    //maxPriorityFeePerGas: parseGwei("0.00000000002"), // NOTE: to test with failing gas
  });
  const pongHash = await walletClient.writeContract(request);

  console.log(`submitted pong with tx ${pongHash} for ping ${pingHash}`);

  await savePong(pingHash, pongHash);

  await walletClient.waitForTransactionReceipt({
    hash: pongHash,
    timeout: 60000,
  });

  await setPongStatus(pongHash, true);
}

async function speedTx(pingHash: `0x${string}`) {
  console.log("trying to speed up tx...");
  const { maxFeePerGas, maxPriorityFeePerGas } =
    await walletClient.estimateFeesPerGas();

  if (!maxFeePerGas || !maxPriorityFeePerGas) {
    throw new Error("Unable to speed up tx");
  }

  let newMaxPriorityFeePerGas =
    maxPriorityFeePerGas + (maxPriorityFeePerGas * BigInt(12)) / 100n;

  if (newMaxPriorityFeePerGas === maxPriorityFeePerGas) {
    newMaxPriorityFeePerGas += 1n;
  }

  const { request } = await walletClient.simulateContract({
    address: process.env.PING_PONG_CONTRACT_ADDRESS as `0x${string}`,
    abi: PING_PONG_ABI,
    nonce: await walletClient.getTransactionCount({
      address: walletClient.account.address,
    }),
    functionName: "pong",
    args: [pingHash],
    maxFeePerGas,
    maxPriorityFeePerGas: newMaxPriorityFeePerGas,
  });

  const pongHash = await walletClient.writeContract(request);

  console.log(`speeded pong with tx ${pongHash}`);

  await savePong(pingHash, pongHash);

  await walletClient.waitForTransactionReceipt({ hash: pongHash });

  await setPongStatus(pongHash, true);
}

const sleep = (delay: number) =>
  new Promise((resolve) => setTimeout(resolve, delay));

export async function pongLoop(pingHash: `0x${string}`, pongEvent?: Pong) {
  while (true) {
    try {
      console.log("Pong:", pongEvent);
      await executePong(pingHash, pongEvent);
      break;
    } catch (error: any) {
      console.log("Pong error, waiting to retry...", error.shortMessage);
      await sleep(15000);
      console.log("Retrying...");
    }
  }
}

export async function executePong(pingHash: `0x${string}`, pongEvent?: Pong) {
  if (pongEvent === undefined) {
    await sendPong(pingHash);
    return;
  }

  if (pongEvent.mined) {
    throw new Error("Pong already mined");
  }

  try {
    // check if the tx was processed while the bot was down, otherwise speed up
    const tx = await walletClient.getTransaction({ hash: pongEvent.pong_tx });
    if (tx.blockNumber === null) {
      // speed up tx
      await speedTx(pingHash);
    } else {
      // mined tx
      console.log(`updated pong status for ${pongEvent.pong_tx}`);
      await setPongStatus(pongEvent.pong_tx, true);
    }
  } catch (error: any) {
    if (error instanceof TransactionNotFoundError) {
      // dropped tx
      await sendPong(pingHash);
    } else {
      console.log("Unexpected error, try again", error.message);
      throw error;
    }
  }
}
