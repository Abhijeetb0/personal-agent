// Groq OpenAI-compatible API — free tier limits generous hain

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export function cleanText(t: string): string {
  return t.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trim();
}

export async function groqChat(messages: ChatMsg[], maxTokens = 400): Promise<string> {
  const key = process.env.GROQ_API_KEY || "";
  if (!key) throw new Error("GROQ_API_KEY missing");
  const model = process.env.GROQ_MODEL || "groq/compound-mini";
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.7 }),
        signal: AbortSignal.timeout(45000),
      } as any);
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`groq ${r.status}: ${t.slice(0, 160)}`);
      }
      const j = (await r.json()) as any;
      const rawContent = String(j?.choices?.[0]?.message?.content ?? "");
      const rawReasoning = String(j?.choices?.[0]?.message?.reasoning ?? "");
      let text = cleanText(rawContent);
      if (!text && rawReasoning) {
        console.log("[groq] content empty, reasoning se uthaya");
        text = cleanText(rawReasoning).slice(0, 1500);
      }
      if (!text) throw new Error("groq empty reply");
      return text;
    } catch (e) {
      lastErr = e;
      console.error(`[groq] fail (attempt ${attempt + 1}):`, (e as Error).message.slice(0, 120));
      await new Promise((r) => setTimeout(r, 3000));
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
