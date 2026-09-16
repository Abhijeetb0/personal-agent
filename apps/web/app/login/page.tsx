"use client";
import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "../../lib/supabase-browser";
import { useLang, LangToggle } from "../components/lang";
import { tr } from "../../lib/i18n";

export default function Login() {
  const [lang, setLang] = useLang();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("in");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

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
        {err && <p className="err" style={{ marginTop: 12 }}>{err}</p>}
        {info && <p className="ok-text" style={{ marginTop: 12 }}>{info}</p>}
      </div>
      <p className="muted" style={{ textAlign: "center" }}>
        <Link href="/">{tr(lang, "login.home")}</Link>
      </p>
    </main>
  );
}
