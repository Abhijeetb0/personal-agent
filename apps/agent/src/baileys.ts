import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import path from "node:path";
import fs from "node:fs/promises";
import logger from "./logger.js";
import {
  restoreAuthFromSupabase, saveAuthToSupabase, setStatus,
  clearSupabaseSession, listSessionUsers, listPairedUsers, hasStoredCreds, getOwnerNumber,
} from "./store.js";
import { handleIncomingMessage } from "./handler.js";

const AUTH_ROOT = process.env.AUTH_DIR || path.join(process.cwd(), "auth_info");

export type ConnStatus = "qr" | "connected" | "disconnected";

export interface UserSession {
  userId: string;
  sock: WASocket | null;
  status: ConnStatus;
  lastQr: string | null;
  lastQrAt: number;
  pairingCode: string | null;
  pairingCodeAt: number;
  lastClose: { code: unknown; detail: string; at: number } | null;
  generation: number;
  ownerNumber: string;
  // Self-heal: exponential backoff state (Render sleep / WA idle drop se bachne ke liye)
  reconnectAttempts: number;
  nextRetryAt: number;
  // General fix: QR ghost-loop guard — scan ke bina retry bekar hai
  needsScan: boolean;
  qrTimeouts: number;
}

const sessions = new Map<string, UserSession>();

export function getSession(userId: string): UserSession {
  let s = sessions.get(userId);
  if (!s) {
    s = {
      userId, sock: null, status: "disconnected",
      lastQr: null, lastQrAt: 0, pairingCode: null, pairingCodeAt: 0,
      lastClose: null, generation: 0, ownerNumber: "",
      reconnectAttempts: 0, nextRetryAt: 0,
      needsScan: false, qrTimeouts: 0,
    };
    sessions.set(userId, s);
  }
  return s;
}

export function allSessions(): UserSession[] {
  return [...sessions.values()];
}

function authDir(userId: string): string {
  return path.join(AUTH_ROOT, userId);
}

// Reconnect backoff: 5s -> 30s -> 2min -> 10min cap (WhatsApp ban-risk se bachne ke liye spam nahi)
export const RECONNECT_DELAYS = [5_000, 30_000, 120_000, 600_000];

// General fix: lagatar QR-timeout (scan hi nahi hua) pe auto-retry band — manual scan chahiye.
// Network drop (515/516/503...) pe retry chalta rahega, sirf QR-timeout (408 QR refs) pe rukega.
export const MAX_QR_TIMEOUTS = 5;

export function isQrTimeout(code: unknown, detail: string): boolean {
  return code === 408 && /qr refs attempts ended/i.test(detail || "");
}

export function computeReconnectDelay(attempt: number): number {
  if (attempt <= 0) return RECONNECT_DELAYS[0]!;
  const idx = Math.min(attempt - 1, RECONNECT_DELAYS.length - 1);
  return RECONNECT_DELAYS[idx]!;
}

// Baileys version: har connect pe fetch mat karo (cold-start slow + fail point) — 1 hr cache
let cachedVersion: Awaited<ReturnType<typeof fetchLatestBaileysVersion>>["version"] | null = null;
let cachedVersionAt = 0;
const VERSION_TTL_MS = 60 * 60 * 1000;

async function getBaileysVersion() {
  if (cachedVersion && Date.now() - cachedVersionAt < VERSION_TTL_MS) return cachedVersion;
  const { version } = await fetchLatestBaileysVersion();
  cachedVersion = version;
  cachedVersionAt = Date.now();
  return version;
}

