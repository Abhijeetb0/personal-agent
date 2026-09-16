import { describe, it, expect, vi, beforeEach } from "vitest";
import { guardReply, validateWebChat, webChatReply } from "./webchat.js";
import { getSession, sendWhatsAppMessage } from "./baileys.js";
import * as store from "./store.js";

vi.mock("./baileys.js", () => ({
  getSession: vi.fn(),
  sendWhatsAppMessage: vi.fn(),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(getSession).mockReturnValue({ status: "disconnected" } as any);
  vi.mocked(sendWhatsAppMessage).mockResolvedValue(undefined as any);
});

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

describe("mirror to WhatsApp", () => {
  it("mirror on + connected + owner ho to WhatsApp pe jata hai", async () => {
    vi.spyOn(store, "getOwnerNumber").mockResolvedValue("911234567890");
    vi.spyOn(store, "getWebMirror").mockResolvedValue(true);
    vi.mocked(getSession).mockReturnValue({ status: "connected" } as any);
    const r = await webChatReply("test-user", "time kya hai");
    expect(vi.mocked(sendWhatsAppMessage)).toHaveBeenCalledOnce();
    const [uid, jid, text] = vi.mocked(sendWhatsAppMessage).mock.calls[0]!;
    expect(uid).toBe("test-user");
    expect(jid).toBe("911234567890@s.whatsapp.net");
    expect(text.startsWith("💬 (web) ")).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  }, 15000);

  it("mirror off ho to WhatsApp pe nahi jata, web reply ok", async () => {
    vi.spyOn(store, "getOwnerNumber").mockResolvedValue("911234567890");
    vi.spyOn(store, "getWebMirror").mockResolvedValue(false);
    vi.mocked(getSession).mockReturnValue({ status: "connected" } as any);
    const r = await webChatReply("test-user", "time kya hai");
    expect(vi.mocked(sendWhatsAppMessage)).not.toHaveBeenCalled();
    expect(r.length).toBeGreaterThan(0);
  }, 15000);

  it("disconnected ho to web reply phir bhi aata hai", async () => {
    vi.spyOn(store, "getOwnerNumber").mockResolvedValue("911234567890");
    vi.spyOn(store, "getWebMirror").mockResolvedValue(true);
    vi.mocked(getSession).mockReturnValue({ status: "disconnected" } as any);
    const r = await webChatReply("test-user", "time kya hai");
    expect(vi.mocked(sendWhatsAppMessage)).not.toHaveBeenCalled();
    expect(r.length).toBeGreaterThan(0);
  }, 15000);
});
