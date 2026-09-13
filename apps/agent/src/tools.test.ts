import { describe, it, expect } from "vitest";
import { tryAnswerTimeQuery } from "./tools.js";

describe("tryAnswerTimeQuery", () => {
  it("matches 'time' keyword", () => {
    const result = tryAnswerTimeQuery("kya time ho raha hai");
    expect(result).toContain("IST");
  });

  it("matches 'kitne baje' keyword", () => {
    const result = tryAnswerTimeQuery("abhi kitne baje hai");
    expect(result).toContain("IST");
  });

  it("matches 'date' keyword", () => {
    const result = tryAnswerTimeQuery("aaj ki date kya hai");
    expect(result).toContain("IST");
  });

  it("matches 'tarikh' keyword", () => {
    const result = tryAnswerTimeQuery("tarikh kya hai");
    expect(result).toContain("IST");
  });

  it("returns null for contest queries", () => {
    expect(tryAnswerTimeQuery("contest kab hai")).toBeNull();
  });

  it("returns null for reminder queries", () => {
    expect(tryAnswerTimeQuery("yaad dila dena")).toBeNull();
  });

  it("returns null for unrelated queries", () => {
    expect(tryAnswerTimeQuery("leetcode ka next contest")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(tryAnswerTimeQuery("")).toBeNull();
  });
});
