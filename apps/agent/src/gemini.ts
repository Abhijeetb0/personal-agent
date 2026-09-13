import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatMsg } from "./groq.js";

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
  const names = [process.env.GEMINI_MODEL || "gemini-2.5-flash", "gemini-2.5-flash-lite"];
  models = names.map((m) => gen.getGenerativeModel({ model: m, systemInstruction: SYSTEM }));
  return models;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Brain (tool loop) ke liye ChatMsg interface — groqChat jaisa signature, taaki llm.ts rotate kar sake
const gCool = new Map<string, number>();

function toPrompt(messages: ChatMsg[]): { system: string; prompt: string } {
  const sys = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
  return { system: sys || SYSTEM, prompt: turns };
}

export async function geminiChat(messages: ChatMsg[], maxTokens = 500): Promise<string> {
  const key = process.env.GEMINI_API_KEY || "";
  if (!key) throw new Error("GEMINI_API_KEY missing");
  const gen = new GoogleGenerativeAI(key);
  const names = [...new Set([process.env.GEMINI_MODEL || "gemini-2.5-flash", "gemini-2.5-flash-lite"])];
  const { system, prompt } = toPrompt(messages);
  const now = Date.now();
  const ordered = [...names].sort(
    (a, b) => (((gCool.get(a) ?? 0) > now) ? 1 : 0) - (((gCool.get(b) ?? 0) > now) ? 1 : 0)
  );
  let lastErr: unknown = null;
  for (const name of ordered) {
    if ((gCool.get(name) ?? 0) > now) {
      console.log(`[gemini] skip [${name}] cooldown`);
      continue;
    }
    try {
      const m = gen.getGenerativeModel({
        model: name,
        systemInstruction: system,
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      });
      const res = await m.generateContent(prompt);
      const text = res.response.text().trim();
      if (!text) throw new Error(`gemini empty reply [${name}]`);
      return text;
    } catch (e) {
      lastErr = e;
      const msg = (e as Error).message || "";
      console.error(`[gemini] fail [${name}]:`, msg.slice(0, 120));
      if (/401|403|api[_ ]?key|permission/i.test(msg)) break; // key hi galat — dusra model bekar
      if (/404|not.?found|not.?supported/i.test(msg)) {
        gCool.set(name, Date.now() + 3600_000);
        continue;
      }
      if (/429|quota|exhausted|rate/i.test(msg)) {
        gCool.set(name, Date.now() + 60_000);
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("gemini failed");
}

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
