import dotenv from "dotenv";
dotenv.config();
import logger from "./logger.js";
import { buildRoutes } from "./routes.js";
import { startAllSessions } from "./baileys.js";
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
