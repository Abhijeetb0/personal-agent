import { sbAdmin } from "./sb.js";

// Long-term memory — bina embedding/vector ke (zero token cost):
// facts DB me (per user), recall keyword-overlap se.

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

export async function saveMemory(userId: string, fact: string): Promise<string> {
  const f = fact.trim().slice(0, 300);
  if (!f) return "ERROR: fact khaali hai.";
  if (!sbAdmin) return "ERROR: DB nahi hai.";
  const { data: dup } = await sbAdmin.from("Memory").select("id").eq("user_id", userId).ilike("fact", `%${f.slice(0, 40)}%`).limit(1);
  if ((dup as any[])?.length) return "Ye baat pehle se yaad hai.";
  const { error } = await sbAdmin.from("Memory").insert({ user_id: userId, fact: f });
  if (error) throw new Error("memory save fail: " + error.message);
  return `Yaad kar liya: "${f}"`;
}

export async function forgetMemory(userId: string, keyword: string): Promise<string> {
  if (!sbAdmin) return "ERROR: DB nahi hai.";
  const k = keyword.trim().slice(0, 60);
  if (!k) return "ERROR: kya bhulna hai, wo batao.";
  const { data } = await sbAdmin.from("Memory").select("id,fact").eq("user_id", userId).ilike("fact", `%${k}%`).limit(10);
  const rows = (data as any[]) || [];
  if (!rows.length) return "Is baare me kuch yaad nahi tha.";
  await sbAdmin.from("Memory").delete().in("id", rows.map((r) => r.id));
  return `Bhool gaya (${rows.length}): ${rows.map((r) => r.fact).join(" | ").slice(0, 200)}`;
}

// Current message se jude facts (max 5, chhote) — system me inject honge
export async function recallMemories(userId: string, text: string, limit = 5): Promise<string[]> {
  if (!sbAdmin) return [];
  try {
    const words = keywords(text);
    if (!words.length) {
      const { data } = await sbAdmin.from("Memory").select("fact").eq("user_id", userId).order("created_at", { ascending: false }).limit(3);
      return ((data as any[]) || []).map((r) => r.fact);
    }
    const ors = words.map((w) => `fact.ilike.%${w}%`).join(",");
    const { data } = await sbAdmin.from("Memory").select("fact").eq("user_id", userId).or(ors).order("created_at", { ascending: false }).limit(limit);
    return ((data as any[]) || []).map((r) => r.fact);
  } catch (e) {
    console.error("[memory] recall fail:", (e as Error).message);
    return [];
  }
}
