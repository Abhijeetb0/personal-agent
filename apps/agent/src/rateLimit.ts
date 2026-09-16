import rateLimit from "express-rate-limit";

// General: 100 req/min per IP — baaki sab routes ke liye
export const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
  message: { error: "Bahut zyada requests — 1 min ruk ke fir aao." },
});

// Sensitive: 10 req/min — reset, pairing-code (session-intensive operations)
export const sensitiveLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
  message: { error: "Bahut zyada attempts — 1 min ruk ke fir try karo." },
});

// Send: 5 req/min — spam/abuse prevention (ye endpoint owner ko message bhejta hai)
export const sendLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
  message: { error: "Bahut zyada messages — 1 min ruk ke fir bhejo." },
});

// Chat: 10 req/min — web se brain baat (AI cost bachao, fir bhi smooth)
export const chatLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || "unknown",
  message: { error: "Thoda slow — 1 min me 10 sawal tak." },
});
