import { describe, it, expect } from "vitest";
import { cleanText } from "./groq.js";

describe("cleanText", () => {
  it("removes think tags and content", () => {
    const input = "<think>thinking here</think>Hello world";
    expect(cleanText(input)).toBe("Hello world");
  });

  it("removes incomplete think tag (no closing)", () => {
    const input = "<think>partial thinking";
    expect(cleanText(input)).toBe("");
  });

  it("handles multiple think blocks", () => {
    const input = "<think>first</think>Hello<think>second</think>world";
    expect(cleanText(input)).toBe("Helloworld");
  });

  it("passes through plain text unchanged", () => {
    expect(cleanText("Hello world")).toBe("Hello world");
  });

  it("trims whitespace", () => {
    expect(cleanText("  Hello  ")).toBe("Hello");
  });

  it("handles empty string", () => {
    expect(cleanText("")).toBe("");
  });

  it("handles text with only think tag", () => {
    expect(cleanText("<think>")).toBe("");
  });
});
