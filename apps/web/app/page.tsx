import Link from "next/link";
import { Brand } from "./components/ui";

export default function Home() {
  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link href="/" className="brand">
            <Brand sub="WhatsApp AI" />
          </Link>
          <div className="nav-links">
            <Link className="btn ghost sm" href="/dashboard">Dashboard</Link>
            <Link className="btn sm" href="/login">Login / Signup</Link>
          </div>
        </div>
      </nav>
      <main className="container">
        <div className="hero">
          <span className="hero-badge">✨ 100% free stack · tumhara khud ka AI</span>
          <h1>Tumhara WhatsApp,<br />ab <span className="grad">super-smart.</span></h1>
          <p className="sub">
            Reminders, LeetCode contests, sawal-jawab, long-term memory —
            sab kuch seedha WhatsApp pe. Apna number link karo aur baat karna shuru karo.
          </p>
          <div className="hero-cta">
            <Link className="btn" href="/login">🚀 Shuru karo — free</Link>
            <Link className="btn ghost" href="/dashboard">Dashboard kholo</Link>
          </div>
          <p className="muted hero-meta">● Agent live · Groq + Gemini brain · Supabase memory</p>
        </div>

        <div className="steps-strip">
          <div className="step-mini">
            <b><span className="step-num">1</span> Account banao</b>
            <p>Email + password se 30 second me signup. Har user ka data alag, private.</p>
          </div>
          <div className="step-mini">
            <b><span className="step-num">2</span> WhatsApp link karo</b>
            <p>QR scan ya 8-digit pairing code — agent wala number link ho jayega.</p>
          </div>
          <div className="step-mini">
            <b><span className="step-num">3</span> Baat karo</b>
            <p>Apne owner number se message bhejo. Agent sirf tumko reply karega.</p>
          </div>
        </div>

        <div className="section-title">
          <h2>Features</h2>
          <p>WhatsApp pe bas bolo — ho jayega</p>
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
          <h2>2 minute me live ho jao ⚡</h2>
          <p>Signup → QR scan → <code>hi</code> bhejo. Bas.</p>
          <Link className="btn" href="/login">Account banao →</Link>
        </div>

        <p className="muted footer">Unofficial WhatsApp bridge (Baileys) — personal use ke liye. Spam mat karo. 💚</p>
      </main>
    </>
  );
}
