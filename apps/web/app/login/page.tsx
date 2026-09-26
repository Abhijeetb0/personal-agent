"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "../../lib/supabase-browser";
import { useLang, LangToggle } from "../components/lang";
import { tr } from "../../lib/i18n";
import { deviceLabel } from "../../lib/device";

export default function Login() {
  const [lang, setLang] = useLang();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [view, setView] = useState<"pw" | "qr">("pw");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  // QR login state
  const [qr, setQr] = useState<string | null>(null);
  const [qrErr, setQrErr] = useState("");
  const [qrMsg, setQrMsg] = useState("");
  const [qrSec, setQrSec] = useState(0);
  const qrId = useRef<string | null>(null);
  const qrTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopQrPoll() {
    if (qrTimer.current) clearInterval(qrTimer.current);
    qrTimer.current = null;
  }

  async function newQrTicket() {
    stopQrPoll();
    setQr(null);
    setQrErr("");
    setQrMsg("QR ban raha…");
    try {
      const r = await fetch("/api/login-qr/ticket", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: deviceLabel() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "QR nahi bana");
      qrId.current = j.id;
      setQr(j.qr);
      const exp = Math.max(0, Math.round((new Date(j.expiresAt).getTime() - Date.now()) / 1000));
      setQrSec(exp);
      setQrMsg("Logged-in phone se scan karo 📷");
      qrTimer.current = setInterval(async () => {
        setQrSec((s) => (s > 0 ? s - 1 : 0));
        try {
          const s = await fetch(`/api/login-qr/status?id=${j.id}`);
          const sj = await s.json();
          if (sj.status === "approved" && sj.actionLink) {
            stopQrPoll();
            setQrMsg("Approved ✅ — login ho raha…");
            window.location.href = sj.actionLink;
          } else if (sj.status === "denied") {
            stopQrPoll();
            setQr(null);
            setQrMsg("");
            setQrErr("Deny kar diya gaya — naya QR banao ya password se login karo.");
          } else if (sj.status === "expired" || sj.status === "consumed") {
            stopQrPoll();
            setQr(null);
            setQrMsg("");
            setQrErr("QR expire ho gaya — Refresh dabao.");
          }
        } catch {}
      }, 2000);
    } catch (e: any) {
      setQrMsg("");
      setQrErr(e.message || "QR nahi bana");
    }
  }

  useEffect(() => {
    if (view === "qr" && !qr && !qrErr) newQrTicket();
    if (view !== "qr") stopQrPoll();
    return stopQrPoll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setInfo("");
    setLoading(true);
    try {
      const sb = supabaseBrowser();
      if (mode === "in") {
        const r = await sb.auth.signInWithPassword({ email, password: pw });
        if (r.error) throw r.error;
        window.location.href = "/dashboard";
      } else {
        const r = await sb.auth.signUp({ email, password: pw });
        if (r.error) throw r.error;
        if (r.data.session) {
          // email-confirm OFF hai → turant login
          window.location.href = "/dashboard";
        } else {
          // email-confirm ON hai → user ko saaf batao
          setInfo("Signup ho gaya! ✅ Email me confirm link bheja hai — pehle use kholo, fir Login karo. (Ya admin se email-confirm OFF karwao.)");
          setMode("in");
        }
      }
    } catch (e: any) {
      const m = String(e.message || "Fail");
      if (/email not confirmed/i.test(m)) {
        setErr("Email confirm nahi hui. Pehle email ka link kholo, ya Supabase me Confirm email OFF karo (README Step 1).");
      } else if (/already registered|already exists/i.test(m)) {
        setErr("Ye email pehle se registered hai — Login karo.");
        setMode("in");
      } else {
        setErr(m);
      }
    }
    setLoading(false);
  }

  return (
    <main className="auth-wrap">
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <LangToggle lang={lang} onChange={setLang} />
      </div>
      <div className="auth-logo">
        <div className="brand-mark">🤖</div>
        <h1>Personal Agent</h1>
        <p>{mode === "in" ? tr(lang, "login.welcome") : tr(lang, "login.new")}</p>
      </div>
      <div className="card">
        <div className="auth-tabs">
          <button type="button" className={mode === "in" ? "on" : ""} onClick={() => { setMode("in"); setErr(""); setInfo(""); }}>{tr(lang, "login.login")}</button>
          <button type="button" className={mode === "up" ? "on" : ""} onClick={() => { setMode("up"); setErr(""); setInfo(""); }}>{tr(lang, "login.signup")}</button>
        </div>
        {view === "pw" ? (
        <>
        <form onSubmit={submit}>
          <label className="label" htmlFor="email">{tr(lang, "login.email")}</label>
          <input id="email" type="email" required placeholder="tum@email.com" value={email} onChange={(e) => setEmail(e.currentTarget.value)} />
          <label className="label" htmlFor="pw">{tr(lang, "login.pw")}</label>
          <div className="pw-wrap">
            <input id="pw" type={showPw ? "text" : "password"} required placeholder="Min 6 characters" value={pw} onChange={(e) => setPw(e.currentTarget.value)} />
            <button type="button" onClick={() => setShowPw(!showPw)}>{showPw ? "Hide" : "Show"}</button>
          </div>
          <button className="block" disabled={loading}>{loading ? "Ruko..." : mode === "in" ? tr(lang, "login.goIn") : tr(lang, "login.goUp")}</button>
        </form>
        <p className="muted" style={{ textAlign: "center", marginTop: 12 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); setView("qr"); }}>📷 {tr(lang, "login.qrGo")}</a>
        </p>
        </>
        ) : (
        <div style={{ textAlign: "center" }}>
          {qr ? (
            <>
              <div className="qr"><img src={qr} alt="Login QR" width={220} height={220} /></div>
              <p className="muted" style={{ marginTop: 8 }}>{qrMsg} {qrSec > 0 && <b>({Math.floor(qrSec / 60)}:{String(qrSec % 60).padStart(2, "0")})</b>}</p>
            </>
          ) : qrErr ? (
            <>
              <p className="err">{qrErr}</p>
              <p style={{ marginTop: 8 }}><button onClick={newQrTicket}>{tr(lang, "login.qrRefresh")}</button></p>
            </>
          ) : (
            <p className="muted">{qrMsg || "QR ban raha…"}</p>
          )}
          <p className="muted" style={{ marginTop: 12 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); stopQrPoll(); setView("pw"); }}>{tr(lang, "login.qrBack")}</a>
          </p>
        </div>
        )}
        {err && <p className="err" style={{ marginTop: 12 }}>{err}</p>}
        {info && <p className="ok-text" style={{ marginTop: 12 }}>{info}</p>}
      </div>
      <p className="muted" style={{ textAlign: "center" }}>
        <Link href="/">{tr(lang, "login.home")}</Link>
      </p>
    </main>
  );
}
