import dotenv from "dotenv";
dotenv.config();
import logger from "./logger.js";
import { buildRoutes } from "./routes.js";
import { startAllSessions, ensureAllSessions } from "./baileys.js";
import { startScheduler } from "./scheduler.js";
import { startWatchdog } from "./watchdog.js";
import { logAvailableModels } from "./groq.js";

const PORT = Number(process.env.PORT || 3001);
const app = buildRoutes();

app.listen(PORT, () => {
  logger.info({ port: PORT }, "[agent] multi-user API started");
});

startAllSessions().catch((e) => logger.error({ err: e }, "[agent] boot sessions failed"));

logAvailableModels().catch(() => {});

startScheduler();
startWatchdog();

// General fix: auth-free ensure loop — website login ke bina bhi Render wake pe
// paired sessions khud jag jayen (laptop band ho ya logout ho, reply aana chahiye).
// Watchdog already har 1-min dekhta hai; ye har 3-min ka safety net hai.
setInterval(() => {
  ensureAllSessions("ensure-interval").catch((e) => logger.error({ err: e }, "[agent] ensure loop fail"));
}, 3 * 60_000);
