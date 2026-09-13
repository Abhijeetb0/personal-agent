import { describe, it, expect } from "vitest";
import { keywords } from "./memory.js";

describe("keywords", () => {
  it("extracts meaningful words", () => {
    const result = keywords("Mera naam Rahul hai aur main Delhi me rehta hoon");
    expect(result).toContain("naam");
    expect(result).toContain("rahul");
    expect(result).toContain("delhi");
    expect(result).toContain("rehta");
  });

  it("removes stop words", () => {
    const result = keywords("mera naam kya hai");
    expect(result).not.toContain("mera");
    expect(result).not.toContain("kya");
    expect(result).not.toContain("hai");
  });

  it("removes short words (< 3 chars)", () => {
    const result = keywords("ye ek test hai");
    expect(result).not.toContain("ye");
    expect(result).not.toContain("ek");
    expect(result).not.toContain("hai");
  });

  it("limits to 8 keywords", () => {
    const result = keywords("alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu");
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it("deduplicates keywords", () => {
    const result = keywords("naam mera naam hai aur naam kya hai");
    const naamCount = result.filter((k) => k === "naam").length;
    expect(naamCount).toBe(1);
  });

  it("handles empty string", () => {
    expect(keywords("")).toEqual([]);
  });

  it("handles Hindi characters", () => {
    const result = keywords("नमस्ते दुनिया यह एक परीक्षा है");
    expect(result.length).toBeGreaterThan(0);
  });

  it("lowercases all keywords", () => {
    const result = keywords("My Name Is Rahul");
    expect(result).toContain("name");
    expect(result).toContain("rahul");
    expect(result).not.toContain("My");
    expect(result).not.toContain("Is");
  });
});
