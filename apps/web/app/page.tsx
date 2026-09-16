"use client";
import Link from "next/link";
import { Brand } from "./components/ui";
import { useLang, LangToggle } from "./components/lang";
import { tr } from "../lib/i18n";

export default function Home() {
  const [lang, setLang] = useLang();
  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="brand">
            <Brand sub="WhatsApp AI" />
          </Link>
          <div className="nav-links">
            <LangToggle lang={lang} onChange={setLang} />
            <Link className="btn ghost sm" href="/dashboard">{tr(lang, "nav.dashboard")}</Link>
            <Link className="btn sm" href="/login">{tr(lang, "nav.login")}</Link>
          </div>
        </div>
      </nav>
      <main className="container">
        <div className="hero">
          <span className="hero-badge">{tr(lang, "land.badge")}</span>
          <h1>{tr(lang, "land.h1a")}<br />{tr(lang, "land.h1mid")} <span className="grad">{tr(lang, "land.h1b")}</span></h1>
          <p className="sub">{tr(lang, "land.sub")}</p>
          <div className="hero-cta">
            <Link className="btn" href="/login">{tr(lang, "land.cta1")}</Link>
            <Link className="btn ghost" href="/dashboard">{tr(lang, "land.cta2")}</Link>
          </div>
          <p className="muted hero-meta">{tr(lang, "land.meta")}</p>
        </div>

        <div className="steps-strip">
          <div className="step-mini">
            <b><span className="step-num">1</span> {tr(lang, "land.s1t")}</b>
            <p>{tr(lang, "land.s1d")}</p>
          </div>
          <div className="step-mini">
            <b><span className="step-num">2</span> {tr(lang, "land.s2t")}</b>
            <p>{tr(lang, "land.s2d")}</p>
          </div>
          <div className="step-mini">
            <b><span className="step-num">3</span> {tr(lang, "land.s3t")}</b>
            <p>{tr(lang, "land.s3d")}</p>
          </div>
        </div>

        <div className="section-title">
          <h2>{tr(lang, "land.feat")}</h2>
          <p>{tr(lang, "land.featSub")}</p>
        </div>
        <div className="feat-grid">
          <div className="feat">
            <div className="icon">⏰</div>
            <h3>Smart Reminders</h3>
            <p><code>“LeetCode contest se 30 min pehle yaad dila dena”</code> — sahi time pe WhatsApp ping.</p>
          </div>
          <div className="feat">
            <div className="icon">🏆</div>
            <h3>LeetCode Contests</h3>
            <p>Next/last contest, timing, problems — live API se, kabhi stale nahi.</p>
          </div>
          <div className="feat">
            <div className="icon">🧠</div>
            <h3>Long-term Memory</h3>
            <p><code>“Yaad rakhna…”</code> bola to hamesha yaad rahega. Bhoolna ho to <code>“bhool jao”</code>.</p>
          </div>
          <div className="feat">
            <div className="icon">🔍</div>
            <h3>Web + Wiki + News</h3>
            <p>Factual sawalon pe khud search karke jawab — hawa me nahi, source se.</p>
          </div>
        </div>

        <div className="cta-band">
          <h2>{tr(lang, "land.ctaH")}</h2>
          <p>{tr(lang, "land.ctaP")}</p>
          <Link className="btn" href="/login">{tr(lang, "land.ctaB")}</Link>
        </div>

        <p className="muted footer">{tr(lang, "land.foot")}</p>
      </main>
    </>
  );
}
