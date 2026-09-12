import { brainReply } from "./brain.js";
import { getGroqReply } from "./groq.js";
import { getReply as getGeminiReply } from "./gemini.js";

// Brain (samajh + tools) pehle. Sab fail ho to plain AI fallback.
export async function getAiReply(userText: string, history: string[] = []): Promise<string> {
  try {
    return await brainReply(userText, history);
  } catch (e) {
    console.error("[ai] brain failed, plain fallback:", (e as Error).message.slice(0, 120));
  }
  let lastErr: unknown = null;
  try {
    if (process.env.GROQ_API_KEY) return await getGroqReply(userText, history.slice(-4));
  } catch (e) {
    lastErr = e;
  }
  try {
    if (process.env.GEMINI_API_KEY) return await getGeminiReply(userText, history.slice(-4));
  } catch (e) {
    lastErr = e;
  }
  throw lastErr instanceof Error ? lastErr : new Error("koi AI available nahi");
}
