import logger from "./logger.js";
import { brainReply } from "./brain.js";
import { getGroqReply } from "./groq.js";
import { getReply as getGeminiReply } from "./gemini.js";

// Brain (samajh + tools) pehle. Sab fail ho to plain AI fallback.
export async function getAiReply(userText: string, history: string[] = [], userId = "owner"): Promise<string> {
  try {
    return await brainReply(userText, history, userId);
  } catch (e) {
    const msg = (e as Error).message || "";
    logger.error({ err: msg.slice(0, 120) }, "[ai] brain failed, plain fallback");
    if (/429|rate|limit|empty reply/i.test(msg)) {
      logger.info("[ai] 12s cooldown, retry...");
      await new Promise((r) => setTimeout(r, 12000));
      try {
        return await brainReply(userText, history, userId);
      } catch (e2) {
        logger.error({ err: (e2 as Error).message.slice(0, 120) }, "[ai] retry failed");
      }
    }
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