export async function startWhatsApp(userId: string) {
  const s = getSession(userId);
  const myGen = ++s.generation;
  s.ownerNumber = await getOwnerNumber(userId);
  await restoreAuthFromSupabase(userId, authDir(userId));
  const { state: authState, saveCreds } = await useMultiFileAuthState(authDir(userId));
  const version = await getBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: authState,
    // Standard Chrome fingerprint — custom label se pairing reject hota hai
    browser: ["Ubuntu", "Chrome", "120.0.0.0"],
    syncFullHistory: false,
  });
  s.sock = sock;

  sock.ev.on("creds.update", async () => {
    await saveCreds();
    await saveAuthToSupabase(userId, authDir(userId), s.status, s.lastQr ?? undefined);
  });

  sock.ev.on("connection.update", async (u) => {
    if (myGen !== s.generation) return; // purana socket, ignore
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      s.status = "qr";
      s.lastQr = qr;
      s.lastQrAt = Date.now();
      logger.info({ userId: userId.slice(0, 8) }, "[wa] QR mila — 30 sec ke andar scan karo");
      await setStatus(userId, "qr", qr);
      await saveAuthToSupabase(userId, authDir(userId), "qr", qr);
    }
    if (connection === "open") {
      s.status = "connected";
      s.lastQr = null;
      // Success: backoff + QR-timeout counter reset (agla drop phir 5s se shuru hoga)
      s.reconnectAttempts = 0;
      s.nextRetryAt = 0;
      s.qrTimeouts = 0;
      s.needsScan = false;
      logger.info({ userId: userId.slice(0, 8) }, "[wa] Connected!");
      await setStatus(userId, "connected");
      await saveAuthToSupabase(userId, authDir(userId), "connected");
    }
    if (connection === "close") {
      const err = lastDisconnect?.error as any;
      const code = err?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      const detail = String(err?.message || err || "");
      logger.info({ userId: userId.slice(0, 8), code, loggedOut, detail }, "[wa] closed");
      if (myGen !== s.generation) return;
      s.status = "disconnected";
      s.lastClose = { code, detail, at: Date.now() };
      await setStatus(userId, "disconnected");
      // General fix: QR-timeout (scan nahi hua) ko alag gino — N baar ke baad auto-retry band.
      if (isQrTimeout(code, detail)) {
        s.qrTimeouts += 1;
        if (s.qrTimeouts >= MAX_QR_TIMEOUTS) {
          s.needsScan = true;
          s.reconnectAttempts = 0;
          s.nextRetryAt = 0;
          logger.info({ userId: userId.slice(0, 8), qrTimeouts: s.qrTimeouts }, "[wa] QR scan nahi hua — auto-retry band, dashboard se scan karo");
          return;
        }
      }
      if (!loggedOut) {
        s.reconnectAttempts += 1;
        const delay = computeReconnectDelay(s.reconnectAttempts);
        s.nextRetryAt = Date.now() + delay;
        logger.info({ userId: userId.slice(0, 8), attempt: s.reconnectAttempts, delayMs: delay }, "[wa] backoff reconnect scheduled...");
        setTimeout(() => {
          if (myGen === s.generation && !s.needsScan) startWhatsApp(userId).catch((e) => logger.error({ err: e }, "[wa] reconnect fail"));
        }, delay);
      } else {
        // Logged out: retry bekar hai (QR hi chahiye) — watchdog bhi skip karega
        s.reconnectAttempts = 0;
        s.nextRetryAt = 0;
        logger.info({ userId: userId.slice(0, 8) }, "[wa] Logged out — dashboard se 'Naya QR' dabao");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (msg.key.remoteJid === "status@broadcast") continue;
      await handleIncomingMessage(sock, msg, userId).catch((e) =>
        logger.error({ err: e }, "[wa] handler error")
      );
    }
  });
}

// Agent wala SIM number (sirf digits, bina + ke). Pairing code isi pe ayega.
export function normalizePairNumber(raw?: string): string {
  let d = (raw || "").replace(/[^0-9]/g, "");
  d = d.replace(/^0+/, "");
  if (d.length === 10) d = "91" + d; // India default
  if (d.length < 10) throw new Error("Poora number dalo — 10 digit ya 91 ke saath (jaise 91XXXXXXXXXX)");
  return d;
}

export async function requestPairingCode(userId: string, number?: string): Promise<{ code: string; number: string }> {
  const s = getSession(userId);
  if (s.status === "connected") throw new Error("Pehle se connected hai");
  const num = normalizePairNumber(number);
  logger.info({ userId: userId.slice(0, 8), number: num }, "[wa] pairing code manga gaya");
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if ((s.status as string) === "connected") throw new Error("Pehle se connected hai");
    const open = (s.sock as any)?.ws?.readyState === 1;
    if (s.sock && open) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!s.sock) throw new Error("Socket ready nahi — 10 sec ruk ke retry karo");
  try {
    const code = await s.sock.requestPairingCode(num);
    s.pairingCode = code;
    s.pairingCodeAt = Date.now();
    logger.info({ userId: userId.slice(0, 8), code }, "[wa] pairing code ready");
    return { code, number: num };
  } catch (e) {
    throw new Error(`WhatsApp connection unstable hai (${(e as Error).message}) — 15 sec ruk ke fir try karo`);
  }
}

// Dashboard ka "Naya QR" button: aadha-fasa session saaf karke fresh pairing
export async function resetSession(userId: string) {
  const s = getSession(userId);
  s.generation++; // purane socket ke events dead
  try {
    s.sock?.ev.removeAllListeners("connection.update");
    s.sock?.ev.removeAllListeners("creds.update");
    s.sock?.ev.removeAllListeners("messages.upsert");
    (s.sock as any)?.ws?.close?.();
  } catch {}
  s.sock = null;
  s.status = "disconnected";
  s.lastQr = null;
  s.pairingCode = null;
  s.reconnectAttempts = 0;
  s.nextRetryAt = 0;
  s.lastClose = null;
  // Manual reset: QR-loop guard saaf (user khud scan karega)
  s.needsScan = false;
  s.qrTimeouts = 0;
  await fs.rm(authDir(userId), { recursive: true, force: true }).catch(() => {});
  await clearSupabaseSession(userId);
  logger.info({ userId: userId.slice(0, 8) }, "[wa] session reset — fresh QR ban raha hai...");
  await startWhatsApp(userId);
}

