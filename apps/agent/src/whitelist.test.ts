import { describe, it, expect } from "vitest";
import { normalize } from "./whitelist.js";

describe("normalize", () => {
  it("removes non-digit characters", () => {
    expect(normalize("917761815151")).toBe("917761815151");
  });

  it("strips @s.whatsapp.net suffix", () => {
    expect(normalize("917761815151@s.whatsapp.net")).toBe("917761815151");
  });

  it("strips @lid suffix", () => {
    expect(normalize("12345@lid")).toBe("12345");
  });

  it("strips :0 device suffix", () => {
    expect(normalize("917761815151:0")).toBe("917761815151");
  });

  it("handles empty string", () => {
    expect(normalize("")).toBe("");
  });

  it("handles null/undefined gracefully", () => {
    expect(normalize(null as any)).toBe("");
    expect(normalize(undefined as any)).toBe("");
  });

  it("removes + prefix", () => {
    expect(normalize("+917761815151")).toBe("917761815151");
  });

  it("removes spaces and dashes", () => {
    expect(normalize("91 776 181 5151")).toBe("917761815151");
    expect(normalize("91-776-181-5151")).toBe("917761815151");
  });

  it("combined: :0 + @s.whatsapp.net", () => {
    expect(normalize("917761815151:0@s.whatsapp.net")).toBe("917761815151");
  });
});
