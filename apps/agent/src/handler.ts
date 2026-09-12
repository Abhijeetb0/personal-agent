import type { WASocket, WAMessage } from "@whiskeysockets/baileys";

// Step-2 me sirf structure. Step-4 (whitelist+gemini) me AI reply judhega,
// Step-5 me reminder logic judhega. Abhi: message log + owner check ka skeleton.
export function extractText(m: WAMessage): string {
  return (
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    ""
  ).trim();
}

export function senderNumber(m: WAMessage): string {
  // remoteJid like 917761815151@s.whatsapp.net (group me participant alag)
  const jid = m.key.participant || m.key.remoteJid || "";
  return jid.split("@")[0].replace(/[^0-9]/g, "");
}

export async function handleIncomingMessage(_sock: WASocket, m: WAMessage) {
  const text = extractText(m);
  const from = senderNumber(m);
  if (!text) return;
  const owner = (process.env.OWNER_NUMBER || "917761815151").replace(/[^0-9]/g, "");
  const isOwner = from === owner || from.endsWith(owner.slice(-10));
  console.log(`[msg] from=${from} isOwner=${isOwner} text=${text.slice(0, 80)}`);
  // TODO step-4: non-owner -> ignore + DB log; owner -> gemini reply
  // TODO step-5: reminder intent -> scheduler
}
