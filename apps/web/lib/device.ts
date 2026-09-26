// Per-browser device identity + human-readable label (client-side only).
// Supabase logout se independent: localStorage me rehta hai.

const KEY = "pa-device-id";

export function deviceId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (globalThis.crypto as Crypto).randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "web-" + Math.random().toString(36).slice(2);
  }
}

// UA se chhota label: "Chrome • Windows" jaisa (server IP alag se jodta hai)
export function deviceLabel(ua?: string): string {
  const s = (ua || (typeof navigator !== "undefined" ? navigator.userAgent : "")).toLowerCase();
  let browser = "Browser";
  if (/edg\//.test(s)) browser = "Edge";
  else if (/opr\/|opera/.test(s)) browser = "Opera";
  else if (/firefox/.test(s)) browser = "Firefox";
  else if (/samsungbrowser/.test(s)) browser = "Samsung Internet";
  else if (/chrome\//.test(s)) browser = "Chrome";
  else if (/safari\//.test(s)) browser = "Safari";
  let os = "";
  if (/android/.test(s)) os = "Android";
  else if (/iphone|ipad|ipod/.test(s)) os = "iPhone";
  else if (/windows/.test(s)) os = "Windows";
  else if (/mac os|macintosh/.test(s)) os = "Mac";
  else if (/linux/.test(s)) os = "Linux";
  return os ? `${browser} • ${os}` : browser;
}
