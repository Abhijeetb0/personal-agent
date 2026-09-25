import { DisconnectReason } from "@whiskeysockets/baileys";
import logger from "./logger.js";
import { sbAdmin } from "./sb.js";
import {
  allSessions, getSession, isStarting, requestReconnect,
} from "./baileys.js";
import { listSessionUsers } from "./store.js";

const QR_GRACE_MS = 120_000; // QR aane ke 2 min tak reconnect mat chhedo (scan ka time do)
const STAGGER_MS = 5_000; // har user me gap (WhatsApp spike + Render load se bachne ke liye)
const TICK_MS = 60 * 1000; // har 1 min check (Render sleep fix: /wake pinger ke saath 1-5 min wake guarantee)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function shouldSkip(userId: string): { skip: boolean; reason: string } {
  const s = getSession(userId);
  if (s.status === "connected") return { skip: true, reason: "connected" };
  if (isStarting(userId)) return { skip: true, reason: "starting" };
  // QR fresh hai to user scan kar raha hoga — disturb mat karo
  if (s.status === "qr" && Date.now() - s.lastQrAt < QR_GRACE_MS) {
    return { skip: true, reason: "qr-grace" };
  }
  // Logged out: QR hi chahiye, auto-retry bekar
  if ((s.lastClose?.code as number) === DisconnectReason.loggedOut) {
    return { skip: true, reason: "logged-out" };
  }
  // Backoff wait chal raha hai (close-handler ka timer marega) — uska time aane do
  if (s.nextRetryAt && Date.now() < s.nextRetryAt) {
    return { skip: true, reason: "backoff" };
  }
  return { skip: false, reason: "" };
}

// Har 3 min: DB ke saare login users + memory ke sessions check karo, dead ko jagao.
// Render sleep ke baad timer mar jata hai, par wake hote hi ye loop wapas chalta hai
// aur close-handler ke miss hue retry ko pakad leta hai — 1-2 din baad bhi connected.
export function startWatchdog() {
  if (!sbAdmin) {
    logger.info("[watchdog] DB nahi hai — watchdog off");
    return;
  }
  const tick = async () => {
    try {
      const dbUsers = await listSessionUsers();
      const memUsers = allSessions().map((s) => s.userId);
      const users = [...new Set([...dbUsers, ...memUsers])];
      if (users.length === 0) return;
      let woke = 0;
      for (const u of users) {
        const { skip } = shouldSkip(u);
        if (!skip && requestReconnect(u, { reason: "watchdog" })) woke += 1;
        await sleep(STAGGER_MS);
      }
      if (woke > 0) logger.info({ woke, total: users.length }, "[watchdog] sessions jagayin");
    } catch (e) {
      logger.error({ err: e }, "[watchdog] tick fail");
    }
  };
  // Boot ke 30s baad pehli check (startAllSessions ko time do), phir har 1 min
  setTimeout(tick, 30_000);
  setInterval(tick, TICK_MS);
  logger.info("[watchdog] on (har 1 min self-heal)");
}

// Tests ke liye export
export { shouldSkip };
