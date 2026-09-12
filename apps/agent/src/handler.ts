import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { extractText, senderNumber } from "./handler.utils.js";
import { isOwner } from "./whitelist.js";
import { getReply } from "./gemini.js";
import { logMessage, recentHistory } from "./db.js";
import { tryHandleReminderCommand } from "./reminders.js";

export async function handleIncomingMessage(sock: WASocket, m: WAMessage) {
  const text = extractText(m);
  const from = senderNumber(m);
  if (!text || !from) return;

  // 1. Whitelist: sirf owner ko reply
  if (!isOwner(from)) {
    console.log(`[guard] non-owner ${from} ignored`);
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

  // 3. Normal chat -> Gemini
  try {
    const history = await recentHistory(from);
    const reply = await getReply(text, history);
    await sock.sendMessage(m.key.remoteJid!, { text: reply });
    await logMessage(from, text, reply, true);
  } catch (e) {
    console.error("[gemini] fail:", (e as Error).message);
    await sock.sendMessage(m.key.remoteJid!, {
      text: "Abhi thoda issue hai, 1 min me fir bolo. (AI key/limit check karo)",
    });
  }
}
