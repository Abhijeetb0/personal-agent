import { getGroqReply } from "./groq.js";
import { getReply as getGeminiReply } from "./gemini.js";

// Order: Groq (generous free limits) -> Gemini (fallback)
export async function getAiReply(userText: string, history: string[] = []): Promise<string> {
  const order = (process.env.AI_ORDER || "groq,gemini").split(",").map((s) => s.trim());
  let lastErr: unknown = null;
  for (const name of order) {
    try {
      if (name === "groq" && process.env.GROQ_API_KEY) return await getGroqReply(userText, history);
      if (name === "gemini" && process.env.GEMINI_API_KEY) return await getGeminiReply(userText, history);
    } catch (e) {
      lastErr = e;
      console.error(`[ai] ${name} failed, next try kar rahe...`);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("koi AI available nahi");
}
