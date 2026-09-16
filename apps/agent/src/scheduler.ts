import cron from "node-cron";
import logger from "./logger.js";
import { sbAdmin } from "./sb.js";
import { sendWhatsAppMessage, allSessions, requestReconnect } from "./baileys.js";
import { getOwnerNumber } from "./store.js";

// Har minute: har connected user ke due reminders bhejo.
// Render Free sleep me miss ho sakta hai (cron-job.org ping lagao).
export function startScheduler() {
  if (!sbAdmin) {
    logger.info("[cron] DB nahi hai — scheduler off (sirf chat chalega)");
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
          // Session dead hai par reminder due hai — agle minute bhejne ke liye jagao,
          // is tick me skip (sent=false rehta hai, miss nahi hoga).
          requestReconnect(r.user_id, { reason: "scheduler-due" });
          logger.info({ id: r.id }, "[cron] skip: user session connected nahi — reconnect trigger");
          continue;
        }
        // owner boot ke baad set hua ho to fresh uthao
        const owner = s.ownerNumber || (await getOwnerNumber(r.user_id));
        if (!owner) {
          logger.info({ id: r.id }, "[cron] skip: owner number set nahi");
          continue;
        }
        if (!s.ownerNumber) s.ownerNumber = owner;
        try {
          // Claim-first: pehle sent=true (duplicate send roko), fail pe wapas false.
          // Crash ke beech me phasne se miss ho sakta hai, par double-reminder nahi jayega.
          await sbAdmin!.from("Reminder").update({ sent: true }).eq("id", r.id);
          await sendWhatsAppMessage(r.user_id, `${owner}@s.whatsapp.net`, `⏰ Reminder: ${r.title}`);
          logger.info({ userId: r.user_id.slice(0, 8), title: r.title }, "[cron] reminder bheja");
        } catch (e) {
          logger.error({ err: e }, "[cron] send fail, retry ke liye wapas");
          await sbAdmin!.from("Reminder").update({ sent: false }).eq("id", r.id).then(
            () => {},
            (e2) => logger.error({ err: e2 }, "[cron] unclaim fail")
          );
        }
      }
  } catch (e) {
    logger.error({ err: e }, "[cron] tick fail");
  }
  });
  logger.info("[cron] scheduler on (har minute check)");
}
