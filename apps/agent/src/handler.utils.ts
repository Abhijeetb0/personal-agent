import type { WAMessage } from "@whiskeysockets/baileys";

export function extractText(m: WAMessage): string {
  return (
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    ""
  ).trim();
}

export function senderNumber(m: WAMessage): string {
  const jid = m.key.participant || m.key.remoteJid || "";
  return jid.split("@")[0].replace(/[^0-9]/g, "");
}
