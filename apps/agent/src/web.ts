// No-key web search (DuckDuckGo) + page fetch.
// AI khud fetch karke jawab de — har sawal ke liye alag tool nahi.

export type SearchHit = { title: string; snippet: string; url: string };

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x2F;/g, "/")
    .replace(/<[^>]*>/g, "").trim();
}

export async function ddgSearch(query: string, max = 4): Promise<SearchHit[]> {
  // lite endpoint (bot-check nahi lagta), fallback html endpoint
  const attempts: { url: string; init: any; re: RegExp }[] = [
    {
      url: "https://lite.duckduckgo.com/lite/",
      init: {
        method: "POST",
        headers: { "User-Agent": "Mozilla/5.0", "Content-Type": "application/x-www-form-urlencoded" },
        body: "q=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(12000),
      },
      re: /<a[^>]*href="([^"]+)"[^>]*class='result-link'[^>]*>([\s\S]*?)<\/a>[\s\S]*?<td[^>]*class='result-snippet'[^>]*>([\s\S]*?)<\/td>/gi,
    },
    {
      url: "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query),
      init: {
        headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(12000),
      },
      re: /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi,
    },
  ];
  for (const a of attempts) {
    try {
      const r = await fetch(a.url, a.init);
      if (!r.ok) continue;
      const html = await r.text();
      if (html.includes("anomaly")) continue;
      const hits: SearchHit[] = [];
      let m: RegExpExecArray | null;
      while ((m = a.re.exec(html)) && hits.length < max) {
        let url = m[1];
        const ud = url.match(/[?&]uddg=([^&]+)/);
        if (ud) url = decodeURIComponent(ud[1]);
        hits.push({
          title: decodeEntities(m[2]).slice(0, 120),
          snippet: decodeEntities(m[3]).slice(0, 220),
          url: url.startsWith("//") ? "https:" + url : url,
        });
      }
      if (hits.length > 0) return hits;
    } catch (e) {
      console.error("[web] search fail:", (e as Error).message);
    }
  }
  return [];
}

export async function fetchPageText(url: string, maxChars = 3000): Promise<string> {
  try {
    if (!/^https?:\/\//i.test(url)) return "";
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(12000),
    } as any);
    if (!r.ok) return "";
    const ct = r.headers.get("content-type") || "";
    if (!/html/i.test(ct)) return "";
    const html = await r.text();
    const body = (html.match(/<body[\s\S]*<\/body>/i)?.[0] || html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ");
    return decodeEntities(body).replace(/\s+/g, " ").trim().slice(0, maxChars);
  } catch {
    return "";
  }
}

// Fact jaisa sawal? to web context lagao. Greeting/chitchat pe nahi.
export function looksFactual(text: string): boolean {
  if (text.length < 30 && !/[?]$/.test(text.trim()) && !/(kya|kaun|kon|kab|kahan|kaise|kyu|kyon|kitna|kaunsa|kisne|batao)/i.test(text)) return false;
  return /[?]|(kya|kaun|kon|kab|kahan|kaise|kyu|kyon|kitna|kitne|kaunsa|kaunsi|kisne|kis|latest|news|score|price|rate|result|winner|batao|search|google|dekho|pata\s*karo|kaun\s*jeeta|weather|mausam|capital|growth|share\s*price)\b/i.test(text);
}

export function searchContextBlock(hits: SearchHit[]): string {
  if (!hits.length) return "";
  const lines = hits.map((h, i) => `[${i + 1}] ${h.title} — ${h.snippet} (${h.url})`);
  return `\n\nWeb search results (inhe padh ke jawab do, link mat gado):\n${lines.join("\n")}`;
}
