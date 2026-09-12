import cron from "node-cron";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "./baileys.js";
import { getOwner } from "./whitelist.js";

// Har minute: due reminders bhejo. Render Free sleep me miss ho sakta hai
// (README me UptimeRobot jugaad diya hai).
export function startScheduler() {
  if (!process.env.SUPABASE_URL) {
    console.log("[cron] SUPABASE_URL nahi hai — scheduler off (sirf chat chalega)");
    return;
  }
  cron.schedule("* * * * *", async () => {
    try {
      const url = process.env.SUPABASE_URL!;
      const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
      const sb = createClient(url, key);
      const { data } = await sb
        .from("Reminder")
        .select("id,title,remindAt")
        .eq("sent", false)
        .lte("remindAt", new Date().toISOString())
        .limit(10);
      const due = (data as any[]) || [];
      if (due.length === 0) return;
      const ownerJid = `${getOwner()}@s.whatsapp.net`;
      for (const r of due) {
        try {
          await sendWhatsAppMessage(ownerJid, `⏰ Reminder: ${r.title}`);
          await sb.from("Reminder").update({ sent: true }).eq("id", r.id);
          console.log(`[cron] reminder bheja: ${r.title}`);
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
