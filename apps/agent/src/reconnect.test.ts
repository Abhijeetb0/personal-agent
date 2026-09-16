import { describe, it, expect } from "vitest";
import { computeReconnectDelay, RECONNECT_DELAYS, getSession } from "./baileys.js";
import { shouldSkip } from "./watchdog.js";

describe("computeReconnectDelay", () => {
  it("5s se shuru hota hai", () => {
    expect(computeReconnectDelay(1)).toBe(5_000);
  });

  it("badhta hai: 30s -> 2min -> 10min cap", () => {
    expect(computeReconnectDelay(2)).toBe(30_000);
    expect(computeReconnectDelay(3)).toBe(120_000);
    expect(computeReconnectDelay(4)).toBe(600_000);
    expect(computeReconnectDelay(10)).toBe(600_000); // cap
  });

  it("0/negative pe bhi 5s", () => {
    expect(computeReconnectDelay(0)).toBe(RECONNECT_DELAYS[0]);
  });
});

describe("watchdog shouldSkip", () => {
  it("connected ko skip karta hai", () => {
    const s = getSession("test-connected");
    s.status = "connected";
    expect(shouldSkip("test-connected").skip).toBe(true);
  });

  it("loggedOut (401) ko kabhi auto-retry nahi", () => {
    const s = getSession("test-loggedout");
    s.status = "disconnected";
    s.lastClose = { code: 401, detail: "logged out", at: Date.now() };
    s.nextRetryAt = 0;
    const out = shouldSkip("test-loggedout");
    expect(out.skip).toBe(true);
    expect(out.reason).toBe("logged-out");
  });

  it("backoff wait chal raha ho to skip", () => {
    const s = getSession("test-backoff");
    s.status = "disconnected";
    s.lastClose = { code: 500, detail: "x", at: Date.now() };
    s.nextRetryAt = Date.now() + 60_000;
    s.lastQrAt = 0;
    const out = shouldSkip("test-backoff");
    expect(out.skip).toBe(true);
    expect(out.reason).toBe("backoff");
  });

  it("dead + backoff khatm to reconnect allowed", () => {
    const s = getSession("test-dead");
    s.status = "disconnected";
    s.lastClose = { code: 500, detail: "x", at: Date.now() - 999_999 };
    s.nextRetryAt = Date.now() - 1000;
    s.lastQrAt = 0;
    expect(shouldSkip("test-dead").skip).toBe(false);
  });
});
