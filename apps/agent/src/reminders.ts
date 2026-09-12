import { createClient } from "@supabase/supabase-js";
import { nextLeetCodeContest, allLeetCodeContests, pastContests, upcomingContests, contestQuestions, formatIST } from "./leetcode.js";

function sb() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key);
}

async function saveReminder(title: string, remindAt: Date, source = "custom") {
  if (!process.env.SUPABASE_URL) {
    console.log(`[reminder] (no DB) ${title} @ ${remindAt.toISOString()}`);
    return { id: "local", title, remindAt };
  }
  const { data, error } = await sb()
    .from("Reminder")
    .insert({ title, remindAt: remindAt.toISOString(), source })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Unified contest Q&A — next / last / usse-pehle / contest <number> sab cover.
// Reminder command wale yaha nahi aate (REMINDER_WORDS check).
function withQuestions(name: string, startAt: Date, qs: { title: string }[]): string {
  const lines = qs.map((q, i) => `${i + 1}. ${q.title}`).join("\n");
  return `${name} (${formatIST(startAt)} IST)\nProblems:\n${lines}`;
}

// "last contest me kya problems the?" — real list
export async function tryAnswerLastContestQuery(text: string): Promise<string | null> {
  return tryAnswerContestQuery(text);
}

// "next leetcode contest kab hai?" — real API date batao (AI andaza na lagaye)
export async function tryAnswerContestQuery(text: string): Promise<string | null> {
  if (!/contest|leetcode/i.test(text)) return null;
  if (REMINDER_WORDS.test(text)) return null; // ye reminder command hai, info nahi
  const low = text.toLowerCase();
  try {
    const all = await allLeetCodeContests();

    // specific number: "contest 518", "weekly 519", "biweekly 190"
    const numM = low.match(/(weekly|biweekly)?\s*(contest)?\s*(\d{3})/);
    if (numM) {
      const n = numM[3];
      const type = numM[1]; // weekly|biweekly|undefined
      const found = all.find(
        (c) => c.slug.endsWith(`-${n}`) && (!type || c.slug.startsWith(type))
      );
      if (!found) return `Contest ${n} nahi mila. Number check karo (jaise "weekly contest 518").`;
      const qs = await contestQuestions(found.slug);
      if (qs.length === 0) return `${found.name} (${formatIST(found.startAt)} IST) abhi hua nahi hai — problems contest ke baad dikhenge.`;
      return withQuestions(found.name, found.startAt, qs);
    }

    // "usse pehle wala / second last / pichle se pehle"
    if (/(usse|us se|is se)\s*(pehle|pahle)|(second|2nd)\s*last|pichle\s*se\s*pehle|previous\s*to\s*previous/i.test(text)) {
      const past = pastContests(all);
      const c = past[1];
      if (!c) return "Usse pehle ka contest nahi mila.";
      const qs = await contestQuestions(c.slug);
      if (qs.length === 0) return `${c.name} ke problems nahi mile.`;
      return "Usse pehle wala — " + withQuestions(c.name, c.startAt, qs);
    }

    // last / pichla (problems maange to list ke saath)
    if (/(last|pichla|pichhla|previous|latest)/i.test(text)) {
      const past = pastContests(all);
      const c = past[0];
      if (!c) return "Last contest nahi mila.";
      const qs = await contestQuestions(c.slug);
      if (qs.length === 0) return `${c.name} (${formatIST(c.startAt)} IST) — problems abhi nahi mile.`;
      return withQuestions(c.name, c.startAt, qs);
    }

    // default: next upcoming
    const up = upcomingContests(all);
    const c = up[0];
    if (!c) return "LeetCode contest list abhi nahi mil payi. Thodi der me fir pucho.";
    return `Next LeetCode contest: ${c.name}\n${formatIST(c.startAt)} (IST) ko hai.\nChaho to bolo "is se 30 min pehle remind kar" — yaad dila dunga!`;
  } catch (e) {
    console.error("[leetcode] contest q fail:", (e as Error).message);
    return "Contest info abhi nahi mil payi. Thodi der me fir pucho.";
  }
}
function minutesBefore(text: string): number {
  const m = text.match(/(\d+)\s*(min|minute)/i);
  return m ? parseInt(m[1], 10) : 30;
}

function relativeMinutes(text: string): number | null {
  // "10 min me yaad dila", "2 hour me remind kar", "30 minute baad"
  let m = text.match(/(\d+)\s*(min|minute)s?\s*(me|mein|baad|after)/i);
  if (m) return parseInt(m[1], 10);
  m = text.match(/(\d+)\s*(hour|ghante?)\s*(me|mein|baad|after)/i);
  if (m) return parseInt(m[1], 10) * 60;
  return null;
}

const REMINDER_WORDS = /(remind|reminder|yaad\s*dila|alarm|notify|contest\s*se)/i;

export async function tryHandleReminderCommand(text: string): Promise<string | null> {
  if (!REMINDER_WORDS.test(text)) return null;
  const low = text.toLowerCase();

  // list command
  if (/(list|dikha|show).*remind/i.test(text) || /(mere|meri).*remind/i.test(text)) {
    try {
      if (!process.env.SUPABASE_URL) return "Abhi DB connected nahi hai, isliye list nahi dikha sakta.";
      const { data } = await sb()
        .from("Reminder")
        .select("title,remindAt,sent")
        .eq("sent", false)
        .order("remindAt", { ascending: true })
        .limit(10);
      const rows = (data as any[]) || [];
      if (rows.length === 0) return "Koi pending reminder nahi hai.";
      return "Tumhare reminders:\n" + rows.map((r, i) => `${i + 1}. ${r.title} — ${new Date(r.remindAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`).join("\n");
    } catch (e) {
      return "List nikalne me error: " + (e as Error).message;
    }
  }

  // A. LeetCode contest reminder
  if (low.includes("leetcode") || low.includes("leet code") || low.includes("contest")) {
    const contest = await nextLeetCodeContest();
    if (!contest) return "LeetCode contest list nahi mil payi. Thodi der me fir try karo.";
    const mins = minutesBefore(text);
    const remindAt = new Date(contest.startAt.getTime() - mins * 60_000);
    if (remindAt.getTime() < Date.now()) {
      return `Next contest (${contest.name}) ${formatIST(contest.startAt)} ko hai — ${mins} min pehle ka time nikal gaya. Kam minutes bolo ya next contest ke liye bolo.`;
    }
    await saveReminder(`LeetCode: ${contest.name}`, remindAt, "leetcode");
    return `Done! ${contest.name} ${formatIST(contest.startAt)} (IST) ko hai — tumko ${mins} min pehle (${formatIST(remindAt)}) yaad dila dunga.`;
  }

  // B. Relative: "10 min me yaad dila ki chai pi..."
  const rel = relativeMinutes(text);
  if (rel !== null) {
    const remindAt = new Date(Date.now() + rel * 60_000);
    const title = text.slice(0, 120);
    await saveReminder(title, remindAt, "custom");
    return `Done! ${rel} min baad yaad dila dunga (${formatIST(remindAt)} IST).`;
  }

  // C. Intent to hai par time samajh nahi aaya
  return "Samajh gaya reminder chahiye! Time aise bolo: 'leetcode contest se 30 min pehle remind kar' ya '15 min me yaad dila chai pine ko'.";
}
