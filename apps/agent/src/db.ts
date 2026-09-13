import logger from "./logger.js";
import { sbAdmin } from "./sb.js";

export async function logMessage(userId: string, from: string, body: string, reply: string | null, owner: boolean) {
  if (!sbAdmin) return; // DB bina bhi agent chalega
  try {
    await sbAdmin.from("Message").insert({ user_id: userId, from_number: from, body, reply, is_owner: owner });
  } catch (e) {
    logger.error({ err: e }, "[db] log failed");
  }
}

export async function recentHistory(userId: string, from: string, limit = 8): Promise<string[]> {
  if (!sbAdmin) return [];
  try {
    const { data } = await sbAdmin
      .from("Message")
      .select("body,reply")
      .eq("user_id", userId)
      .eq("from_number", from)
      .order("created_at", { ascending: false })
      .limit(limit);
    return ((data as any[] | null) || []).reverse().flatMap((r) => [`User: ${r.body}`, `Assistant: ${r.reply ?? ""}`]);
  } catch (e) {
    logger.error({ err: e }, "[db] history fail");
    return [];
  }
}
