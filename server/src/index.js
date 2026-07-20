import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { migrate } from "./db.js";
import { createApiRouter } from "./routes.js";
import { DeviceHub } from "./devices/hub.js";
import { createMockAdapters, vendorAdapterStubs } from "./devices/mock.js";
import { logDeviceEvent } from "./services/audit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 7080);

migrate();

const deviceHub = new DeviceHub();
for (const a of createMockAdapters({ onEvent: logDeviceEvent })) {
  deviceHub.register(a);
}
// 厂商 stub 仅登记状态，不参与默认放行（online:false）
for (const a of Object.values(vendorAdapterStubs)) {
  deviceHub.register(a);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.use("/api", createApiRouter({ deviceHub }));

const webDist = path.join(__dirname, "../../web/dist");
app.use(express.static(webDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(webDist, "index.html"), (err) => {
    if (err) res.status(404).send("Web 未构建：开发请访问 Vite http://localhost:5175");
  });
});

app.listen(PORT, () => {
  console.log(`Carrier Gate Safety API  http://localhost:${PORT}`);
  console.log(`Devices: ${deviceHub.list().map((d) => d.id).join(", ")}`);
});
