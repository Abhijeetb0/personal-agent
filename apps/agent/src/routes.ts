import express from "express";
import cors from "cors";
import QRCode from "qrcode";
import logger from "./logger.js";
import { authUserId } from "./sb.js";
import {
  getSession, ensureSession, sendWhatsAppMessage, resetSession, requestPairingCode,
  allSessions, requestReconnect,
} from "./baileys.js";
import { setOwnerNumber, getOwnerNumber, listSessionUsers } from "./store.js";
import { getWebMirror, setWebMirror } from "./store.js";
import { normalize } from "./whitelist.js";
import { nextLeetCodeContest, formatIST, allLeetCodeContests, upcomingContests, pastContests } from "./leetcode.js";
import { generalLimiter, sensitiveLimiter, sendLimiter, chatLimiter } from "./rateLimit.js";
import { validateWebChat, webChatReply } from "./webchat.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function buildRoutes() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(generalLimiter);

  app.get("/health", (_req, res) => res.json({ ok: true }));

  // External pinger (UptimeRobot / cron-job) ke liye: HTTP alive + WA socket wake.
  // /health sirf {ok:true} deta hai (Render health-check), ye dead socket ko jagata hai.
  // Auth JWT nahi chahiye taaki pinger maar sake — WAKE_SECRET (?key= ya x-wake-key header) se secure.
  // 60-sec throttle taaki abuse/double-ping se socket spam na ho.
  let lastWakeAt = 0;
  const WAKE_THROTTLE_MS = 60_000;
  app.get("/wake", async (req, res) => {
    const secret = process.env.WAKE_SECRET || "";
    if (!secret) return res.status(503).json({ error: "WAKE_SECRET set nahi hai" });
    const key = String(req.query.key || (req.headers["x-wake-key"] as string) || "");
    if (key !== secret) return res.status(403).json({ error: "galat key" });
    if (Date.now() - lastWakeAt < WAKE_THROTTLE_MS) {
      return res.json({ ok: true, throttled: true });
    }
    lastWakeAt = Date.now();
    try {
      const dbUsers = await listSessionUsers().catch(() => [] as string[]);
      const memUsers = allSessions().map((s) => s.userId);
      const users = [...new Set([...dbUsers, ...memUsers])];
      let woke = 0;
      for (const u of users) {
        // force:true — backoff wait nahi karega (pinger 5-min pe hai, spam nahi banega).
        // loggedOut/connected/starting cases requestReconnect khud skip karta hai.
        if (requestReconnect(u, { reason: "wake-ping", force: true })) woke += 1;
      }
      logger.info({ woke, total: users.length }, "[wake] ping aaya");
      res.json({ ok: true, woke, total: users.length });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Auth: Supabase JWT (website login) -> user_id. Sab WA APIs per-user.
  const auth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // local dev bypass (sirf jab ALLOW_NO_AUTH=1 ho)
    if (process.env.ALLOW_NO_AUTH === "1" && !req.headers.authorization) {
      req.userId = (req.query.user as string) || "owner";
      return next();
    }
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const uid = await authUserId(token);
    if (!uid) return res.status(401).json({ error: "login required" });
    req.userId = uid;
    // session lazy-start (pehli baar aane pe)
    ensureSession(uid);
    next();
  };

  const needUser = (req: express.Request) => req.userId!;

  app.get("/status", auth, (req, res) => {
    const s = getSession(needUser(req));
    const reconnectInSec = s.nextRetryAt ? Math.max(0, Math.round((s.nextRetryAt - Date.now()) / 1000)) : null;
    res.json({
      status: s.status,
      connected: s.status === "connected",
      wsOpen: (s.sock as any)?.ws?.readyState === 1,
      lastClose: s.lastClose,
      ownerNumber: s.ownerNumber || null,
      // Dashboard waking UI ke liye: retry kab hoga + kitni baar fail hua
      reconnectAttempts: s.reconnectAttempts || 0,
      reconnectInSec,
    });
  });

  // QR string + dataURL (dashboard <img> me dikhane ke liye)
  app.get("/qr", auth, async (req, res) => {
    const s = getSession(needUser(req));
    if (!s.lastQr) return res.json({ status: s.status, qr: null, dataUrl: null });
    const dataUrl = await QRCode.toDataURL(s.lastQr);
    res.json({ status: s.status, qr: s.lastQr, dataUrl });
  });

  // manual test: owner ko message bhejo (dashboard se test button)
  // recipient lock: sirf apne owner number pe bhej sakte ho (spam/abuse rokne ke liye)
  app.post("/send", auth, sendLimiter, async (req, res) => {
    try {
      const uid = needUser(req);
      const { to, text } = req.body as { to: string; text: string };
      if (!to || !text) return res.status(400).json({ error: "to + text chahiye" });
      const owner = normalize(getSession(uid).ownerNumber || (await getOwnerNumber(uid)) || "");
      const dest = normalize(to);
      if (!owner || !dest) return res.status(400).json({ error: "owner number set karo, sahi number do" });
      const same = dest === owner || (dest.length >= 10 && owner.length >= 10 && dest.slice(-10) === owner.slice(-10));
      if (!same) return res.status(403).json({ error: "sirf apne owner number pe bhej sakte ho" });
      const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
      await sendWhatsAppMessage(uid, jid, text);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Dashboard: "Naya QR" — aadha-fasa session saaf karke fresh pairing shuru karo
  app.post("/reset", auth, sensitiveLimiter, async (req, res) => {
    try {
      await resetSession(needUser(req));
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Pairing code: QR ki jagah phone me 8-digit code type karo. Body: { number }
  app.post("/pairing-code", auth, sensitiveLimiter, async (req, res) => {
    try {
      const num = String((req.body as any)?.number || "");
      const out = await requestPairingCode(needUser(req), num);
      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.get("/pairing-code", auth, (req, res) => {
    const s = getSession(needUser(req));
    res.json({
      code: s.pairingCode,
      ageSec: s.pairingCodeAt ? Math.round((Date.now() - s.pairingCodeAt) / 1000) : null,
      status: s.status,
    });
  });

  // Owner number: jis number se user agent se baat karega (whitelist)
  app.get("/owner", auth, async (req, res) => {
    const uid = needUser(req);
    const s = getSession(uid);
    res.json({ ownerNumber: s.ownerNumber || (await getOwnerNumber(uid)) || null });
  });

  app.post("/owner", auth, async (req, res) => {
    try {
      const uid = needUser(req);
      const clean = await setOwnerNumber(uid, String((req.body as any)?.ownerNumber || ""));
      getSession(uid).ownerNumber = clean;
      res.json({ ok: true, ownerNumber: clean });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Web-chat mirror toggle: web wale jawab WhatsApp pe bhi jayen ya nahi
  app.get("/mirror", auth, async (req, res) => {
    res.json({ mirror: await getWebMirror(needUser(req)) });
  });

  app.post("/mirror", auth, async (req, res) => {
    try {
      const on = await setWebMirror(needUser(req), !!((req.body as any)?.on));
      res.json({ ok: true, mirror: on });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Dashboard: next leetcode contest dekho
  app.get("/leetcode/next", auth, async (_req, res) => {
    const c = await nextLeetCodeContest();
    if (!c) return res.json({ contest: null });
    res.json({ contest: { name: c.name, startAt: c.startAt, startIST: formatIST(c.startAt), url: c.url } });
  });

  // Dashboard web-chat: brain se seedha baat (WhatsApp pe kuch nahi jata)
  app.post("/chat", auth, chatLimiter, async (req, res) => {
    try {
      validateWebChat((req.body as any)?.text);
    } catch (e) {
      return res.status(400).json({ error: (e as Error).message });
    }
    try {
      const reply = await webChatReply(needUser(req), (req.body as any)?.text);
      res.json({ reply });
    } catch (e) {
      res.status(502).json({ error: (e as Error).message || "AI se jawab nahi aaya" });
    }
  });

  // Dashboard contests tab: upcoming (pehle 3) + past (pehle 3) — 10-min cache agent me
  app.get("/leetcode", auth, async (_req, res) => {
    try {
      const all = await allLeetCodeContests();
      const up = upcomingContests(all).slice(0, 3).map((c) => ({ name: c.name, startAt: c.startAt, startIST: formatIST(c.startAt), url: `https://leetcode.com/contest/${c.slug}` }));
      const past = pastContests(all).slice(0, 3).map((c) => ({ name: c.name, startAt: c.startAt, startIST: formatIST(c.startAt), url: `https://leetcode.com/contest/${c.slug}` }));
      res.json({ upcoming: up, past });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  return app;
}
