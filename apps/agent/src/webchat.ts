import logger from "./logger.js";
import { tryFastLane } from "./fastlane.js";
import { getAiReply } from "./ai.js";
import { logMessage, recentHistory } from "./db.js";
import { salvageProtocolText } from "./brain.js";
import { getOwnerNumber, getWebMirror } from "./store.js";
import { getSession, sendWhatsAppMessage } from "./baileys.js";

// Dashboard web-chat: WhatsApp jaisa brain, par WhatsApp pe kuch nahi jata.
// History owner-number se uthate hain (context continuity), log "webchat" se
// (WA history filter me ghulega nahi, chat tab me alag dikhega).

export const WEBCHAT_FROM = "webchat";
export const WEBCHAT_MAX = 1000;

// Kachcha protocol JSON user ko KABHI nahi (handler.ts wala guard, web ke liye)
export function guardReply(reply: string): string {
  const r = (reply || "").trim();
  if (!r) throw new Error("khaali jawab");
  if (r.startsWith("{")) {
    return salvageProtocolText(r) ?? "Lamba jawab adhoora kat gaya — thoda chhota karke mango.";
  }
  return reply;
}

export function validateWebChat(text: unknown): string {
  const t = String(text || "").trim();
  if (!t) throw new Error("message khaali hai");
  if (t.length > WEBCHAT_MAX) throw new Error(`message ${WEBCHAT_MAX} chars se chhota rakho`);
  return t;
}

export async function webChatReply(userId: string, raw: unknown): Promise<string> {
  const text = validateWebChat(raw);
  const owner = (await getOwnerNumber(userId)) || "";
  const from = owner || WEBCHAT_FROM;
  let reply: string;
  try {
    const fast = await tryFastLane(text);
    if (fast) {
      await logMessage(userId, WEBCHAT_FROM, text, fast, true);
      await mirrorToWhatsApp(userId, owner, fast);
      return fast;
    }
  } catch (e) {
    logger.error({ err: e }, "[webchat] fastlane fail");
  }
  const history = await recentHistory(userId, from);
  reply = guardReply(await getAiReply(text, history, userId));
  await logMessage(userId, WEBCHAT_FROM, text, reply, true);
  await mirrorToWhatsApp(userId, owner, reply);
  return reply;
}

// Mirror: web wala jawab WhatsApp pe bhi (toggle on + connected ho to).
// Fail ho to sirf log — web reply KABHI nahi rukega.
async function mirrorToWhatsApp(userId: string, owner: string, reply: string) {
  try {
    if (!(await getWebMirror(userId))) return;
    if (!owner) return;
    if (getSession(userId).status !== "connected") {
      logger.info({ userId: userId.slice(0, 8) }, "[webchat] mirror skip: WhatsApp connected nahi");
      return;
    }
    await sendWhatsAppMessage(userId, `${owner}@s.whatsapp.net`, `💬 (web) ${reply}`);
    logger.info({ userId: userId.slice(0, 8) }, "[webchat] mirrored to WhatsApp");
  } catch (e) {
    logger.error({ err: e }, "[webchat] mirror fail (web reply ok)");
  }
}
