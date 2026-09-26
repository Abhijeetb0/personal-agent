import cron from "node-cron";
import logger from "./logger.js";
import { sbAdmin } from "./sb.js";
import { sendWhatsAppMessage, allSessions, requestReconnect, isLive, resolveOutgoingJid } from "./baileys.js";
import { getOwnerNumber } from "./store.js";

// Overlap guard: 15s send-wait ke saath do tick overlap na ho (double-send rokne ke liye).
let tickRunning = false;

// Due-reminder ka ek pass: DB se overdue uthao, connected ko bhejo, dead ko jagao.
// Alag function taaki cron + boot catch-up dono ise chala saken (sleep se jagte hi wait nahi).
export async function processDueReminders() {
  if (tickRunning) {
    logger.info("[cron] tick skip: pichla tick chal raha hai");
    return;
  }
  tickRunning = true;
  try {
    const { data } = await sbAdmin!
      .from("Reminder")
      .select("id,user_id,title,remind_at")
      .eq("sent", false)
      .lte("remind_at", new Date().toISOString())
      .order("remind_at", { ascending: true })
      .limit(25);
    const due = (data as any[]) || [];
    if (due.length === 0) return;
    const live = new Map(allSessions().filter((s) => isLive(s)).map((s) => [s.userId, s]));
    for (const r of due) {
      const s = live.get(r.user_id);
      if (!s) {
        // Session dead/half-open hai par reminder due hai — jagao, is tick me skip
        // (sent=false rehta hai, miss nahi hoga). sendWhatsAppMessage bhi fail pe
        // status=disconnected mark karta hai taaki agli tick pe wake ho.
        requestReconnect(r.user_id, { reason: "scheduler-due", force: true });
        logger.info({ id: r.id }, "[cron] skip: user session live nahi — reconnect trigger");
        continue;
      }
      // owner boot ke baad set hua ho to fresh uthao
      const owner = s.ownerNumber || (await getOwnerNumber(r.user_id));
      if (!owner) {
        logger.info({ id: r.id }, "[cron] skip: owner number set nahi");
        continue;
      }
      if (!s.ownerNumber) s.ownerNumber = owner;
      const jid = resolveOutgoingJid(s, owner);
      try {
        // Claim-first (atomic): pehle sent=true + eq(sent,false) taaki 2 replica
        // same reminder dobara na bheje. Fail pe wapas false.
        // Crash ke beech me phasne se miss ho sakta hai, par double-reminder nahi jayega.
        const claimed = await sbAdmin!.from("Reminder").update({ sent: true }).eq("id", r.id).eq("sent", false);
        if ((claimed as any)?.error) throw (claimed as any).error;
        await sendWhatsAppMessage(r.user_id, jid, `⏰ Reminder: ${r.title}`);
        logger.info({ userId: r.user_id.slice(0, 8), title: r.title, jid }, "[cron] reminder bheja");
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
  } finally {
    tickRunning = false;
  }
}

// Har minute: har live user ke due reminders bhejo.
// Render Free sleep me miss ho sakta hai — cron-job.org (/health) + UptimeRobot (/wake) ping lagao.
let schedulerOn = false;
export function startScheduler() {
  if (!sbAdmin) {
    logger.info("[cron] DB nahi hai — scheduler off (sirf chat chalega)");
    return;
  }
  if (schedulerOn) {
    logger.info("[cron] scheduler already on — double schedule skip");
    return;
  }
  schedulerOn = true;
  cron.schedule("* * * * *", processDueReminders);
  // Boot catch-up: sleep/restart se jagte hi overdue turant bhejo, 1-min wait nahi.
  // 10s delay taaki startAllSessions ko socket banane ka time mile.
  setTimeout(() => {
    processDueReminders().catch((e) => logger.error({ err: e }, "[cron] boot catch-up fail"));
  }, 10_000);
  logger.info("[cron] scheduler on (har minute check + boot catch-up)");
}