export async function sendWhatsAppMessage(userId: string, jid: string, text: string) {
  const s = getSession(userId);
  if (!s.sock) {
    // Socket hi nahi hai — jagao taaki agle tick/retry pe jaye (scheduler sent=false rakhega).
    requestReconnect(userId, { reason: "send-no-sock" });
    throw new Error("WhatsApp connected nahi hai — reconnect chal raha hai, 1 min me retry hoga");
  }
  const wsOpen = (s.sock as any)?.ws?.readyState === 1;
  if (s.status !== "connected" || !wsOpen) {
    // Transient drop: reconnect trigger + 15s tak socket khulne ka wait, phir 1 baar send.
    requestReconnect(userId, { reason: "send-not-open" });
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if (s.status === "connected" && (s.sock as any)?.ws?.readyState === 1) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (s.status !== "connected" || (s.sock as any)?.ws?.readyState !== 1) {
      throw new Error("WhatsApp connected nahi hai — reconnect chal raha hai, 1 min me retry hoga");
    }
  }
  await s.sock.sendMessage(jid, { text });
}

// Boot: jin paired users ki session DB me hai, sab start karo (ghost nahi).
// Retry ke saath taaki Render wake pe transient DB fail me session miss na ho.
export async function startAllSessions() {
  let users: string[] = [];
  for (let i = 0; i < 3; i++) {
    try {
      users = await listPairedUsers();
      break;
    } catch (e) {
      logger.error({ err: e, try: i + 1 }, "[agent] paired users list fail, retry...");
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
  // Fallback: purani list (paired filter fail ho to kam se kam kuch start ho)
  if (users.length === 0) {
    users = await listSessionUsers().catch(() => [] as string[]);
  }
  logger.info({ count: users.length }, "[agent] saved sessions milin, start kar rahe...");
  for (const u of users) {
    ensureSession(u);
  }
}

// Auth-free periodic ensure (login ke bina wake-up): watchdog/interval se chalta hai.
// Sirf paired users, connected/starting/needsScan ko chhedega nahi.
export async function ensureAllSessions(reason = "ensure-loop") {
  let users: string[] = [];
  try {
    users = await listPairedUsers();
  } catch {
    return;
  }
  if (users.length === 0) return;
  for (const u of users) {
    const s = getSession(u);
    if (s.status === "connected" || s.needsScan || starting.has(u)) continue;
    // Khali-creds ghost: DB blob check (memory flag restart pe kho jata hai)
    if (!s.sock && !(await hasStoredCreds(u).catch(() => false))) continue;
    requestReconnect(u, { reason });
  }
}

const starting = new Set<string>();

export function isStarting(userId: string): boolean {
  return starting.has(userId);
}

// Session lazy-start (pehli API call pe) — duplicate socket nahi banega
export function ensureSession(userId: string) {
  const s = getSession(userId);
  if (s.sock || starting.has(userId)) return;
  starting.add(userId);
  startWhatsApp(userId)
    .catch((e) => logger.error({ userId: userId.slice(0, 8), err: e }, "[agent] session start fail"))
    .finally(() => starting.delete(userId));
}

// Watchdog / scheduler ke liye: dead session ko backoff respect karke jagao.
// - connected pe kuch nahi, starting pe kuch nahi (duplicate socket rokna hai)
// - loggedOut (401) pe kabhi auto-retry nahi (QR hi chahiye)
// - needsScan / qr-status pe kabhi auto-retry nahi (manual scan chahiye) — force bhi bypass nahi karega
// - force=false to nextRetryAt ka wait karo (close-handler ka timer + watchdog double-retry na kare)
// - manual=true sirf user action se (reset/pairing/dashboard) — QR guard bypass karega
// Returns true = reconnect shuru kiya, false = skip.
export function requestReconnect(userId: string, opts: { force?: boolean; reason?: string; manual?: boolean } = {}): boolean {
  const s = getSession(userId);
  if (s.status === "connected") return false;
  if (starting.has(userId)) return false;
  // General fix: QR ghost-loop guard (wake-pinger ke force se bhi nahi jagega)
  if (!opts.manual && (s.needsScan || s.status === "qr")) return false;
  const loggedOut = (s.lastClose?.code as number) === DisconnectReason.loggedOut;
  if (loggedOut) return false;
  if (!opts.force && !opts.manual && s.nextRetryAt && Date.now() < s.nextRetryAt) return false;
  starting.add(userId);
  logger.info({ userId: userId.slice(0, 8), reason: opts.reason || "watchdog" }, "[wa] reconnect trigger");
  startWhatsApp(userId)
    .catch((e) => logger.error({ userId: userId.slice(0, 8), err: e }, "[wa] triggered reconnect fail"))
    .finally(() => starting.delete(userId));
  return true;
}
