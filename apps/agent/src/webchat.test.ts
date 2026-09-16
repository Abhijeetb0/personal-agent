import { describe, it, expect } from "vitest";
import { guardReply, validateWebChat, webChatReply } from "./webchat.js";

describe("validateWebChat", () => {
  it("khaali message reject", () => {
    expect(() => validateWebChat("")).toThrow();
    expect(() => validateWebChat("   ")).toThrow();
  });

  it("1000+ chars reject", () => {
    expect(() => validateWebChat("x".repeat(1001))).toThrow();
  });

  it("trim karke deta hai", () => {
    expect(validateWebChat("  hi  ")).toBe("hi");
  });
});

describe("guardReply", () => {
  it("normal text passthrough", () => {
    expect(guardReply("Namaste! 🙏")).toBe("Namaste! 🙏");
  });

  it("kachcha JSON leak nahi hone deta", () => {
    const out = guardReply('{"action":"reply","text":"hi wahan"}');
    expect(out.startsWith("{")).toBe(false);
  });

  it("khaali jawab throw", () => {
    expect(() => guardReply("")).toThrow();
  });
});

describe("webChatReply (fastlane, no AI)", () => {
  it("time sawal ka jawab bina AI ke", async () => {
    const r = await webChatReply("test-user", "time kya hai");
    expect(r.length).toBeGreaterThan(0);
    expect(/\d/.test(r)).toBe(true);
  }, 15000);
});
