import { describe, it, expect } from "vitest";
import {
  computeReconnectDelay, RECONNECT_DELAYS, getSession,
  requestReconnect, isQrTimeout, MAX_QR_TIMEOUTS,
} from "./baileys.js";
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
    s.needsScan = false;
    expect(shouldSkip("test-dead").skip).toBe(false);
  });

  it("needsScan ko watchdog skip karta hai", () => {
    const s = getSession("test-needsscan");
    s.status = "disconnected";
    s.needsScan = true;
    s.nextRetryAt = 0;
    s.lastClose = { code: 408, detail: "QR refs attempts ended", at: Date.now() };
    const out = shouldSkip("test-needsscan");
    expect(out.skip).toBe(true);
    expect(out.reason).toBe("needs-scan");
  });

  it("qr-status ko watchdog hamesha skip karta hai (grace ke baad bhi)", () => {
    const s = getSession("test-qrwait");
    s.status = "qr";
    s.needsScan = false;
    s.lastQrAt = Date.now() - 999_999; // grace khatm
    const out = shouldSkip("test-qrwait");
    expect(out.skip).toBe(true);
    expect(["qr-grace", "qr-wait"]).toContain(out.reason);
  });
});

describe("isQrTimeout", () => {
  it("408 + QR refs = timeout", () => {
    expect(isQrTimeout(408, "QR refs attempts ended")).toBe(true);
  });

  it("515 ya 408 bina QR msg = timeout nahi", () => {
    expect(isQrTimeout(515, "QR refs attempts ended")).toBe(false);
    expect(isQrTimeout(408, "some network drop")).toBe(false);
    expect(isQrTimeout(500, "x")).toBe(false);
  });

  it("MAX_QR_TIMEOUTS cap set hai", () => {
    expect(MAX_QR_TIMEOUTS).toBe(5);
  });
});

describe("requestReconnect QR guard", () => {
  it("qr-status pe force bhi skip (wake-ping loop band)", () => {
    const s = getSession("test-req-qr");
    s.status = "qr";
    s.needsScan = false;
    s.lastClose = null;
    s.nextRetryAt = 0;
    expect(requestReconnect("test-req-qr", { reason: "wake-ping", force: true })).toBe(false);
  });

  it("needsScan pe force bhi skip", () => {
    const s = getSession("test-req-needs");
    s.status = "disconnected";
    s.needsScan = true;
    s.lastClose = { code: 408, detail: "QR refs attempts ended", at: Date.now() };
    s.nextRetryAt = 0;
    expect(requestReconnect("test-req-needs", { reason: "wake-ping", force: true })).toBe(false);
  });

});
