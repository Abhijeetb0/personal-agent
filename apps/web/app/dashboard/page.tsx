"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser";

type Status = { status: string; connected: boolean; ownerNumber: string | null; reconnectAttempts?: number; reconnectInSec?: number | null; lastClose?: { code: unknown; detail: string; at: number } | null };
type Qr = { status: string; dataUrl: string | null };
type Reminder = { id: string; title: string; remind_at: string; sent: boolean; source: string };
type Memory = { id: string; fact: string };
type Msg = { body: string; reply: string | null; created_at: string };
type Contest = { name: string; startIST: string } | null;

export default function Dashboard() {
  const [tab, setTab] = useState<"connect" | "rems" | "mem" | "chat">("connect");
  const [status, setStatus] = useState<Status | null>(null);
  const [qr, setQr] = useState<Qr | null>(null);
  const [owner, setOwner] = useState("");
  const [ownerMsg, setOwnerMsg] = useState("");
  const [agentNum, setAgentNum] = useState("");
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [pairNum, setPairNum] = useState<string | null>(null);
  const [pairErr, setPairErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [rems, setRems] = useState<Reminder[]>([]);
  const [mems, setMems] = useState<Memory[]>([]);
  const [chat, setChat] = useState<Msg[]>([]);
  const [contest, setContest] = useState<Contest>(null);
  const [testText, setTestText] = useState("Hello! Agent test");
  const [testMsg, setTestMsg] = useState("");

  async function load() {
    try {
      const s = await fetch("/api/agent-status");
      if (s.ok) setStatus(await s.json());
      const q = await fetch("/api/agent-qr");
      if (q.ok) setQr(await q.json());
      const o = await fetch("/api/agent-owner");
      if (o.ok) {
        const j = await o.json();
        if (j.ownerNumber && !owner) setOwner(j.ownerNumber);
      }
      const l = await fetch("/api/agent-leetcode");
      if (l.ok) setContest((await l.json()).contest);
    } catch {}
    try {
      const sb = supabaseBrowser();
      const r1 = await sb.from("Reminder").select("id,title,remind_at,sent,source").order("remind_at", { ascending: true }).limit(30);
      if (r1.data) setRems(r1.data as Reminder[]);
      const r2 = await sb.from("Memory").select("id,fact").order("created_at", { ascending: false }).limit(30);
      if (r2.data) setMems(r2.data as Memory[]);
      const r3 = await sb.from("Message").select("body,reply,created_at").order("created_at", { ascending: false }).limit(20);
      if (r3.data) setChat((r3.data as Msg[]).reverse());
    } catch {}
  }

  useEffect(() => {
    supabaseBrowser().auth.getSession().then(({ data }) => {
      if (!data.session) window.location.href = "/login";
      else load();
    });
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function logout() {
    await supabaseBrowser().auth.signOut();
    window.location.href = "/login";
  }

  async function saveOwner() {
    setOwnerMsg("save ho raha...");
    const r = await fetch("/api/agent-owner", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerNumber: owner }),
    });
    const j = await r.json();
    setOwnerMsg(r.ok ? `Saved: ${j.ownerNumber} ✅` : `Error: ${j.error}`);
    load();
  }

  async function newQr() {
    setBusy(true);
    await fetch("/api/agent-reset", { method: "POST" });
    setTimeout(() => { setBusy(false); load(); }, 6000);
  }

  async function getPairCode() {
    setBusy(true); setPairErr(""); setPairCode(null);
    try {
      const r = await fetch("/api/agent-pairing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: agentNum }),
      });
      const j = await r.json();
      if (r.ok && j.code) { setPairCode(j.code); setPairNum(j.number); }
      else setPairErr(j.error || "Code nahi bana");
    } catch { setPairErr("Agent se baat nahi hui"); }
    setBusy(false);
  }

  async function sendTest() {
    setTestMsg("bhej rahe...");
    const r = await fetch("/api/agent-send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: owner, text: testText }),
    });
    setTestMsg(r.ok ? "Bhej diya! WhatsApp dekho ✅" : "Fail — pehle connect + owner number set karo");
  }

  async function delRem(id: string) {
    await supabaseBrowser().from("Reminder").delete().eq("id", id);
    load();
  }

  async function delMem(id: string) {
    await supabaseBrowser().from("Memory").delete().eq("id", id);
    load();
  }

  const isLoggedOut = (status?.lastClose as any)?.code === 401;
  const retrySec = status?.reconnectInSec ?? null;
  const pill = status?.connected
    ? <span className="pill ok">● Connected</span>
    : status?.status === "qr"
    ? <span className="pill warn">● QR ready — scan karo</span>
    : isLoggedOut
    ? <span className="pill bad">● Logged out — “Naya QR lo” dabao</span>
    : status && (status.reconnectAttempts || 0) > 0
    ? <span className="pill warn">● Jag raha hai… {retrySec != null && retrySec > 0 ? `${retrySec}s me retry` : "retry lag raha hai"} (page khula rakho)</span>
    : <span className="pill bad">● {status?.status ?? "loading..."}</span>;

  return (
    <main className="wrap">
      <div className="topbar">
        <h1>Personal <span>Agent</span></h1>
        <button className="ghost" onClick={logout}>Logout</button>
      </div>
      <p>{pill}</p>
      {!status?.connected && !isLoggedOut && status?.status !== "qr" && (
        <p className="muted">Agent khud reconnect kar raha hai — 1-2 min me live ho jayega. Naya QR tabhi lo jab 10 min se zyada dead rahe.</p>
      )}

      <div className="tabs">
        {(["connect", "rems", "mem", "chat"] as const).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t === "connect" ? "🔗 Connect" : t === "rems" ? `⏰ Reminders (${rems.filter((r) => !r.sent).length})` : t === "mem" ? `🧠 Memory (${mems.length})` : "💬 Chat"}
          </button>
        ))}
      </div>

      {tab === "connect" && (
        <>
          <div className="card">
            <h2>1. Owner number (tumhara number)</h2>
            <p className="desc">Jis number se tum agent se baat karoge — agent SIRF isi ko reply karega.</p>
            <div className="row">
              <input value={owner} onChange={(e) => setOwner(e.currentTarget.value)} placeholder="91XXXXXXXXXX" style={{ flex: 1, minWidth: 180, marginBottom: 0 }} />
              <button onClick={saveOwner}>Save</button>
            </div>
            {ownerMsg && <p className="muted">{ownerMsg}</p>}
          </div>

          <div className="card">
            <h2>2. WhatsApp link karo (agent wala number)</h2>
            <p className="desc">Agent wale phone me: WhatsApp → ⋮ → Linked Devices → Link a Device.</p>
            {qr?.dataUrl ? (
              <div className="qr"><img src={qr.dataUrl} alt="QR" width={240} height={240} /></div>
            ) : status?.connected ? (
              <p className="ok-text">✅ Connected hai — owner number se message karke test karo.</p>
            ) : (
              <p className="muted">QR ka wait... agent chal raha hona chahiye.</p>
            )}
            <p style={{ marginTop: 12 }}>
              <button className="ghost" onClick={newQr} disabled={busy}>{busy ? "Ban raha..." : "Naya QR lo"}</button>
            </p>
          </div>

          <div className="card">
            <h2>QR na chale to — Code se link karo</h2>
            <p className="desc">Number dalo → code lo → us phone me Linked Devices → “Link with phone number instead” me 1-2 min me type karo.</p>
            <input value={agentNum} onChange={(e) => setAgentNum(e.currentTarget.value)} placeholder="91XXXXXXXXXX (agent SIM)" inputMode="numeric" />
            <button onClick={getPairCode} disabled={busy}>{busy ? "..." : "Pairing code lo"}</button>
            {pairCode && (<><p className="code">{pairCode}</p><p className="muted">Ye code <b>{pairNum}</b> ke liye hai — usi phone me type karo.</p></>)}
            {pairErr && <p className="err">{pairErr}</p>}
          </div>

          <div className="card">
            <h2>Next LeetCode Contest</h2>
            {contest ? <p>{contest.name} — <b>{contest.startIST}</b> IST</p> : <p className="muted">Load...</p>}
            <p className="desc">WhatsApp pe bolo: “leetcode contest se 30 min pehle remind kar”</p>
          </div>

          <div className="card">
            <h2>Test message</h2>
            <textarea value={testText} onChange={(e) => setTestText(e.currentTarget.value)} rows={2} />
            <button onClick={sendTest}>Send</button>
            {testMsg && <p className="muted">{testMsg}</p>}
          </div>
        </>
      )}

      {tab === "rems" && (
        <div className="card">
          <h2>Reminders</h2>
          <p className="desc">WhatsApp se banao (“10 min me yaad dila”), yaha dekho/hatayo.</p>
          {rems.length === 0 ? <p className="muted">Koi reminder nahi.</p> : (
            <ul className="list">
              {rems.map((r) => (
                <li key={r.id}>
                  {r.sent ? "✅ " : "⏰ "}{r.title}
                  <br /><small>{new Date(r.remind_at).toLocaleString("en-IN")} · {r.source}</small>
                  {!r.sent && <> <a href="#" onClick={(e) => { e.preventDefault(); delRem(r.id); }}>hatayo</a></>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "mem" && (
        <div className="card">
          <h2>Long-term Memory</h2>
          <p className="desc">WhatsApp pe “yaad rakhna...” bola to yaha save hota hai.</p>
          {mems.length === 0 ? <p className="muted">Abhi kuch yaad nahi.</p> : (
            <ul className="list">
              {mems.map((m) => (
                <li key={m.id}>🧠 {m.fact} <a href="#" onClick={(e) => { e.preventDefault(); delMem(m.id); }}>bhool jao</a></li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "chat" && (
        <div className="card">
          <h2>Recent Chat</h2>
          <div className="chat">
            {chat.length === 0 ? <p className="muted">Abhi koi baat nahi hui.</p> : chat.map((m, i) => (
              <div key={i}>
                <div className="bubble u">{m.body}</div>
                {m.reply && <div className="bubble a">{m.reply}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
