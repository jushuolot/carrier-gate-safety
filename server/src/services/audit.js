import { nanoid } from "nanoid";
import { db } from "../db.js";

export function audit(actor, action, entityType, entityId, detail = {}) {
  db.prepare(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity_type, entity_id, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    nanoid(),
    actor?.id || null,
    actor?.name || "system",
    action,
    entityType || null,
    entityId || null,
    JSON.stringify(detail),
    new Date().toISOString()
  );
}

export function logDeviceEvent({ deviceType, deviceId, eventType, payload }) {
  db.prepare(
    `INSERT INTO device_events (id, device_type, device_id, event_type, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    nanoid(),
    deviceType,
    deviceId,
    eventType,
    JSON.stringify(payload || {}),
    new Date().toISOString()
  );
}
