// Sirf OWNER_NUMBER ko reply. Baki sab ignore (privacy + ban-risk kam).
// v7 me sender aksar @lid me aata hai — PN match na ho to LID mapping se verify karo.
import type { WASocket } from "@whiskeysockets/baileys";
import { isLidUser } from "@whiskeysockets/baileys";

export function normalize(num: string): string {
  // ":0" jaise device suffix aur "@lid"/"@s.whatsapp.net" हटाओ, sirf digits rakho
  return String(num || "")
    .split(":")[0]
    .split("@")[0]
    .replace(/[^0-9]/g, "");
}

export function getOwner(): string {
  return normalize(process.env.OWNER_NUMBER || "917761815151");
}

export async function isOwner(sock: WASocket | null, from: string, rawJid?: string, owner?: string): Promise<boolean> {
  const f = normalize(from);
  const o = normalize(owner || "");
  if (!f || !o) return false;
  if (f === o) return true;
  // last 10 digit match (91 prefix / 0 prefix variations)
  if (f.slice(-10) === o.slice(-10)) return true;
  // LID sender? owner ka LID nikaal ke compare karo (dono direction try karo)
  if (rawJid && isLidUser(rawJid) && sock) {
    const withTimeout = <T>(p: Promise<T>, ms = 10000): Promise<T | null> =>
      Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), ms))]);
    try {
      const ownerPn = `${o}@s.whatsapp.net`;
      const ownerLid = await withTimeout(sock.signalRepository.lidMapping.getLIDForPN(ownerPn));
      console.log(`[lid-debug] ownerPn=${ownerPn} ownerLid=${ownerLid} sender=${rawJid}`);
      if (ownerLid && normalize(ownerLid) === f) {
        console.log(`[guard] owner LID match: ${rawJid}`);
        return true;
      }
      const pn = await withTimeout(sock.signalRepository.lidMapping.getPNForLID(rawJid));
      if (pn && normalize(pn) === o) {
        console.log(`[guard] owner PN match via LID: ${rawJid} -> ${pn}`);
        return true;
      }
    } catch (e) {
      console.error("[guard] lid check fail:", (e as Error).message);
    }
  }
  return false;
}
