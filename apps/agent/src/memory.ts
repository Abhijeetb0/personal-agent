import { createClient } from "@supabase/supabase-js";

// Long-term memory — bina embedding/vector ke (zero token cost):
// facts DB me, recall keyword-overlap se. Personal agent ke liye kaafi + free.

function sb() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key);
}

const STOP = new Set(
  "ka,ki,ke,ko,se,me,mein,ne,pe,par,kaun,kya,kab,kahan,kaise,kyu,kyon,hai,hain,ho,tha,the,thi,ye,wo,yeh,aur,or,ka,my,mera,meri,mere,main,mai,tu,tum,aap,ka,kya,is,us,yeh,the,a,an,the,is,are,was,were,be,to,of,and,or,for,with,my,i,you,your,me,do,does,what,when,where,who,how,batao,btao,karo,hai,na,jo,to,kya,please".split(",")
);

export function keywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z\u0900-\u097F0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP.has(w))
    )
  ).slice(0, 8);
}

export async function saveMemory(fact: string): Promise<string> {
  const f = fact.trim().slice(0, 300);
  if (!f) return "ERROR: fact khaali hai.";
  if (!process.env.SUPABASE_URL) return "ERROR: DB nahi hai.";
  // duplicate se bacho
  const { data: dup } = await sb().from("Memory").select("id").ilike("fact", `%${f.slice(0, 40)}%`).limit(1);
  if ((dup as any[])?.length) return "Ye baat pehle se yaad hai.";
  const { error } = await sb().from("Memory").insert({ fact: f });
  if (error) throw new Error("memory save fail: " + error.message);
  return `Yaad kar liya: "${f}"`;
}

export async function forgetMemory(keyword: string): Promise<string> {
  if (!process.env.SUPABASE_URL) return "ERROR: DB nahi hai.";
  const k = keyword.trim().slice(0, 60);
  if (!k) return "ERROR: kya bhulna hai, wo batao.";
  const { data } = await sb().from("Memory").select("id,fact").ilike("fact", `%${k}%`).limit(10);
  const rows = (data as any[]) || [];
  if (!rows.length) return "Is baare me kuch yaad nahi tha.";
  await sb().from("Memory").delete().in("id", rows.map((r) => r.id));
  return `Bhool gaya (${rows.length}): ${rows.map((r) => r.fact).join(" | ").slice(0, 200)}`;
}

// Current message se jude facts (max 5, chhote) — system me inject honge
export async function recallMemories(text: string, limit = 5): Promise<string[]> {
  if (!process.env.SUPABASE_URL) return [];
  try {
    const words = keywords(text);
    if (!words.length) {
      // keyword nahi to latest 3 (general context)
      const { data } = await sb().from("Memory").select("fact").order("createdAt", { ascending: false }).limit(3);
      return ((data as any[]) || []).map((r) => r.fact);
    }
    const ors = words.map((w) => `fact.ilike.%${w}%`).join(",");
    const { data } = await sb().from("Memory").select("fact").or(ors).order("createdAt", { ascending: false }).limit(limit);
    return ((data as any[]) || []).map((r) => r.fact);
  } catch (e) {
    console.error("[memory] recall fail:", (e as Error).message);
    return [];
  }
}
