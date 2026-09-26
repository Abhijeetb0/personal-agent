import { describe, it, expect } from "vitest";
import { parseAction, looksLikeProtocol, salvageProtocolText, requiredTools, reminderIntent, claimsReminderSet, claimsReminderList } from "./brain.js";

describe("parseAction", () => {
  it("parses reply action", () => {
    const result = parseAction('{"action":"reply","text":"Hello!"}');
    expect(result).toEqual({ action: "reply", text: "Hello!" });
  });

  it("parses tool action with args", () => {
    const result = parseAction('{"action":"tool","name":"contest","args":{"which":"next"}}');
    expect(result).toEqual({ action: "tool", name: "contest", args: { which: "next" } });
  });

  it("parses direct action format", () => {
    const result = parseAction('{"action":"remember","fact":"user likes coffee"}');
    expect(result).toEqual({ action: "tool", name: "remember", args: { fact: "user likes coffee" } });
  });

  it("parses tool via 'tool' key", () => {
    const result = parseAction('{"tool":"time_now","args":{}}');
    expect(result).toEqual({ action: "tool", name: "time_now", args: {} });
  });

  it("parses tool via 'function' key", () => {
    const result = parseAction('{"function":"news","args":{}}');
    expect(result).toEqual({ action: "tool", name: "news", args: {} });
  });

  it("returns null for invalid JSON", () => {
    expect(parseAction("not json at all")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseAction("")).toBeNull();
  });

  it("handles JSON wrapped in markdown code block", () => {
    const result = parseAction('```json\n{"action":"reply","text":"test"}\n```');
    expect(result).toEqual({ action: "reply", text: "test" });
  });

  it("parses reply without explicit action key", () => {
    const result = parseAction('{"text":"Hello world"}');
    expect(result).toEqual({ action: "reply", text: "Hello world" });
  });

  it("parses direct action with nested args", () => {
    const result = parseAction('{"action":"remind","title":"test","remindAt":"2025-01-01T10:00:00Z"}');
    expect(result).toEqual({
      action: "tool",
      name: "remind",
      args: { title: "test", remindAt: "2025-01-01T10:00:00Z" },
    });
  });
});

describe("looksLikeProtocol", () => {
  it("detects protocol JSON", () => {
    expect(looksLikeProtocol('{"action":"reply","text":"hi"}')).toBe(true);
  });

  it("detects tool JSON", () => {
    expect(looksLikeProtocol('{"tool":"time_now","args":{}}')).toBe(true);
  });

  it("rejects plain text", () => {
    expect(looksLikeProtocol("Hello world")).toBe(false);
  });

  it("rejects incomplete JSON", () => {
    expect(looksLikeProtocol('{"action":')).toBe(false);
  });
});

describe("salvageProtocolText", () => {
  it("extracts text from truncated JSON", () => {
    const result = salvageProtocolText('{"action":"reply","text":"This is a long reply that got cut');
    expect(result).toBe("This is a long reply that got cut");
  });

  it("returns null if no text field found", () => {
    expect(salvageProtocolText('{"action":"tool","name":"time_now"}')).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(salvageProtocolText('{"text":""}')).toBeNull();
  });

  it("handles escaped characters in text", () => {
    const result = salvageProtocolText('{"text":"Hello\\nWorld"}');
    expect(result).toBe("Hello\nWorld");
  });
});

describe("requiredTools (reminder intent, typo samet)", () => {
  it("sahi spelling pe remind mangta hai", () => {
    expect(requiredTools("10 min me remind karna")).toContain("remind");
  });

  it("'remaind' typo pe bhi remind mangta hai (17:37 wala case)", () => {
    expect(requiredTools("Abhi 2 min me remaind karna ki kaam rha remainder")).toContain("remind");
  });

  it("'11:11 me remaind karna' pe remind mangta hai", () => {
    expect(requiredTools("11:11 me remaind karna ki kaam kar rha remainder")).toContain("remind");
  });

  it("'kon kon sa remainder laga hai' pe list mangta hai", () => {
    expect(requiredTools("Kon kon sa remainder laga hua hai abhi?")).toContain("list_reminders");
  });

  it("aam chat pe kuch nahi mangta", () => {
    expect(requiredTools("hiii, kaise ho")).toEqual([]);
    expect(requiredTools("tum kon ho")).toEqual([]);
  });
});

describe("false-confirmation guard", () => {
  it("reminder intent pehchanta hai", () => {
    expect(reminderIntent("2 min me remaind karna")).toBe(true);
    expect(reminderIntent("hiii")).toBe(false);
  });

  it("'set ho gaya' daava pakadta hai", () => {
    expect(claimsReminderSet("✅ 2 minute ke baad reminder set ho gaya!")).toBe(true);
    expect(claimsReminderSet("Hi hi! Kaise chal raha hai?")).toBe(false);
  });

  it("bina-tool ginati pakadta hai", () => {
    expect(claimsReminderList("Abhi do reminders set hain: 1... 2...")).toBe(true);
    expect(claimsReminderList("Kuch puchna ho to batao")).toBe(false);
  });
});
