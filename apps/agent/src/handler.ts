import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import logger from "./logger.js";
import { extractText, senderNumber } from "./handler.utils.js";
import { isOwner } from "./whitelist.js";
import { getAiReply } from "./ai.js";
import { logMessage, recentHistory } from "./db.js";
import { tryFastLane } from "./fastlane.js";
import { ddgSearch, looksFactual } from "./web.js";
import { getSession } from "./baileys.js";
import { salvageProtocolText } from "./brain.js";

export async function handleIncomingMessage(sock: WASocket, m: WAMessage, userId: string) {
  const text = extractText(m);
  const from = await senderNumber(sock, m);
  const rawJid = m.key.participant || m.key.remoteJid || "";
  if (!text || !from) return;

  const owner = getSession(userId).ownerNumber;

  // 1. Whitelist: sirf owner ko reply
  if (!(await isOwner(sock, from, rawJid, owner))) {
    logger.info({ from, rawJid }, "[guard] non-owner ignored");
    await logMessage(userId, from, text, null, false);
    return;
  }

  // 2. Fast-lane: pakke sawal (time/explicit-contest) bina AI ke.
  // Ambiguous ("uske/iske") ya complex sab brain samjhega.
  try {
    const fast = await tryFastLane(text);
    if (fast) {
      await sock.sendMessage(m.key.remoteJid!, { text: fast });
      await logMessage(userId, from, text, fast, true);
      return;
    }
  } catch (e) {
    logger.error({ err: e }, "[fastlane] fail");
  }

  // 3. Brain: samjho -> tool chahiye to chalao -> jawab do
  try {
    logger.info("[msg] brain soch raha...");
    const history = await recentHistory(userId, from);
    let reply = await getAiReply(text, history, userId);
    // Aakhri safety net: kachcha protocol JSON user ko KABHI nahi
    if (reply.trim().startsWith("{")) {
      logger.error("[guard] protocol leak pakda, salvage kar rahe...");
      reply = salvageProtocolText(reply) ?? "Lamba jawab adhoora kat gaya — thoda chhota karke mango (jaise 500 words me).";
    }
    logger.info({ chars: reply.length }, "[msg] reply ready");
    await sock.sendMessage(m.key.remoteJid!, { text: reply });
    await logMessage(userId, from, text, reply, true);
  } catch (e) {
    logger.error({ err: e }, "[ai] fail");
    // AI down? factual sawal ho to search snippets hi bhej do — khaali haath nahi.
    // Creative kaam (likho/banao/essay) me search snippets kachra lagte hain ("Viral girl" jaisa), waha seedha issue bolo.
    let fallback = "Abhi thoda issue hai, 1 min me fir bolo. (AI key/limit check karo)";
    try {
      if (looksFactual(text) && !/likh|bnao|essay|story|kahani|translate|hinglish|architecture|roadmap/i.test(text)) {
        const hits = await ddgSearch(text, 3);
        if (hits.length > 0) {
          fallback = "AI busy hai, par ye mila:\n" + hits.map((h, i) => `${i + 1}. ${h.title} — ${h.snippet.slice(0, 130)}`).join("\n");
        }
      }
    } catch {}
    await sock.sendMessage(m.key.remoteJid!, { text: fallback });
    await logMessage(userId, from, text, fallback, true);
  }
}
