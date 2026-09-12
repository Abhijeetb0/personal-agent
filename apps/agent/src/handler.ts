import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { extractText, senderNumber } from "./handler.utils.js";
import { isOwner } from "./whitelist.js";
import { getAiReply } from "./ai.js";
import { logMessage, recentHistory } from "./db.js";
import { ddgSearch, looksFactual } from "./web.js";

export async function handleIncomingMessage(sock: WASocket, m: WAMessage) {
  const text = extractText(m);
  const from = await senderNumber(sock, m);
  const rawJid = m.key.participant || m.key.remoteJid || "";
  if (!text || !from) return;

  // 1. Whitelist: sirf owner ko reply
  if (!(await isOwner(sock, from, rawJid))) {
    console.log(`[guard] non-owner ${from} (${rawJid}) ignored`);
    await logMessage(from, text, null, false);
    return;
  }

  // 2. Brain: samjho -> tool chahiye to chalao -> jawab do
  try {
    const history = await recentHistory(from);
    const reply = await getAiReply(text, history);
    console.log(`[msg] reply ready (${reply.length} chars), bhej rahe...`);
    await sock.sendMessage(m.key.remoteJid!, { text: reply });
    await logMessage(from, text, reply, true);
  } catch (e) {
    console.error("[ai] fail:", (e as Error).message);
    // AI down? factual sawal ho to search snippets hi bhej do — khaali haath nahi
    let fallback = "Abhi thoda issue hai, 1 min me fir bolo. (AI key/limit check karo)";
    try {
      if (looksFactual(text)) {
        const hits = await ddgSearch(text, 3);
        if (hits.length > 0) {
          fallback = "AI busy hai, par ye mila:\n" + hits.map((h, i) => `${i + 1}. ${h.title} — ${h.snippet.slice(0, 130)}`).join("\n");
        }
      }
    } catch {}
    await sock.sendMessage(m.key.remoteJid!, { text: fallback });
    await logMessage(from, text, fallback, true);
  }
}
