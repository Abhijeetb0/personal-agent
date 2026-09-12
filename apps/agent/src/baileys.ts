import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import path from "node:path";
import fs from "node:fs/promises";
import { restoreAuthFromSupabase, saveAuthToSupabase, setStatus, clearSupabaseSession } from "./store.js";
import { handleIncomingMessage } from "./handler.js";

const AUTH_DIR = process.env.AUTH_DIR || path.join(process.cwd(), "auth_info");

// Purane socket ke events naye session se na takraye, isliye generation guard.
let generation = 0;

export const state = {
  sock: null as WASocket | null,
  status: "disconnected" as "qr" | "connected" | "disconnected",
  lastQr: null as string | null,
  lastQrAt: 0,
  pairingCode: null as string | null,
  pairingCodeAt: 0,
};

// Agent wala SIM number (sirf digits, bina + ke). Pairing code isi pe ayega.
export function getAgentNumber(): string {
  return (process.env.AGENT_NUMBER || "").replace(/[^0-9]/g, "");
}

// QR scan fail ho to ye code phone me type karo:
// WhatsApp → Linked Devices → Link a Device → "Link with phone number instead"
export async function requestPairingCode(): Promise<string> {
  if (!state.sock) throw new Error("Socket ready nahi — 10 sec ruk ke retry karo");
  if (state.status === "connected") throw new Error("Pehle se connected hai");
  const num = getAgentNumber();
  if (num.length < 10) throw new Error("AGENT_NUMBER env me agent SIM ka poora number dalo (bina + ke)");
  const code = await state.sock.requestPairingCode(num);
  state.pairingCode = code;
  state.pairingCodeAt = Date.now();
  console.log(`[wa] pairing code: ${code} (1-2 min me phone me dalo)`);
  return code;
}

export async function startWhatsApp() {
  const myGen = ++generation;
  await restoreAuthFromSupabase(AUTH_DIR);
  const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: authState,
    printQRInTerminal: true, // Render logs me bhi QR dikhega
    browser: ["PersonalAgent", "Chrome", "1.0"],
    syncFullHistory: false,
  });
  state.sock = sock;

  sock.ev.on("creds.update", async () => {
    await saveCreds();
    await saveAuthToSupabase(AUTH_DIR, state.status, state.lastQr ?? undefined);
  });

  sock.ev.on("connection.update", async (u) => {
    if (myGen !== generation) return; // purana socket, ignore
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      state.status = "qr";
      state.lastQr = qr;
      state.lastQrAt = Date.now();
      console.log("[wa] QR mila — 30 sec ke andar scan karo");
      await setStatus("qr", qr);
      await saveAuthToSupabase(AUTH_DIR, "qr", qr);
    }
    if (connection === "open") {
      state.status = "connected";
      state.lastQr = null;
      console.log("[wa] Connected! Agent online hai.");
      await setStatus("connected");
      await saveAuthToSupabase(AUTH_DIR, "connected");
    }
    if (connection === "close") {
      const err = lastDisconnect?.error as any;
      const code = err?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log("[wa] Connection closed, code:", code, "loggedOut:", loggedOut, "detail:", err?.message || err);
      if (myGen !== generation) return;
      state.status = "disconnected";
      await setStatus("disconnected");
      if (!loggedOut) {
        console.log("[wa] 5 sec me reconnect...");
        setTimeout(() => {
          if (myGen === generation) startWhatsApp().catch(console.error);
        }, 5000);
      } else {
        console.log("[wa] Logged out — dashboard se 'Naya QR' dabao.");
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const m of messages) {
      // apne bheje hue + status broadcast ignore
      if (m.key.fromMe) continue;
      if (m.key.remoteJid === "status@broadcast") continue;
      await handleIncomingMessage(sock, m).catch((e) =>
        console.error("[wa] handler error:", e)
      );
    }
  });
}

export async function sendWhatsAppMessage(jid: string, text: string) {
  if (!state.sock) throw new Error("WhatsApp connected nahi hai");
  await state.sock.sendMessage(jid, { text });
}

// Dashboard ka "Naya QR" button: aadhi-pairing wala purana session poori tarah
// saaf karke bilkul fresh QR banao. "Couldn't link device" ka sabse pakka fix.
export async function resetSession() {
  generation++; // purane socket ke events dead
  try {
    state.sock?.ev.removeAllListeners("connection.update");
    state.sock?.ev.removeAllListeners("creds.update");
    state.sock?.ev.removeAllListeners("messages.upsert");
    (state.sock as any)?.ws?.close?.();
  } catch {}
  state.sock = null;
  state.status = "disconnected";
  state.lastQr = null;
  state.pairingCode = null;
  await fs.rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {});
  await clearSupabaseSession();
  console.log("[wa] session reset — fresh QR ban raha hai...");
  await startWhatsApp();
}
