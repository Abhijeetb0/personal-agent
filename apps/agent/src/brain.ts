import { groqChat, type ChatMsg } from "./groq.js";
import {
  allLeetCodeContests, pastContests, upcomingContests, contestQuestions, formatIST,
} from "./leetcode.js";
import { saveReminder } from "./reminders.js";
import { wikiSummary, tryAnswerNewsQuery } from "./tools.js";
import { ddgSearch, searchContextBlock } from "./web.js";

const BRAIN_SYSTEM = `Tum user ka personal WhatsApp assistant ho. Hinglish me short reply do (2-4 lines, WhatsApp style).
Tum user ka matlab SAMAJHO — exact words match karna zaruri nahi. Jaise "us se pehle wala", "pichla", "previous one" sab ka matlab pichla contest hota hai.
"uske/isne/ye/wo" jaise shabd hamesha RECENT conversation se jodo — pichle 2-4 messages dekho ki baat kis topic pe thi (contest? news? aam?). Galat topic pakadna badi galti hai; unsure ho to recent topic ko priority do.

[CURRENT TIME: {NOW_IST} IST]

Tumhare paas ye TOOLS hain. Har jawab SIRF JSON me do, aur kuch nahi:
{"action":"reply","text":"..."} — seedha jawab (chit-chat, knowledge wale sawal)
{"action":"tool","name":"...","args":{...}} — jab live data/reminder chahiye:

1. contest — LeetCode contest info. args: {"which":"next"|"last"|"previous"|"specific", "number":518, "ctype":"weekly"|"biweekly"}
   - next = aane wala, last = ho chuka latest, previous = last se pehle wala, specific = number se
   - "us se pehle wala / pichle se pehle / second last" = previous
2. remind — reminder set karo. args: {"title":"...","remindAt":"ISO-datetime"}
   - remindAt hamesha CURRENT TIME ke baad ka nikalo (relative samajh ke: "10 min me", "contest se 30 min pehle" ke liye pehle contest tool se time lo, fir remind call karo)
   - title short rakho
3. time_now — args: {} — current time/date
4. wiki — args: {"topic":"..."} — kisi cheez ki definition/background
5. web_search — args: {"query":"..."} — fresh/info sawal (news, rate, score, capital, facts)
6. news — args: {} — aaj ki top headlines

Rules:
- Tool result milne ke baad use padh ke user ko Hinglish me jawab do (JSON nahi, seedha text reply action me).
- "mere paas access nahi hai" bolke mana MAT karo — tool use karo ya knowledge se batao.
- Ek message me max 3 tool calls. Pehle se mili info dobara mat mango.

MANDATORY (galat info sabse badi galti hai):
- LeetCode contest ka naam/date/problems puche to KABHI yaad se mat batao — pehle contest tool CALL karna hi padega, fir usi result se jawab do.
- Reminder ko bola ho to remind tool se SAVE karna hi padega — zubani "kar dunga" bolna kaafi nahi.
- Time/date puche to time_now tool use karo, andaza mat lagao.`;

type BrainAction =
  | { action: "reply"; text: string }
  | { action: "tool"; name: string; args: Record<string, any> };

function parseAction(raw: string): BrainAction | null {
  const clean = raw.replace(/```json|```/g, "").trim();
  const s = clean.indexOf("{");
  const e = clean.lastIndexOf("}");
  if (s === -1 || e <= s) return null;
  try {
    const o = JSON.parse(clean.slice(s, e + 1));
    if (o.action === "reply" && typeof o.text === "string") return o;
    if (o.action === "tool" && typeof o.name === "string") return { action: "tool", name: o.name, args: o.args || {} };
  } catch {}
  return null;
}

function fmtContestList(name: string, startAt: Date, qs: { title: string }[]): string {
  const lines = qs.map((q, i) => `${i + 1}. ${q.title}`).join("\n");
  return `${name} (${formatIST(startAt)} IST)\nProblems:\n${lines}`;
}

