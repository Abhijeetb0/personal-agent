import logger from "./logger.js";
import { sbAdmin } from "./sb.js";
import fs from "node:fs/promises";
import path from "node:path";
import { encryptJson, decryptJson } from "./crypto.js";

// Per-user WhatsApp session persistence (Supabase WaSession + local auth dir).
// Render ki disk ephemeral hai — restart pe yahi se wapas ayega.

export async function saveAuthToSupabase(userId: string, authDir: string, status: string, qr?: string) {
  if (!sbAdmin) return;
  try {
    const files = await fs.readdir(authDir).catch(() => [] as string[]);
    const blob: Record<string, string> = {};
    for (const f of files) {
      try {
        blob[f] = await fs.readFile(path.join(authDir, f), "utf-8");
      } catch { /* binary skip */ }
    }
    await sbAdmin.from("WaSession").upsert({
      user_id: userId,
      auth_blob: encryptJson(blob),
      status,
      qr: qr ?? null,
    });
  } catch (e) {
    logger.error({ err: e }, "[store] supabase save failed");
  }
}

export async function restoreAuthFromSupabase(userId: string, authDir: string) {
  if (!sbAdmin) return;
  try {
    const { data } = await sbAdmin.from("WaSession").select("*").eq("user_id", userId).single();
    const blob = decryptJson((data as any)?.auth_blob);
    if (!blob || Object.keys(blob).length === 0) return;
    await fs.mkdir(authDir, { recursive: true });
    for (const [f, content] of Object.entries(blob)) {
      await fs.writeFile(path.join(authDir, f), content, "utf-8").catch((e) =>
        logger.error({ file: f, err: e }, "[store] restore write fail")
      );
    }
    logger.info({ userId: userId.slice(0, 8) }, "[store] session Supabase se restore ho gaya");
  } catch (e) {
    logger.info({ err: (e as Error).message }, "[store] no previous session");
  }
}

export async function setStatus(userId: string, status: string, qr?: string) {
  if (!sbAdmin) return;
  try {
    await sbAdmin.from("WaSession").upsert({ user_id: userId, status, qr: qr ?? null });
  } catch (e) {
    logger.error({ err: e }, "[store] setStatus fail");
  }
}

export async function clearSupabaseSession(userId: string) {
  if (!sbAdmin) return;
  try {
    await sbAdmin.from("WaSession").upsert({ user_id: userId, auth_blob: {}, status: "disconnected", qr: null });
  } catch (e) {
    logger.error({ err: e }, "[store] clear session fail");
  }
}

export async function listSessionUsers(): Promise<string[]> {
  if (!sbAdmin) return [];
  try {
    const { data } = await sbAdmin.from("WaSession").select("user_id");
    return ((data as any[]) || []).map((r) => r.user_id);
  } catch (e) {
    logger.error({ err: e }, "[store] list users fail");
    return [];
  }
}

// Owner number: DB (UserSetting) pehle, warna OWNER_NUMBER env (dev/single-user fallback)
export async function getOwnerNumber(userId: string): Promise<string> {
  if (sbAdmin) {
    try {
      const { data } = await sbAdmin.from("UserSetting").select("owner_number").eq("user_id", userId).single();
      const n = (data as any)?.owner_number as string | undefined;
      if (n) return n.replace(/[^0-9]/g, "");
    } catch (e) {
      logger.error({ err: e }, "[store] getOwner fail");
    }
  }
  return (process.env.OWNER_NUMBER || "").replace(/[^0-9]/g, "");
}

export async function setOwnerNumber(userId: string, ownerNumber: string) {
  if (!sbAdmin) throw new Error("DB nahi hai");
  const clean = ownerNumber.replace(/[^0-9]/g, "");
  if (clean.length < 10) throw new Error("Sahi number dalo (10 digit ya 91 ke saath)");
  const { error } = await sbAdmin.from("UserSetting").upsert({ user_id: userId, owner_number: clean });
  if (error) throw error;
  return clean;
}

// Web-chat mirror toggle — default ON (column na ho ya row na ho to bhi on, purane users safe)
export async function getWebMirror(userId: string): Promise<boolean> {
  if (sbAdmin) {
    try {
      const { data } = await sbAdmin.from("UserSetting").select("web_mirror").eq("user_id", userId).single();
      if (data && typeof (data as any).web_mirror === "boolean") return (data as any).web_mirror;
    } catch (e) {
      logger.error({ err: e }, "[store] getMirror fail, default on");
    }
  }
  return true;
}

export async function setWebMirror(userId: string, on: boolean): Promise<boolean> {
  if (!sbAdmin) throw new Error("DB nahi hai");
  const { error } = await sbAdmin.from("UserSetting").upsert({ user_id: userId, web_mirror: !!on }, { onConflict: "user_id" });
  if (error) throw error;
  return !!on;
}
