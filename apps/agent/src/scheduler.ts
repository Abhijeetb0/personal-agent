import cron from "node-cron";
import { sbAdmin } from "./sb.js";
import { sendWhatsAppMessage, allSessions } from "./baileys.js";
import { getOwnerNumber } from "./store.js";

// Har minute: har connected user ke due reminders bhejo.
// Render Free sleep me miss ho sakta hai (cron-job.org ping lagao).
export function startScheduler() {
  if (!sbAdmin) {
    console.log("[cron] DB nahi hai — scheduler off (sirf chat chalega)");
    return;
  }
  cron.schedule("* * * * *", async () => {
    try {
      const { data } = await sbAdmin!
        .from("Reminder")
        .select("id,user_id,title,remind_at")
        .eq("sent", false)
        .lte("remind_at", new Date().toISOString())
        .limit(25);
      const due = (data as any[]) || [];
      if (due.length === 0) return;
      const live = new Map(allSessions().filter((s) => s.status === "connected").map((s) => [s.userId, s]));
      for (const r of due) {
        const s = live.get(r.user_id);
        if (!s) {
          console.log(`[cron] skip ${r.id}: user session connected nahi`);
          continue;
        }
        // owner boot ke baad set hua ho to fresh uthao
        const owner = s.ownerNumber || (await getOwnerNumber(r.user_id));
        if (!owner) {
          console.log(`[cron] skip ${r.id}: owner number set nahi`);
          continue;
        }
        if (!s.ownerNumber) s.ownerNumber = owner;
        try {
          await sendWhatsAppMessage(r.user_id, `${owner}@s.whatsapp.net`, `⏰ Reminder: ${r.title}`);
          await sbAdmin!.from("Reminder").update({ sent: true }).eq("id", r.id);
          console.log(`[cron] reminder bheja (${r.user_id.slice(0, 8)}): ${r.title}`);
        } catch (e) {
          console.error("[cron] send fail:", (e as Error).message);
        }
      }
    } catch (e) {
      console.error("[cron] tick fail:", (e as Error).message);
    }
  });
  console.log("[cron] scheduler on (har minute check)");
}
