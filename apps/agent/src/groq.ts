const SYSTEM = `Tum user ka personal WhatsApp assistant ho. Hinglish me short, friendly reply do.
Tumhari capabilities: normal baat-cheet, sawalon ke jawab apni knowledge se, reminders, LeetCode contest info, time/date.
Rules:
- Har sawal ka jawab apni knowledge se do — "mere paas access nahi hai" bolke mana MAT karo. Jo pata hai batao.
- Short reply (2-4 lines max), WhatsApp style.
- Sirf bahut fresh (aaj ki news/score) wali cheez pe kaho ki live web nahi hai, par related background phir bhi batao.
- Hindi/Hinglish me baat karo, English tech words chalenge.`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Groq OpenAI-compatible API — free tier limits generous hain
export async function getGroqReply(userText: string, history: string[] = []): Promise<string> {
  const key = process.env.GROQ_API_KEY || "";
  if (!key) throw new Error("GROQ_API_KEY missing");
  const model = process.env.GROQ_MODEL || "qwen/qwen3.6-27b";
  const messages = [
    { role: "system", content: SYSTEM },
    ...history.slice(-6).map((h, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: h.replace(/^(User|Assistant):\s*/, ""),
    })),
    { role: "user", content: userText },
  ];
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages, max_tokens: 400, temperature: 0.7 }),
        signal: AbortSignal.timeout(45000),
      } as any);
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(`groq ${r.status}: ${t.slice(0, 160)}`);
      }
      const j = (await r.json()) as any;
      let text = String(j?.choices?.[0]?.message?.content || "").trim();
      // reasoning leak saaf karo — band tag na ho (cut-off) to <think> se aage sab hatao
      text = text.replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trim();
      if (!text) throw new Error("groq empty reply (sirf reasoning aayi)");
      return text;
    } catch (e) {
      lastErr = e;
      console.error(`[groq] fail (attempt ${attempt + 1}):`, (e as Error).message.slice(0, 160));
      await sleep(5000);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("groq failed");
}
