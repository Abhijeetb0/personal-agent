import crypto from "node:crypto";
import logger from "./logger.js";

// WaSession.auth_blob encryption (AES-256-GCM) — DB compromise != WhatsApp compromise.
// Key: AGENT_ENC_KEY env (64 hex chars). Key nahi to plaintext + warning (purana behavior).
// Purane plaintext blob hamesha padhe jayenge (backward compatible).

let warned = false;

function encKey(): Buffer | null {
  const hex = (process.env.AGENT_ENC_KEY || "").trim();
  if (!hex) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    if (!warned) {
      warned = true;
      logger.warn("[crypto] AGENT_ENC_KEY galat format (64 hex chars chahiye) — plaintext mode");
    }
    return null;
  }
  return Buffer.from(hex, "hex");
}

export function encryptJson(obj: unknown): Record<string, unknown> {
  const key = encKey();
  const blob = obj as Record<string, unknown>;
  if (!key) {
    if (!warned) {
      warned = true;
      logger.warn("[crypto] AGENT_ENC_KEY nahi — auth_blob PLAINTEXT save ho raha hai");
    }
    return blob;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), "utf-8"), cipher.final()]);
  return { enc: true, iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), data: data.toString("hex") };
}

export function decryptJson(payload: unknown): Record<string, string> {
  const p = payload as Record<string, unknown>;
  if (!p || (p as any).enc !== true) return (p || {}) as Record<string, string>; // purana plaintext
  const key = encKey();
  if (!key) throw new Error("encrypted auth_blob hai par AGENT_ENC_KEY nahi — restore skip");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(String((p as any).iv), "hex"));
  decipher.setAuthTag(Buffer.from(String((p as any).tag), "hex"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(String((p as any).data), "hex")),
    decipher.final(),
  ]).toString("utf-8");
  return JSON.parse(plain) as Record<string, string>;
}
