import { DisconnectReason } from "@whiskeysockets/baileys";
import logger from "./logger.js";
import { sbAdmin } from "./sb.js";
import {
  allSessions, getSession, isStarting, requestReconnect, isLive,
} from "./baileys.js";
import { listPairedUsers } from "./store.js";

const QR_GRACE_MS = 120_000; // QR aane ke 2 min tak reconnect mat chhedo (scan ka time do)
const STAGGER_MS = 5_000; // har user me gap (WhatsApp spike + Render load se bachne ke liye)
const TICK_MS = 60 * 1000; // har 1 min check (Render sleep fix: /wake pinger ke saath 1-5 min wake guarantee)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function shouldSkip(userId: string): { skip: boolean; reason: string } {
  const s = getSession(userId);
  // Half-open (status connected, WS dead) ko skip mat karo — wahi reminder-bug tha.
  if (isLive(s)) return { skip: true, reason: "connected" };
  if (s.status === "connected") return { skip: false, reason: "" };
  if (isStarting(userId)) return { skip: true, reason: "starting" };
  // General fix: manual scan pending hai — auto-retry bekar (wake/watchdog dono skip)
  if (s.needsScan) return { skip: true, reason: "needs-scan" };
  // QR aaya hua hai to user scan kar raha hoga — watchdog disturb mat karo (grace ke baad bhi nahi,
  // QR-timeout counter close-handler me badhega aur MAX pe needsScan lagayega)
  if (s.status === "qr") {
    const age = Date.now() - s.lastQrAt;
    return { skip: true, reason: age < QR_GRACE_MS ? "qr-grace" : "qr-wait" };
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

// Har 1 min: DB ke paired users + memory ke sessions check karo, dead ko jagao.
// Sirf paired users (valid creds) — ghost QR-loop yaha se kabhi nahi jagega.
// Render sleep ke baad timer mar jata hai, par wake hote hi ye loop wapas chalta hai
// aur close-handler ke miss hue retry ko pakad leta hai — login ke bina bhi connected.
export function startWatchdog() {
  if (!sbAdmin) {
    logger.info("[watchdog] DB nahi hai — watchdog off");
    return;
  }
  const tick = async () => {
    try {
      const dbUsers = await listPairedUsers();
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
