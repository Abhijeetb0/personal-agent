// Groq OpenAI-compatible API — free tier limits generous hain
// Multi-model rotation: alag-alag model = alag RPM pool, isliye 429 pe agle model pe turant failover.

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export function cleanText(t: string): string {
  return t.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trim();
}

// Env: GROQ_MODELS="m1,m2,m3" (priority order). Purana GROQ_MODEL bhi chalega. Default list built-in.
function modelList(): string[] {
  const raw = process.env.GROQ_MODELS || process.env.GROQ_MODEL || "";
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const defaults = [
    "groq/compound-mini",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
  ];
  const merged = list.length ? list : defaults;
  return [...new Set(merged)];
}

// 429/rate-limit wala model thodi der ke liye skip (cooldown), taaki har call pe dead model pe time waste na ho
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 60_000;
const DEAD_MODEL_COOLDOWN_MS = 60 * 60_000; // 404/decommissioned model dobara try karne ka koi fayda nahi

function isRateLimitMsg(msg: string): boolean {
  return /429|rate.?limit|rate_limit|quota|too many requests/i.test(msg);
}

// 404 / model_not_found / decommissioned = ye ID mar chuka hai, retry bekar
function isDeadModelMsg(msg: string): boolean {
  return /404|model_not_found|model .* not (found|exist|available)|decommission|deprecated|no longer supported/i.test(msg);
}

// Startup pe live model IDs Render logs me dikhao — 404 debug karna aasan
export async function logAvailableModels(): Promise<void> {
  const key = process.env.GROQ_API_KEY || "";
  if (!key) return;
  try {
    const r = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    } as any);
    if (!r.ok) throw new Error(`models ${r.status}`);
    const j = (await r.json()) as any;
    const ids = (j?.data ?? []).map((m: any) => m.id).filter(Boolean).sort();
    console.log(`[groq] live models (${ids.length}): ${ids.join(", ")}`);
  } catch (e) {
    console.error("[groq] live model list nahi mili:", (e as Error).message.slice(0, 100));
  }
}

// Model ki internal soch user ko kabhi nahi — ye agle model pe failover karega
function looksLikeThinking(t: string): boolean {
  const s = t.trim();
  return (
    /^(the user|user asks|we need|we must|i('ll| will| need| should)|let me|first,?\s+i |okay,? (so|the user)|to answer this|reasoning:|<think>)/i.test(s) ||
    /<think>/i.test(s)
  );
}

async function callOneModel(key: string, model: string, messages: ChatMsg[], maxTokens: number): Promise<string> {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
    signal: AbortSignal.timeout(45000),
  } as any);
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`groq ${r.status} [${model}]: ${t.slice(0, 160)}`);
  }
  const j = (await r.json()) as any;
  const rawContent = String(j?.choices?.[0]?.message?.content ?? "");
  const rawReasoning = String(j?.choices?.[0]?.message?.reasoning ?? "");
  let text = cleanText(rawContent);
  if (!text && rawReasoning) {
    const thought = cleanText(rawReasoning).slice(0, 1500);
    // reasoning me jawab nahi, internal monologue hota hai — user ko bhejoge to "The user asks..." jaisa kachra jayega
    if (looksLikeThinking(thought)) throw new Error(`groq empty content, thinking-only [${model}]`);
    console.log(`[groq] content empty [${model}], reasoning se uthaya`);
    text = thought;
  }
  if (!text) throw new Error(`groq empty reply [${model}]`);
  return text;
}

export async function groqChat(messages: ChatMsg[], maxTokens = 400): Promise<string> {
  const key = process.env.GROQ_API_KEY || "";
  if (!key) throw new Error("GROQ_API_KEY missing");
  const models = modelList();
  const now = Date.now();
  // priority order rakho, bas cooldown wale models ko peeche karo
  const ordered = [...models].sort((a, b) => {
    const ca = cooldowns.get(a) ?? 0;
    const cb = cooldowns.get(b) ?? 0;
    const aCool = ca > now ? 1 : 0;
    const bCool = cb > now ? 1 : 0;
    return aCool - bCool;
  });
  let lastErr: unknown = null;
  for (const model of ordered) {
    const coolUntil = cooldowns.get(model) ?? 0;
    if (coolUntil > now) {
      console.log(`[groq] skip [${model}] (cooldown ${Math.ceil((coolUntil - now) / 1000)}s)`);
      continue;
    }
    try {
      return await callOneModel(key, model, messages, maxTokens);
    } catch (e) {
      lastErr = e;
      const msg = (e as Error).message || "";
      console.error(`[groq] fail [${model}]:`, msg.slice(0, 120));
      if (isDeadModelMsg(msg)) {
        // mara hua model: retry bekar, 1h cooldown + turant agla model
        console.error(`[groq] dead model [${model}], 1h skip`);
        cooldowns.set(model, Date.now() + DEAD_MODEL_COOLDOWN_MS);
        continue;
      }
      if (isRateLimitMsg(msg)) {
        // rate-limit pe BINA RUKE agle model pe jao, is model ko cooldown me dalo
        cooldowns.set(model, Date.now() + COOLDOWN_MS);
        continue;
      }
      // network/5xx/empty pe ek chhota retry isi model pe, phir agla model
      await new Promise((r) => setTimeout(r, 2000));
      try {
        return await callOneModel(key, model, messages, maxTokens);
      } catch (e2) {
        lastErr = e2;
        console.error(`[groq] retry fail [${model}]:`, (e2 as Error).message.slice(0, 120));
      }
    }
  }
  // sab cooldown me the ya fail ho gaye to pehle model pe ek aakhri mauka (cooldown ignore)
  if (lastErr && ordered.every((m) => (cooldowns.get(m) ?? 0) > Date.now())) {
    console.log("[groq] sab models cooldown me, pehle model pe last try...");
    cooldowns.clear();
    try {
      return await callOneModel(key, models[0], messages, maxTokens);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("groq failed");
}

const SYSTEM = `Tum user ka personal WhatsApp assistant ho. Hinglish me short, friendly reply do.
Tumhari capabilities: normal baat-cheet, sawalon ke jawab apni knowledge se, reminders, LeetCode contest info, time/date.
Rules:
- Har sawal ka jawab apni knowledge se do — "mere paas access nahi hai" bolke mana MAT karo. Jo pata hai batao.
- Short reply (2-4 lines max), WhatsApp style.
- Sirf bahut fresh (aaj ki news/score) wali cheez pe kaho ki live web nahi hai, par related background phir bhi batao.
- Hindi/Hinglish me baat karo, English tech words chalenge.`;

// Groq OpenAI-compatible API — free tier limits generous hain
export async function getGroqReply(userText: string, history: string[] = []): Promise<string> {
  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM },
    ...history.slice(-6).map((h, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: h.replace(/^(User|Assistant):\s*/, ""),
    })),
    { role: "user", content: userText },
  ];
  try {
    return await groqChat(messages);
  } catch (e) {
    console.error(`[groq] fail:`, (e as Error).message.slice(0, 160));
    throw e;
  }
}
