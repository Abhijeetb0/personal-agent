import Link from "next/link";

export default function Home() {
  return (
    <main className="wrap">
      <div className="hero">
        <h1>Personal <span>Agent</span> 🤖</h1>
        <p>Tumhara khud ka WhatsApp AI assistant — reminders, LeetCode contests, sawal-jawab. 100% free stack.</p>
      </div>
      <div className="card">
        <h2>Kaise kaam karta hai?</h2>
        <p className="desc">1. Account banao → 2. Apna WhatsApp link karo (QR/code) → 3. Apne number se baat karo. Agent sirf tumko reply karega.</p>
        <div className="row">
          <Link className="btn" href="/login">Login / Signup</Link>
          <Link className="btn ghost" href="/dashboard">Dashboard</Link>
        </div>
      </div>
      <div className="card">
        <h2>Features</h2>
        <ul className="list">
          <li>⏰ <b>Reminders</b> — “LeetCode contest se 30 min pehle yaad dila dena”</li>
          <li>🏆 <b>LeetCode contests</b> — next/last/problems, real API se</li>
          <li>🧠 <b>Memory</b> — “yaad rakhna” bola to hamesha yaad rahega</li>
          <li>🔍 <b>Web search + Wiki + News</b> — khud fetch karke jawab</li>
        </ul>
      </div>
      <p className="muted" style={{ textAlign: "center" }}>Unofficial WhatsApp bridge (Baileys) — personal use ke liye.</p>
    </main>
  );
}
