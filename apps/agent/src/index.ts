import dotenv from "dotenv";
dotenv.config();
import { buildRoutes } from "./routes.js";
import { startWhatsApp, state } from "./baileys.js";
import { startScheduler } from "./scheduler.js";

const PORT = Number(process.env.PORT || 3001);
const app = buildRoutes();

app.listen(PORT, () => {
  console.log(`[agent] API http://localhost:${PORT} status=${state.status}`);
});

startWhatsApp().catch((e) => {
  console.error("[agent] WhatsApp start failed:", e);
  process.exit(1);
});

startScheduler();
