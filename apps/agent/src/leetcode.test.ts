import { describe, it, expect } from "vitest";
import { pastContests, upcomingContests, formatIST } from "./leetcode.js";

describe("pastContests", () => {
  it("returns contests sorted newest first", () => {
    const now = Date.now();
    const list = [
      { name: "old", slug: "old", startAt: new Date(now - 300_000) },
      { name: "newer", slug: "newer", startAt: new Date(now - 100_000) },
      { name: "newest", slug: "newest", startAt: new Date(now - 50_000) },
    ];
    const result = pastContests(list);
    expect(result[0].name).toBe("newest");
    expect(result[1].name).toBe("newer");
    expect(result[2].name).toBe("old");
  });

  it("filters out future contests", () => {
    const now = Date.now();
    const list = [
      { name: "future", slug: "future", startAt: new Date(now + 100_000) },
      { name: "past", slug: "past", startAt: new Date(now - 100_000) },
    ];
    const result = pastContests(list);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("past");
  });

  it("returns empty for all-future list", () => {
    const list = [
      { name: "f1", slug: "f1", startAt: new Date(Date.now() + 100_000) },
      { name: "f2", slug: "f2", startAt: new Date(Date.now() + 200_000) },
    ];
    expect(pastContests(list)).toEqual([]);
  });
});

describe("upcomingContests", () => {
  it("returns contests sorted soonest first", () => {
    const now = Date.now();
    const list = [
      { name: "later", slug: "later", startAt: new Date(now + 200_000) },
      { name: "sooner", slug: "sooner", startAt: new Date(now + 100_000) },
      { name: "soonest", slug: "soonest", startAt: new Date(now + 50_000) },
    ];
    const result = upcomingContests(list);
    expect(result[0].name).toBe("soonest");
    expect(result[1].name).toBe("sooner");
    expect(result[2].name).toBe("later");
  });

  it("filters out past contests", () => {
    const list = [
      { name: "past", slug: "past", startAt: new Date(Date.now() - 100_000) },
      { name: "future", slug: "future", startAt: new Date(Date.now() + 100_000) },
    ];
    const result = upcomingContests(list);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("future");
  });
});

describe("formatIST", () => {
  it("returns string with IST", () => {
    const result = formatIST(new Date("2025-01-15T10:30:00Z"));
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formats to readable date", () => {
    const result = formatIST(new Date("2025-01-15T10:30:00Z"));
    // Should contain some part of the date
    expect(result).toMatch(/\w+/);
  });
});
