// Sirf OWNER_NUMBER ko reply. Baki sab ignore (privacy + ban-risk kam).
export function normalize(num: string): string {
  return (num || "").replace(/[^0-9]/g, "");
}

export function getOwner(): string {
  return normalize(process.env.OWNER_NUMBER || "917761815151");
}

export function isOwner(from: string): boolean {
  const f = normalize(from);
  const o = getOwner();
  if (!f || !o) return false;
  if (f === o) return true;
  // last 10 digit match (91 prefix / 0 prefix variations)
  return f.slice(-10) === o.slice(-10);
}
