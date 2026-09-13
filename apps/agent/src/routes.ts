import express from "express";
import cors from "cors";
import QRCode from "qrcode";
import { authUserId } from "./sb.js";
import {
  getSession, ensureSession, sendWhatsAppMessage, resetSession, requestPairingCode,
} from "./baileys.js";
import { setOwnerNumber, getOwnerNumber } from "./store.js";
import { normalize } from "./whitelist.js";
import { nextLeetCodeContest, formatIST } from "./leetcode.js";
import { generalLimiter, sensitiveLimiter, sendLimiter } from "./rateLimit.js";

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
    res.json({
      status: s.status,
      connected: s.status === "connected",
      wsOpen: (s.sock as any)?.ws?.readyState === 1,
      lastClose: s.lastClose,
      ownerNumber: s.ownerNumber || null,
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

  // Dashboard: next leetcode contest dekho
  app.get("/leetcode/next", auth, async (_req, res) => {
    const c = await nextLeetCodeContest();
    if (!c) return res.json({ contest: null });
    res.json({ contest: { name: c.name, startAt: c.startAt, startIST: formatIST(c.startAt), url: c.url } });
  });

  return app;
}