async function runTool(name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    case "time_now": {
      const now = new Date();
      const t = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
      const d = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });
      return `Abhi ${t} IST, ${d} hai.`;
    }
    case "contest": {
      const all = await allLeetCodeContests();
      const which = String(args.which || "next");
      if (which === "specific" && args.number) {
        const n = String(args.number);
        const found = all.find((c) => c.slug.endsWith(`-${n}`) && (!args.ctype || c.slug.startsWith(args.ctype)));
        if (!found) return `Contest ${n} nahi mila.`;
        const qs = await contestQuestions(found.slug);
        if (!qs.length) return `${found.name} (${formatIST(found.startAt)} IST) abhi hua nahi — problems baad me dikhenge.`;
        return fmtContestList(found.name, found.startAt, qs);
      }
      if (which === "previous") {
        const c = pastContests(all)[1];
        if (!c) return "Usse pehle ka contest nahi mila.";
        const qs = await contestQuestions(c.slug);
        return "Usse pehle wala — " + (qs.length ? fmtContestList(c.name, c.startAt, qs) : `${c.name} (${formatIST(c.startAt)} IST)`);
      }
      if (which === "last") {
        const c = pastContests(all)[0];
        if (!c) return "Last contest nahi mila.";
        const qs = await contestQuestions(c.slug);
        return qs.length ? fmtContestList(c.name, c.startAt, qs) : `${c.name} (${formatIST(c.startAt)} IST)`;
      }
      const c = upcomingContests(all)[0];
      if (!c) return "Aane wala contest nahi mila.";
      return `Next: ${c.name}, ${formatIST(c.startAt)} IST ko hai.`;
    }
    case "remind": {
      const at = new Date(String(args.remindAt || ""));
      if (isNaN(at.getTime())) return "ERROR: remindAt samajh nahi aaya, ISO datetime do.";
      if (at.getTime() < Date.now()) return "ERROR: ye time nikal gaya hai, future ka time do.";
      const title = String(args.title || "Reminder").slice(0, 140);
      await saveReminder(title, at, "brain");
      const when = at.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", hour: "numeric", minute: "2-digit" });
      return `Reminder set: "${title}" — ${when} IST pe yaad dilaunga.`;
    }
    case "wiki": {
      const s = await wikiSummary(String(args.topic || ""));
      return s || "ERROR: is topic pe kuch nahi mila.";
    }
    case "web_search": {
      const hits = await ddgSearch(String(args.query || ""), 4);
      if (!hits.length) return "ERROR: search me kuch nahi mila.";
      return "Search results:\n" + hits.map((h, i) => `[${i + 1}] ${h.title} — ${h.snippet} (${h.url})`).join("\n");
    }
    case "news": {
      const n = await tryAnswerNewsQuery("news");
      return n || "ERROR: headlines nahi mili.";
    }
    default:
      return `ERROR: unknown tool "${name}".`;
  }
}

function toRoleMsgs(history: string[]): ChatMsg[] {
  return history.slice(-8).map((h) => {
    const m = h.match(/^(User|Assistant):\s*([\s\S]*)$/);
    if (m) return { role: (m[1] === "User" ? "user" : "assistant") as "user" | "assistant", content: m[2] };
    return { role: "user" as const, content: h };
  });
}

export async function brainReply(userText: string, history: string[] = []): Promise<string> {
  const nowIST = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const system = BRAIN_SYSTEM.replace("{NOW_IST}", nowIST);
  const msgs: ChatMsg[] = [
    { role: "system", content: system },
    ...toRoleMsgs(history),
    { role: "user", content: userText },
  ];
  // Data domains me tool LAZMI — bina tool jawab mana hai (hallucination rokne ke liye)
  const needs = (t: string): string[] => {
    const n: string[] = [];
    if (/contest|leetcode/i.test(t)) n.push("contest");
    if (/remind|yaad\s*dila|alarm|notify/i.test(t)) n.push("remind");
    return n;
  };
  const required = needs(userText);
  const used: string[] = [];
  let pendingReply: string | null = null;
  for (let round = 0; round < 4; round++) {
    const raw = await groqChat(msgs, 500);
    const act = parseAction(raw);
    if (!act) {
      const { cleanText } = await import("./groq.js");
      const t = cleanText(raw);
      if (t) {
        pendingReply = t;
        break;
      }
      throw new Error("brain: unparseable reply");
    }
    if (act.action === "reply") {
      pendingReply = act.text;
      const missing = required.filter((r) => !used.includes(r));
      if (missing.length > 0) {
        console.log(`[brain] verifier: ${missing.join(",")} tool missing, dobara mang rahe...`);
        pendingReply = null;
        msgs.push({ role: "assistant", content: JSON.stringify(act) });
        msgs.push({
          role: "user",
          content: `RUKO. Tumne "${missing.join(", ")}" tool use kiye BINA jawab de diya — ye mana hai. Pehle ${missing.join(", ")} tool CALL karo, uske RESULT se jawab do. Ab tool call karo (JSON).`,
        });
        continue;
      }
      return act.text;
    }
    used.push(act.name);
    console.log(`[brain] tool: ${act.name} ${JSON.stringify(act.args).slice(0, 120)}`);
    const result = await runTool(act.name, act.args);
    msgs.push({ role: "assistant", content: JSON.stringify({ action: "tool", name: act.name, args: act.args }) });
    msgs.push({ role: "user", content: `TOOL RESULT (${act.name}):\n${result}\n\nAb user ko final jawab do (JSON reply action me).` });
  }
  if (pendingReply) return pendingReply;
  throw new Error("brain: too many tool rounds");
}
