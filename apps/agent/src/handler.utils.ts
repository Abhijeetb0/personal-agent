import type { WAMessage, WASocket } from "@whiskeysockets/baileys";
import { isLidUser } from "@whiskeysockets/baileys";
import { normalize } from "./whitelist.js";

export function extractText(m: WAMessage): string {
  return (
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    ""
  ).trim();
}

// v7 me sender kabhi @lid (privacy ID) me aata hai — use PN se resolve karo,
// warna owner whitelist match nahi hogi.
export async function senderNumber(sock: WASocket, m: WAMessage): Promise<string> {
  const jid = m.key.participant || m.key.remoteJid || "";
  if (isLidUser(jid)) {
    try {
      const pn = await sock.signalRepository.lidMapping.getPNForLID(jid);
      console.log(`[lid-debug] jid=${jid} pn=${pn}`);
      if (pn) return normalize(pn);
      console.log(`[lid] PN mapping nahi mili: ${jid}`);
    } catch (e) {
      console.error("[lid] resolve fail:", (e as Error).message);
    }
  }
  return normalize(jid);
}
