import { describe, it, expect } from "vitest";
import { isJunkUrl, looksFactual } from "./web.js";

describe("isJunkUrl", () => {
  it("filters Instagram", () => {
    expect(isJunkUrl("https://instagram.com/p/abc")).toBe(true);
  });

  it("filters Facebook", () => {
    expect(isJunkUrl("https://facebook.com/post")).toBe(true);
  });

  it("filters TikTok", () => {
    expect(isJunkUrl("https://tiktok.com/@user")).toBe(true);
  });

  it("filters Pinterest", () => {
    expect(isJunkUrl("https://pinterest.com/pin/123")).toBe(true);
  });

  it("filters Google Translate", () => {
    expect(isJunkUrl("https://translate.google.com")).toBe(true);
  });

  it("allows Wikipedia", () => {
    expect(isJunkUrl("https://en.wikipedia.org/wiki/India")).toBe(false);
  });

  it("allows GitHub", () => {
    expect(isJunkUrl("https://github.com/user/repo")).toBe(false);
  });

  it("allows news sites", () => {
    expect(isJunkUrl("https://timesofindia.indiatimes.com/news")).toBe(false);
  });
});

describe("looksFactual", () => {
  it("detects question with kya", () => {
    expect(looksFactual("kya hai India ka capital?")).toBe(true);
  });

  it("detects question with kaun", () => {
    expect(looksFactual("kaun hai PM of India?")).toBe(true);
  });

  it("detects news query with ? suffix", () => {
    expect(looksFactual("latest news today?")).toBe(true);
  });

  it("detects score query", () => {
    expect(looksFactual("India match ka score batao")).toBe(true);
  });

  it("rejects short chitchat", () => {
    expect(looksFactual("haan theek hai")).toBe(false);
  });

  it("rejects greeting", () => {
    expect(looksFactual("hello")).toBe(false);
  });

  it("detects batao keyword", () => {
    expect(looksFactual("batao ye kya hai")).toBe(true);
  });

  it("detects search keyword with ? suffix", () => {
    expect(looksFactual("internet pe search kar?")).toBe(true);
  });

  it("detects long text with news keyword", () => {
    expect(looksFactual("bhai latest news kya hai aaj kal")).toBe(true);
  });

  it("detects google keyword", () => {
    expect(looksFactual("google pe dekho kya hota hai")).toBe(true);
  });
});
