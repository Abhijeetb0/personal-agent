export function Brand({ sub }: { sub?: string }) {
  return (
    <span className="brand">
      <span className="brand-mark">🤖</span>
      <span>
        Personal Agent
        {sub && <small>{sub}</small>}
      </span>
    </span>
  );
}

export type ConnTone = "ok" | "wait" | "bad" | "neutral";

export function StatusPill({ tone, children }: { tone: ConnTone; children: React.ReactNode }) {
  const cls = tone === "ok" ? "ok" : tone === "wait" ? "warn" : tone === "bad" ? "bad" : "neutral";
  return (
    <span className={`pill ${cls}`}>
      <span className="dot" />
      {children}
    </span>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {right && <p>{right}</p>}
    </div>
  );
}

export function Skeleton({ w, h }: { w?: string; h?: number }) {
  return <div className="skeleton" style={{ width: w || "100%", height: h || 18 }} />;
}
