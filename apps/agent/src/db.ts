import { createClient } from "@supabase/supabase-js";

export async function logMessage(from: string, body: string, reply: string | null, isOwner: boolean) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return; // DB bina bhi agent chalega
  try {
    const sb = createClient(url, key);
    await sb.from("Message").insert({ fromNumber: from, body, reply, isOwner });
  } catch (e) {
    console.error("[db] log failed:", (e as Error).message);
  }
}

export async function recentHistory(from: string, limit = 6): Promise<string[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return [];
  try {
    const sb = createClient(url, key);
    const { data } = await sb
      .from("Message")
      .select("body,reply")
      .eq("fromNumber", from)
      .order("createdAt", { ascending: false })
      .limit(limit);
    return ((data as any[] | null) || []).reverse().flatMap((r) => [`User: ${r.body}`, `Assistant: ${r.reply ?? ""}`]);
  } catch {
    return [];
  }
}
