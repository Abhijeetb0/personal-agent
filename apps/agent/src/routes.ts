import express from "express";
import cors from "cors";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import { state, sendWhatsAppMessage, resetSession } from "./baileys.js";
import { nextLeetCodeContest, formatIST } from "./leetcode.js";

export function buildRoutes() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // simple shared-secret guard (web dashboard se calls ke liye)
  const SECRET = process.env.AGENT_API_SECRET || "";
  const guard = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!SECRET) return next(); // local dev me open
    if (req.headers["x-agent-secret"] === SECRET) return next();
    // health/qr ko bina secret padhne do taaki dashboard status dikha sake? nahi — qr sensitive hai
    if (req.path === "/health") return next();
    return res.status(401).json({ error: "unauthorized" });
  };
  app.use(guard);

  app.get("/health", (_req, res) => res.json({ ok: true, status: state.status }));

  app.get("/status", (_req, res) =>
    res.json({ status: state.status, connected: state.status === "connected" })
  );

  // QR string + dataURL (dashboard <img> me dikhane ke liye)
  app.get("/qr", async (_req, res) => {
    if (!state.lastQr) return res.json({ status: state.status, qr: null, dataUrl: null });
    const dataUrl = await QRCode.toDataURL(state.lastQr);
    res.json({ status: state.status, qr: state.lastQr, dataUrl });
  });

  // manual test: owner ko message bhejo (dashboard se test button)
  app.post("/send", async (req, res) => {
    try {
      const { to, text } = req.body as { to: string; text: string };
      if (!to || !text) return res.status(400).json({ error: "to + text chahiye" });
      const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
      await sendWhatsAppMessage(jid, text);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Dashboard: "Naya QR" — aadha-fasa session saaf karke fresh pairing shuru karo
  app.post("/reset", async (_req, res) => {
    try {
      await resetSession();
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  const sb = () => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY!;
    return createClient(url, key);
  };

  // Dashboard: reminders list
  app.get("/reminders", async (_req, res) => {
    try {
      const { data } = await sb()
        .from("Reminder")
        .select("id,title,remindAt,sent,source")
        .order("remindAt", { ascending: true })
        .limit(50);
      res.json({ reminders: data ?? [] });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  app.delete("/reminders/:id", async (req, res) => {
    try {
      await sb().from("Reminder").delete().eq("id", req.params.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Dashboard: next leetcode contest dekho
  app.get("/leetcode/next", async (_req, res) => {
    const c = await nextLeetCodeContest();
    if (!c) return res.json({ contest: null });
    res.json({ contest: { name: c.name, startAt: c.startAt, startIST: formatIST(c.startAt), url: c.url } });
  });

  return app;
}
