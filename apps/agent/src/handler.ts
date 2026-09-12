import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { extractText, senderNumber } from "./handler.utils.js";
import { isOwner } from "./whitelist.js";
import { getAiReply } from "./ai.js";
import { logMessage, recentHistory } from "./db.js";
import { tryHandleReminderCommand, tryAnswerContestQuery } from "./reminders.js";
import { tryAnswerTimeQuery, tryAnswerWikiQuery, tryAnswerNewsQuery } from "./tools.js";
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

  // 2. Reminder command? ("leetcode contest se 30 min pehle remind kar")
  const reminderResp = await tryHandleReminderCommand(text);
  if (reminderResp) {
    await sock.sendMessage(m.key.remoteJid!, { text: reminderResp });
    await logMessage(from, text, reminderResp, true);
    return;
  }

  // 2b. Contest Q&A — next/last/usse-pehle/contest <number> (real API)
  const contestResp = await tryAnswerContestQuery(text);
  if (contestResp) {
    await sock.sendMessage(m.key.remoteJid!, { text: contestResp });
    await logMessage(from, text, contestResp, true);
    return;
  }

  // 2c. Time/date? — server clock se pakka jawab
  const timeResp = tryAnswerTimeQuery(text);
  if (timeResp) {
    await sock.sendMessage(m.key.remoteJid!, { text: timeResp });
    await logMessage(from, text, timeResp, true);
    return;
  }

  // 2d. "X kya hai?" (short definitional) — Wikipedia se real jawab
  const wikiResp = await tryAnswerWikiQuery(text);
  if (wikiResp) {
    await sock.sendMessage(m.key.remoteJid!, { text: wikiResp });
    await logMessage(from, text, wikiResp, true);
    return;
  }

  // 2e. News/trending — deterministic headlines (AI ke bina bhi chalega)
  const newsResp = await tryAnswerNewsQuery(text);
  if (newsResp) {
    await sock.sendMessage(m.key.remoteJid!, { text: newsResp });
    await logMessage(from, text, newsResp, true);
    return;
  }

  // 3. Normal chat -> AI (Groq -> Gemini fallback)
  try {
    console.log(`[msg] owner verified, AI reply bana rahe...`);
    const history = await recentHistory(from);
    const reply = await getAiReply(text, history);
    console.log(`[msg] AI reply mila (${reply.length} chars), bhej rahe...`);
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
