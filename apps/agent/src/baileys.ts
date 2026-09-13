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
  clearSupabaseSession, listSessionUsers, getOwnerNumber,
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
}

const sessions = new Map<string, UserSession>();

export function getSession(userId: string): UserSession {
  let s = sessions.get(userId);
  if (!s) {
    s = {
      userId, sock: null, status: "disconnected",
      lastQr: null, lastQrAt: 0, pairingCode: null, pairingCodeAt: 0,
      lastClose: null, generation: 0, ownerNumber: "",
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

export async function startWhatsApp(userId: string) {
  const s = getSession(userId);
  const myGen = ++s.generation;
  s.ownerNumber = await getOwnerNumber(userId);
  await restoreAuthFromSupabase(userId, authDir(userId));
  const { state: authState, saveCreds } = await useMultiFileAuthState(authDir(userId));
  const { version } = await fetchLatestBaileysVersion();

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
      logger.info({ userId: userId.slice(0, 8) }, "[wa] Connected!");
      await setStatus(userId, "connected");
      await saveAuthToSupabase(userId, authDir(userId), "connected");
    }
    if (connection === "close") {
      const err = lastDisconnect?.error as any;
      const code = err?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      logger.info({ userId: userId.slice(0, 8), code, loggedOut, detail: err?.message || err }, "[wa] closed");
      if (myGen !== s.generation) return;
      s.status = "disconnected";
      s.lastClose = { code, detail: String(err?.message || err || ""), at: Date.now() };
      await setStatus(userId, "disconnected");
      if (!loggedOut) {
        logger.info({ userId: userId.slice(0, 8) }, "[wa] 5 sec me reconnect...");
        setTimeout(() => {
          if (myGen === s.generation) startWhatsApp(userId).catch((e) => logger.error({ err: e }, "[wa] reconnect fail"));
        }, 5000);
      } else {
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
  await fs.rm(authDir(userId), { recursive: true, force: true }).catch(() => {});
  await clearSupabaseSession(userId);
  logger.info({ userId: userId.slice(0, 8) }, "[wa] session reset — fresh QR ban raha hai...");
  await startWhatsApp(userId);
}

export async function sendWhatsAppMessage(userId: string, jid: string, text: string) {
  const s = getSession(userId);
  if (!s.sock) throw new Error("WhatsApp connected nahi hai");
  await s.sock.sendMessage(jid, { text });
}

// Boot: jin users ki session DB me hai, sab start karo
export async function startAllSessions() {
  const users = await listSessionUsers();
  logger.info({ count: users.length }, "[agent] saved sessions milin, start kar rahe...");
  for (const u of users) {
    ensureSession(u);
  }
}

const starting = new Set<string>();

// Session lazy-start (pehli API call pe) — duplicate socket nahi banega
export function ensureSession(userId: string) {
  const s = getSession(userId);
  if (s.sock || starting.has(userId)) return;
  starting.add(userId);
  startWhatsApp(userId)
    .catch((e) => logger.error({ userId: userId.slice(0, 8), err: e }, "[agent] session start fail"))
    .finally(() => starting.delete(userId));
}
