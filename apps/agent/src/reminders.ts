import { sbAdmin } from "./sb.js";

// Reminder save — intent brain samajhta hai, ye sirf DB me dalta hai (per user).
export async function saveReminder(userId: string, title: string, remindAt: Date, source = "custom") {
  if (!sbAdmin) {
    console.log(`[reminder] (no DB) ${title} @ ${remindAt.toISOString()}`);
    return { id: "local", title, remindAt };
  }
  const { data, error } = await sbAdmin
    .from("Reminder")
    .insert({ user_id: userId, title, remind_at: remindAt.toISOString(), source })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listPendingReminders(userId: string, limit = 10) {
  if (!sbAdmin) return [];
  const { data } = await sbAdmin
    .from("Reminder")
    .select("title,remind_at,sent")
    .eq("user_id", userId)
    .eq("sent", false)
    .order("remind_at", { ascending: true })
    .limit(limit);
  return ((data as any[]) || []).map((r) => ({ title: r.title, remindAt: r.remind_at, sent: r.sent }));
}
