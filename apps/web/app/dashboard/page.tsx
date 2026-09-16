"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "../../lib/supabase-browser";
import { Brand, StatusPill, StatCard, EmptyState, SectionHeader, Skeleton, type ConnTone } from "../components/ui";

type Status = { status: string; connected: boolean; ownerNumber: string | null; reconnectAttempts?: number; reconnectInSec?: number | null; lastClose?: { code: unknown; detail: string; at: number } | null };
type Qr = { status: string; dataUrl: string | null };
type Reminder = { id: string; title: string; remind_at: string; sent: boolean; source: string };
type Memory = { id: string; fact: string };
type Msg = { body: string; reply: string | null; created_at: string };
type Contest = { name: string; startIST: string } | null;

type Tab = "overview" | "connect" | "rems" | "mem" | "chat";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "connect", label: "Connect", icon: "🔗" },
  { id: "rems", label: "Reminders", icon: "⏰" },
  { id: "mem", label: "Memory", icon: "🧠" },
  { id: "chat", label: "Chat", icon: "💬" },
];

function relTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  const h = Math.round(abs / 3600000);
  const d = Math.round(abs / 86400000);
  const s = d > 0 ? `${d} din` : h > 0 ? `${h} ghante` : m > 0 ? `${m} min` : "abhi";
  return diff >= 0 ? `${s} me` : `${s} pehle`;
}

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("overview");
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
  const [email, setEmail] = useState("");

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
    let sb;
    try {
      sb = supabaseBrowser();
    } catch {
      window.location.href = "/login";
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) window.location.href = "/login";
      else {
        setEmail(data.session.user.email || "");
        load();
      }
    }).catch(() => { window.location.href = "/login"; });
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

  // ---- derived state ----
  const connected = !!status?.connected;
  const isQr = status?.status === "qr";
  const isLoggedOut = (status?.lastClose as any)?.code === 401;
  const retrySec = status?.reconnectInSec ?? null;
  const ownerSet = !!(status?.ownerNumber || owner);
  const everChatted = chat.length > 0;
  const pending = rems.filter((r) => !r.sent);
  const todayChats = chat.filter((m) => new Date(m.created_at).toDateString() === new Date().toDateString()).length;

  let tone: ConnTone = "neutral";
  let statusText = "Loading...";
  if (connected) { tone = "ok"; statusText = "Connected"; }
  else if (isQr) { tone = "wait"; statusText = "QR ready — scan karo"; }
  else if (isLoggedOut) { tone = "bad"; statusText = "Logged out — Naya QR lo"; }
  else if (status && (status.reconnectAttempts || 0) > 0) {
    tone = "wait";
    statusText = `Jag raha hai… ${retrySec != null && retrySec > 0 ? `${retrySec}s me retry` : "retry lag raha hai"}`;
  } else if (status) { tone = "bad"; statusText = status.status; }

  const setup = [
    { done: ownerSet, title: "Owner number save karo", desc: "Jis number se tum agent se baat karoge — agent SIRF isi ko reply karega.", go: "connect" as Tab, btn: "Set karo →" },
    { done: connected, title: "WhatsApp link karo", desc: "QR scan ya pairing code se agent wala number link karo.", go: "connect" as Tab, btn: "Link karo →" },
    { done: everChatted, title: "Pehla message bhejo", desc: "Owner number se agent ko hi bhejo — turant reply ayega.", go: "chat" as Tab, btn: "Chat dekho →" },
  ];
  const setupDone = setup.filter((s) => s.done).length;

  const nav = (cls: string, itemCls: (t: Tab) => string) => (
    <>
      {TABS.map((t) => (
        <button key={t.id} className={itemCls(t.id)} onClick={() => setTab(t.id)}>
          <span>{t.icon}</span> {t.label}
          {t.id === "rems" && pending.length > 0 && <span className="count-badge">{pending.length}</span>}
          {t.id === "mem" && mems.length > 0 && <span className="count-badge">{mems.length}</span>}
        </button>
      ))}
    </>
  );

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <span className="brand"><Brand sub="Dashboard" /></span>
          <div className="nav-links">
            <StatusPill tone={tone}>{statusText}</StatusPill>
          </div>
        </div>
      </nav>

      <div className="topbar-mobile">
        <div className="tabs-row">
          {nav("", (t) => `side-item${tab === t ? " active" : ""}`)}
        </div>
      </div>

      <div className="dash">
        <aside className="sidebar">
          <div className="side-user">
            <span className="avatar">{(email || "?").slice(0, 1).toUpperCase()}</span>
            <div style={{ minWidth: 0 }}>
              <b>{email || "…"}</b>
              <span>{connected ? "● online" : "○ offline"}</span>
            </div>
          </div>
          {nav("side-nav", (t) => `side-item${tab === t ? " active" : ""}`)}
          <div className="side-foot">
            <button className="side-item side-logout" onClick={logout}>↩ Logout</button>
          </div>
        </aside>

        <main className="dash-main">
          {tab === "overview" && (
            <>
              <div className="page-head">
                <h1>Overview 👋</h1>
                <p>Tumhare agent ka live haal — ek nazar me.</p>
              </div>

              <div className={`status-hero${connected ? "" : isQr || tone === "wait" ? " wait" : " dead"}`}>
                <span className={`status-dot${connected ? " ok" : tone === "wait" || isQr ? " wait" : " bad"}`} />
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h2>{connected ? "Agent live hai ✅" : isQr ? "QR ready — scan karo 📷" : isLoggedOut ? "Logged out hai 🔌" : "Agent jag raha hai ⏳"}</h2>
                  <p>
                    {connected
                      ? `Owner number ${status?.ownerNumber || owner || "—"} se message karke test karo.`
                      : isLoggedOut
                      ? "Connect tab me “Naya QR lo” dabao aur dobara link karo."
                      : "1–2 min me live ho jayega. Page khula rakho — Naya QR tabhi lo jab 10 min se zyada dead rahe."}
                  </p>
                </div>
                {!connected && <button className="ghost sm" onClick={() => setTab("connect")}>Connect →</button>}
              </div>

              <SectionHeader title="Setup progress" right={`${setupDone}/3 complete`} />
              <div className="setup-steps">
                {setup.map((s, i) => (
                  <div key={i} className={`setup-step${s.done ? " done" : ""}`}>
                    <span className="setup-check">{s.done ? "✓" : i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <b>{s.title}</b>
                      <p>{s.desc}</p>
                      {!s.done && <button className="ghost sm" onClick={() => setTab(s.go)}>{s.btn}</button>}
                    </div>
                  </div>
                ))}
              </div>

              <SectionHeader title="Stats" right="live" />
              <div className="stat-grid">
                <StatCard label="⏰ Pending" value={String(pending.length)} hint="reminders" />
                <StatCard label="🧠 Memories" value={String(mems.length)} hint="yaad hai" />
                <StatCard label="💬 Aaj ki chat" value={String(todayChats)} hint="messages" />
                <StatCard label="🏆 Contest" value={contest ? "✓" : "…"} hint={contest ? contest.name.slice(0, 18) : "load..."} />
              </div>

              {contest && (
                <div className="card">
                  <h2>🏆 Next LeetCode Contest</h2>
                  <p className="desc">{contest.name} — <b style={{ color: "var(--accent-2)" }}>{contest.startIST}</b> IST</p>
                  <p className="muted" style={{ margin: 0 }}>WhatsApp pe bolo: “contest se 30 min pehle remind kar”</p>
                </div>
              )}

              <SectionHeader title="Recent activity" right={`${chat.length} chats`} />
              {chat.length === 0 ? (
                <EmptyState icon="💤" title="Abhi koi baat nahi hui">Owner number se <b>hi</b> bhejo — yahi pe dikhega.</EmptyState>
              ) : (
                <ul className="list">
                  {chat.slice(-4).reverse().map((m, i) => (
                    <li key={i}>
                      <div className="li-head"><b>💬 {m.body.slice(0, 90)}</b></div>
                      {m.reply && <small>→ {m.reply.slice(0, 110)}</small>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "connect" && (
            <>
              <div className="page-head">
                <h1>Connect 🔗</h1>
                <p>Owner number + WhatsApp linking — sab kuch yahi se.</p>
              </div>

              <div className="card">
                <h2><span className="step-num">1</span> &nbsp;Owner number (tumhara number)</h2>
                <p className="desc">Jis number se tum agent se baat karoge — agent SIRF isi ko reply karega.</p>
                <div className="row">
                  <input value={owner} onChange={(e) => setOwner(e.currentTarget.value)} placeholder="91XXXXXXXXXX" />
                  <button onClick={saveOwner}>Save</button>
                </div>
                {ownerMsg && <p className={ownerMsg.startsWith("Saved") ? "ok-text" : "muted"}>{ownerMsg}</p>}
              </div>

              <div className="card">
                <h2><span className="step-num">2</span> &nbsp;WhatsApp link karo (agent wala number)</h2>
                <p className="desc">Agent wale phone me: WhatsApp → ⋮ → Linked Devices → Link a Device.</p>
                <div className="qr-box">
                  {qr?.dataUrl ? (
                    <div className="qr"><img src={qr.dataUrl} alt="QR" width={220} height={220} /></div>
                  ) : connected ? (
                    <p className="ok-text">✅ Connected hai — owner number se message karke test karo.</p>
                  ) : (
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <Skeleton h={220} w="220px" />
                      <p className="muted" style={{ marginTop: 10 }}>QR aa raha hai… agent jag raha hoga to 1 min lagega.</p>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <StatusPill tone={tone}>{statusText}</StatusPill>
                    <p style={{ marginTop: 12 }}>
                      <button className="ghost sm" onClick={newQr} disabled={busy}>{busy ? "Ban raha..." : "🔄 Naya QR lo"}</button>
                    </p>
                    <p className="muted">Aadha-fasa lage to hi Naya QR dabao — warna auto-reconnect ka wait karo.</p>
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>QR na chale to — code se link karo</h2>
                <p className="desc">Number dalo → code lo → us phone me Linked Devices → “Link with phone number instead” me 1–2 min me type karo.</p>
                <div className="row">
                  <input value={agentNum} onChange={(e) => setAgentNum(e.currentTarget.value)} placeholder="91XXXXXXXXXX (agent SIM)" inputMode="numeric" />
                  <button onClick={getPairCode} disabled={busy}>{busy ? "..." : "Pairing code lo"}</button>
                </div>
                {pairCode && (<><p className="code">{pairCode}</p><p className="muted">Ye code <b>{pairNum}</b> ke liye hai — usi phone me type karo.</p></>)}
                {pairErr && <p className="err">{pairErr}</p>}
              </div>

              <div className="card">
                <h2>✉️ Test message</h2>
                <p className="desc">Owner number pe agent se ek message bhej ke connection verify karo.</p>
                <textarea value={testText} onChange={(e) => setTestText(e.currentTarget.value)} rows={2} />
                <button onClick={sendTest}>Send test →</button>
                {testMsg && <p className="muted">{testMsg}</p>}
              </div>
            </>
          )}

          {tab === "rems" && (
            <>
              <div className="page-head">
                <h1>Reminders ⏰</h1>
                <p>WhatsApp se banao (“10 min me yaad dila”), yaha dekho/hatayo.</p>
              </div>
              {rems.length === 0 ? (
                <EmptyState icon="⏰" title="Koi reminder nahi">WhatsApp pe bolo <b>“10 min me yaad dila dena”</b> — yahi dikhega.</EmptyState>
              ) : (
                <>
                  {pending.length > 0 && (
                    <>
                      <SectionHeader title="Pending" right={`${pending.length}`} />
                      <ul className="list">
                        {pending.map((r) => (
                          <li key={r.id}>
                            <div className="li-head"><b>⏰ {r.title}</b><a href="#" className="link-danger" onClick={(e) => { e.preventDefault(); delRem(r.id); }}>hatayo</a></div>
                            <small>{new Date(r.remind_at).toLocaleString("en-IN")} · {relTime(r.remind_at)} · {r.source}</small>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {rems.filter((r) => r.sent).length > 0 && (
                    <>
                      <SectionHeader title="Bhej diye" right="done" />
                      <ul className="list">
                        {rems.filter((r) => r.sent).map((r) => (
                          <li key={r.id}>
                            <div className="li-head"><b>✅ {r.title}</b></div>
                            <small>{new Date(r.remind_at).toLocaleString("en-IN")} · {r.source}</small>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}
            </>
          )}

          {tab === "mem" && (
            <>
              <div className="page-head">
                <h1>Memory 🧠</h1>
                <p>WhatsApp pe “yaad rakhna...” bola to yaha save hota hai.</p>
              </div>
              {mems.length === 0 ? (
                <EmptyState icon="🧠" title="Abhi kuch yaad nahi">Bolo <b>“yaad rakhna, mera naam…”</b> — pakki memory ban jayegi.</EmptyState>
              ) : (
                <ul className="list">
                  {mems.map((m) => (
                    <li key={m.id}>
                      <div className="li-head"><b>🧠 {m.fact}</b><a href="#" className="link-danger" onClick={(e) => { e.preventDefault(); delMem(m.id); }}>bhool jao</a></div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "chat" && (
            <>
              <div className="page-head">
                <h1>Chat 💬</h1>
                <p>Recent baatcheet — latest neeche.</p>
              </div>
              {chat.length === 0 ? (
                <EmptyState icon="💬" title="Abhi koi baat nahi hui">Pehla <b>hi</b> bhej ke dekho!</EmptyState>
              ) : (
                <div className="card">
                  <div className="chat">
                    {chat.map((m, i) => (
                      <div key={i} style={{ display: "contents" }}>
                        <div className="bubble u">{m.body}<small>{new Date(m.created_at).toLocaleString("en-IN")}</small></div>
                        {m.reply && <div className="bubble a">{m.reply}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
