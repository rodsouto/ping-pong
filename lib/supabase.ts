import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_PUBLIC_ANON_KEY as string,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

export interface Pong {
  ping_tx: `0x${string}`; // database PK
  pong_tx: `0x${string}`;
  mined: boolean;
}

export async function savePong(pingTx: string, pongTx: string) {
  return await supabase
    .from("ping_pong_bot")
    .upsert({ ping_tx: pingTx, pong_tx: pongTx })
    .select();
}

export async function setPongStatus(pongTx: string, mined: boolean) {
  return await supabase
    .from("ping_pong_bot")
    .update({ mined })
    .eq("pong_tx", pongTx);
}

export async function getPongs(): Promise<Pong[]> {
  const result = await supabase
    .from("ping_pong_bot")
    .select("*")
    .order("created_at", { ascending: true });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data;
}

export async function getPong(pingTx: string): Promise<Pong | undefined> {
  const result = await supabase
    .from("ping_pong_bot")
    .select("*")
    .eq("ping_tx", pingTx);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data?.[0];
}
