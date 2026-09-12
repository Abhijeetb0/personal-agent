import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const url = process.env.SUPABASE_URL || "";
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";

if (!url) console.warn("[store] SUPABASE_URL missing — session sirf local file me rahega (Render restart pe logout hoga)");

export const supabase = url && secret ? createClient(url, secret) : null;

// Baileys file-auth ka backup Supabase table me.
// Table: WhatsappSession(id='default', authBlob, status, qr)
export async function saveAuthToSupabase(authDir: string, status: string, qr?: string) {
  if (!supabase) return;
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const files = await fs.readdir(authDir).catch(() => [] as string[]);
    const blob: Record<string, string> = {};
    for (const f of files) {
      try {
        blob[f] = await fs.readFile(path.join(authDir, f), "utf-8");
      } catch { /* binary skip */ }
    }
    await supabase.from("WhatsappSession").upsert({
      id: "default",
      authBlob: blob,
      status,
      qr: qr ?? null,
    });
  } catch (e) {
    console.error("[store] supabase save failed:", (e as Error).message);
  }
}

export async function restoreAuthFromSupabase(authDir: string) {
  if (!supabase) return;
  try {
    const { data } = await supabase.from("WhatsappSession").select("*").eq("id", "default").single();
    const blob = (data as any)?.authBlob as Record<string, string> | undefined;
    if (!blob || Object.keys(blob).length === 0) return;
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    await fs.mkdir(authDir, { recursive: true });
    for (const [f, content] of Object.entries(blob)) {
      await fs.writeFile(path.join(authDir, f), content, "utf-8").catch(() => {});
    }
    console.log("[store] session Supabase se restore ho gaya");
  } catch (e) {
    console.log("[store] no previous session:", (e as Error).message);
  }
}

export async function setStatus(status: string, qr?: string) {
  if (!supabase) return;
  try {
    await supabase.from("WhatsappSession").upsert({ id: "default", status, qr: qr ?? null });
  } catch {}
}

export async function clearSupabaseSession() {
  if (!supabase) return;
  try {
    await supabase.from("WhatsappSession").upsert({ id: "default", authBlob: {}, status: "disconnected", qr: null });
  } catch {}
}
