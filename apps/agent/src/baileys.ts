import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import path from "node:path";
import { restoreAuthFromSupabase, saveAuthToSupabase, setStatus } from "./store.js";
import { handleIncomingMessage } from "./handler.js";

const AUTH_DIR = process.env.AUTH_DIR || path.join(process.cwd(), "auth_info");

export const state = {
  sock: null as WASocket | null,
  status: "disconnected" as "qr" | "connected" | "disconnected",
  lastQr: null as string | null,
};

export async function startWhatsApp() {
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
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
      state.status = "qr";
      state.lastQr = qr;
      console.log("[wa] QR mila — dashboard pe scan karo");
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
      const code = (lastDisconnect?.error as any)?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log("[wa] Connection closed, code:", code, "loggedOut:", loggedOut);
      state.status = "disconnected";
      await setStatus("disconnected");
      if (!loggedOut) {
        console.log("[wa] 5 sec me reconnect...");
        setTimeout(() => startWhatsApp().catch(console.error), 5000);
      } else {
        console.log("[wa] Logged out — dobara QR scan karna padega.");
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
