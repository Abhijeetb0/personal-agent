import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM = `Tum user ka personal WhatsApp assistant ho. Hinglish me short, friendly reply do.
Tumhari capabilities: normal baat-cheet, sawalon ke jawab apni knowledge se, reminders, LeetCode contest info, time/date.
Rules:
- Har sawal ka jawab apni knowledge se do — "mere paas access nahi hai" bolke mana MAT karo. Jo pata hai batao.
- Short reply (2-4 lines max), WhatsApp style.
- Sirf bahut fresh (aaj ki news/score) wali cheez pe kaho ki live web nahi hai, par related background phir bhi batao.
- Hindi/Hinglish me baat karo, English tech words chalenge.`;

let models: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>[] = [];

function getModels() {
  if (models.length) return models;
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const gen = new GoogleGenerativeAI(key);
  // pehla primary, baaki 429/quota pe fallback (alag quota pool)
  const names = [process.env.GEMINI_MODEL || "gemini-2.0-flash", "gemini-2.0-flash-lite"];
  models = names.map((m) => gen.getGenerativeModel({ model: m, systemInstruction: SYSTEM }));
  return models;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getReply(userText: string, history: string[] = []): Promise<string> {
  const context = history.slice(-6).join("\n");
  const prompt = context ? `Pehli baat-cheet:\n${context}\n\nUser: ${userText}` : `User: ${userText}`;
  let lastErr: unknown = null;
  for (const m of getModels()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await m.generateContent(prompt);
        const text = res.response.text().trim();
        return text || "Samajh gaya! Batao aur kya karna hai?";
      } catch (e) {
        lastErr = e;
        const msg = (e as Error).message || "";
        console.error(`[gemini] fail (attempt ${attempt + 1}):`, msg.slice(0, 160));
        if (!/429|quota|exhausted|rate/i.test(msg)) break; // sirf rate-limit pe retry
        await sleep(10000);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("gemini failed");
}
