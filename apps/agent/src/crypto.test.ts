import { describe, it, expect, beforeAll } from "vitest";
import { encryptJson, decryptJson } from "./crypto.js";

// Set a valid 64-hex-char key for tests
beforeAll(() => {
  process.env.AGENT_ENC_KEY = "a".repeat(64);
});

describe("encryptJson / decryptJson", () => {
  it("roundtrip: encrypt then decrypt returns original object", () => {
    const original = { creds: "test123", key: "value" };
    const encrypted = encryptJson(original);
    expect(encrypted.enc).toBe(true);
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();
    expect(encrypted.data).toBeDefined();

    const decrypted = decryptJson(encrypted);
    expect(decrypted).toEqual(original);
  });

  it("different calls produce different IVs (unique ciphertext)", () => {
    const obj = { data: "same" };
    const e1 = encryptJson(obj);
    const e2 = encryptJson(obj);
    expect(e1.iv).not.toBe(e2.iv);
    expect(e1.data).not.toBe(e2.data);
  });

  it("decryptJson handles plaintext (backward compat)", () => {
    const plaintext = { creds: "old" } as any;
    const result = decryptJson(plaintext);
    expect(result).toEqual(plaintext);
  });

  it("encryptJson without key returns plaintext", () => {
    const originalKey = process.env.AGENT_ENC_KEY;
    delete process.env.AGENT_ENC_KEY;
    const obj = { test: true };
    const result = encryptJson(obj);
    expect(result.enc).toBeUndefined();
    expect(result.test).toBe(true);
    process.env.AGENT_ENC_KEY = originalKey;
  });

  it("decryptJson with encrypted data but no key throws", () => {
    const originalKey = process.env.AGENT_ENC_KEY;
    delete process.env.AGENT_ENC_KEY;
    const encrypted = encryptJson({ a: 1 });
    // Without key, encrypt returns plaintext, so enc won't be true
    // Let's manually construct an encrypted payload
    process.env.AGENT_ENC_KEY = originalKey;
    const realEncrypted = encryptJson({ a: 1 });
    delete process.env.AGENT_ENC_KEY;
    expect(() => decryptJson(realEncrypted)).toThrow();
    process.env.AGENT_ENC_KEY = originalKey;
  });
});
