import { http, Address, createWalletClient, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { goerli } from "viem/chains";

const account = privateKeyToAccount(process.env.ACCOUNT_PRIVATE_KEY as Address);

const walletClient = createWalletClient({
  account,
  chain: goerli,
  transport: http(process.env.RPC_URL),
}).extend(publicActions);

export { walletClient };
