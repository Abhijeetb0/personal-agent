// Deterministic tools — AI ke bharose nahi, code se pakka jawab.
// Time (IST) + News headlines + Wikipedia search (free, no key).

import { ddgSearch } from "./web.js";

export function tryAnswerTimeQuery(text: string): string | null {
  if (!/(time|samay|baj\s*raha|kitne\s*baje|date|tarikh|din\s*kaun|day|kab\s*hai\s*aaj)/i.test(text)) return null;
  // reminder/contest wale mere paas mat aao
  if (/(remind|yaad|contest)/i.test(text)) return null;
  const now = new Date();
  const time = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `Abhi ${time} (IST) ho raha hai, ${date} hai.`;
}

function extractWikiTopic(text: string): string | null {
  let t = text
    .replace(/(google\s*(pe|par|kar|me)?\s*(search|dekho|batao)?|search\s*(kar|karo|karu)?|internet\s*(pe|par)?)/gi, " ")
    .replace(/(kya\s*hai|kaun\s*hai|kon\s*hai|kya\s*hota\s*hai|ka\s*matlab|ke\s*baare\s*(me|mein)|ke\s*bare\s*me|batao|bataye|explain|kaun|kya)\s*\??/gi, " ")
    .replace(/[?।!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = t.split(" ").filter(Boolean);
  if (words.length === 0 || words.length > 8) return null;
  return words.join(" ");
}

async function wikiSummary(topic: string): Promise<string | null> {
  for (const lang of ["en", "hi"]) {
    try {
      const s = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&srlimit=1&origin=*`,
        { headers: { "User-Agent": "personal-agent" }, signal: AbortSignal.timeout(15000) } as any
      );
      if (!s.ok) continue;
      const j = (await s.json()) as any;
      const title = j?.query?.search?.[0]?.title;
      if (!title) continue;
      const r = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
        { headers: { "User-Agent": "personal-agent" }, signal: AbortSignal.timeout(15000) } as any
      );
      if (!r.ok) continue;
      const p = (await r.json()) as any;
      if (p?.extract) {
        const short = p.extract.split(". ").slice(0, 2).join(". ");
        return short;
      }
    } catch {}
  }
  return null;
}

export async function tryAnswerWikiQuery(text: string): Promise<string | null> {
  if (!/(kya\s*hai|kaun\s*hai|kon\s*hai|kya\s*hota|matlab|baare\s*me|bare\s*me|batao|explain|search|google)/i.test(text)) return null;
  if (/(remind|yaad|contest|time|samay|baj\s*raha|capital|news|trending|khabar)/i.test(text)) return null;
  const topic = extractWikiTopic(text);
  if (!topic) return null;
  if (topic.split(" ").length > 3) return null; // lamba/complex sawal AI+search ke paas jayega
  const ans = await wikiSummary(topic);
  return ans;
}

// Aaj ki khabrein — deterministic headlines (AI fail ho tab bhi chalega)
export async function tryAnswerNewsQuery(text: string): Promise<string | null> {
  if (!/(news|trending|taaza|taza|khabar|headlines|surkhiyan)/i.test(text)) return null;
  if (/(remind|yaad|contest)/i.test(text)) return null;
  const queries = ["top news India today", text.replace(/[?।!]/g, " ")];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const q of queries) {
    const hits = await ddgSearch(q, 5);
    for (const h of hits) {
      if (seen.has(h.url)) continue;
      seen.add(h.url);
      lines.push(`${lines.length + 1}. ${h.title}${h.snippet ? " — " + h.snippet.slice(0, 120) : ""}`);
      if (lines.length >= 5) break;
    }
    if (lines.length >= 5) break;
  }
  if (lines.length === 0) return null;
  return `Aaj ki top khabrein:\n${lines.join("\n")}`;
}
