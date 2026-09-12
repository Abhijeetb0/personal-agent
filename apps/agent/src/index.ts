import dotenv from "dotenv";
dotenv.config();
import { buildRoutes } from "./routes.js";
import { startAllSessions } from "./baileys.js";
import { startScheduler } from "./scheduler.js";

const PORT = Number(process.env.PORT || 3001);
const app = buildRoutes();

app.listen(PORT, () => {
  console.log(`[agent] multi-user API http://localhost:${PORT}`);
});

startAllSessions().catch((e) => console.error("[agent] boot sessions failed:", e));

startScheduler();
