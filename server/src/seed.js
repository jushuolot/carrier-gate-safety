import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db, migrate } from "./db.js";

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

migrate();

// reset
db.exec(`
  DELETE FROM device_events;
  DELETE FROM audit_logs;
  DELETE FROM visits;
  DELETE FROM training_records;
  DELETE FROM quiz_questions;
  DELETE FROM training_courses;
  DELETE FROM documents;
  DELETE FROM users;
  DELETE FROM vehicles;
  DELETE FROM drivers;
  DELETE FROM carriers;
  DELETE FROM sites;
  DELETE FROM settings;
`);

const now = new Date().toISOString();
const siteId = "site-1";

db.prepare(`INSERT INTO sites (id, name, address) VALUES (?, ?, ?)`).run(
  siteId,
  "华东一号仓",
  "上海市浦东新区示例路 88 号"
);

const carrierId = "carrier-1";
const carrierSelf = "carrier-self";
db.prepare(
  `INSERT INTO carriers (id, name, credit_code, status, risk_score, created_at) VALUES (?, ?, ?, ?, ?, ?)`
).run(carrierId, "示例物流有限公司", "91310000MA1XXXXX1X", "active", 0, now);
db.prepare(
  `INSERT INTO carriers (id, name, credit_code, status, risk_score, created_at) VALUES (?, ?, ?, ?, ?, ?)`
).run(carrierSelf, "客户自提通道", "SELF-PICKUP", "active", 0, now);

const driverNew = "driver-new";
const driverOk = "driver-ok";
const driverPickup = "driver-pickup";
db.prepare(
  `INSERT INTO drivers (id, carrier_id, name, phone, id_masked, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
).run(driverNew, carrierId, "新司机·王强", "13900000001", "310***2001", "active", now);
db.prepare(
  `INSERT INTO drivers (id, carrier_id, name, phone, id_masked, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
).run(driverOk, carrierId, "熟手·李明", "13900000002", "310***2002", "active", now);
db.prepare(
  `INSERT INTO drivers (id, carrier_id, name, phone, id_masked, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
).run(driverPickup, carrierSelf, "自提客户（通用）", "13700000001", "310***9001", "active", now);

const veh1 = "veh-1";
const veh2 = "veh-2";
const vehPickup = "veh-pickup";
db.prepare(
  `INSERT INTO vehicles (id, carrier_id, plate_no, vehicle_type, status, created_at, plate_color, network_directory_ok, network_directory_at, permit_mismatch)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(veh1, carrierId, "沪A12345", "重型厢式货车", "active", now, "2", 1, now, 0);
db.prepare(
  `INSERT INTO vehicles (id, carrier_id, plate_no, vehicle_type, status, created_at, plate_color, network_directory_ok, network_directory_at, permit_mismatch)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(veh2, carrierId, "沪B67890", "重型厢式货车", "active", now, "2", 0, null, 0);
db.prepare(
  `INSERT INTO vehicles (id, carrier_id, plate_no, vehicle_type, status, created_at, plate_color, network_directory_ok, network_directory_at, permit_mismatch)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(vehPickup, carrierSelf, "沪C88888", "小型客车/自提", "active", now, "1", 0, null, 0);

const users = [
  ["u-admin", "13800000000", "系统管理员", "admin123", "admin", null, null],
  ["u-ehs", "13800000001", "EHS安全员", "ehs123", "ehs", null, null],
  ["u-gate", "13800000002", "门岗值班", "gate123", "gate", null, null],
  ["u-carrier", "13800000003", "承运商管理员", "carrier123", "carrier_admin", carrierId, null],
  ["u-d1", "13900000001", "新司机·王强", "driver123", "driver", carrierId, driverNew],
  ["u-d2", "13900000002", "熟手·李明", "driver123", "driver", carrierId, driverOk],
  ["u-pickup", "13700000001", "自提客户·陈女士", "pickup123", "driver", carrierSelf, driverPickup],
];

const insUser = db.prepare(
  `INSERT INTO users (id, phone, name, password_hash, role, carrier_id, driver_id, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const u of users) {
  insUser.run(u[0], u[1], u[2], bcrypt.hashSync(u[3], 8), u[4], u[5], u[6], now);
}

const courseId = "course-1";
db.prepare(
  `INSERT INTO training_courses
   (id, site_id, title, video_url, min_watch_seconds, pass_score, valid_days, version, active)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(
  courseId,
  siteId,
  "厂区安全准入培训（2026）",
  "/media/safety-briefing.mp4",
  30,
  80,
  365,
  1,
  1
);

const questions = [
  ["进入厂区必须佩戴哪些防护用品？", ["仅安全帽", "安全帽与反光背心", "随意着装", "仅手套"], 1],
  ["车辆限速一般为多少？", ["不限速", "≤20km/h", "≤60km/h", "≤80km/h"], 1],
  ["发现泄漏或火情应首先？", ["继续作业", "离开并上报", "围观拍照", "自行处理化学品"], 1],
  ["装卸作业时发动机应？", ["保持怠速", "熄火并拉驻车", "加大油门", "无人看管"], 1],
  ["证件过期时系统策略是？", ["口头说明即可", "硬拦截不得入场", "交押金放行", "门岗随意决定"], 1],
];

const insQ = db.prepare(
  `INSERT INTO quiz_questions (id, course_id, stem, options_json, answer_index) VALUES (?, ?, ?, ?, ?)`
);
for (const q of questions) {
  insQ.run(nanoid(), courseId, q[0], JSON.stringify(q[1]), q[2]);
}

// 熟手司机：培训已通过 + 证件齐全
db.prepare(
  `INSERT INTO training_records
   (id, driver_id, course_id, site_id, watched_seconds, video_completed, quiz_score, quiz_passed, valid_until, completed_at, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(
  nanoid(),
  driverOk,
  courseId,
  siteId,
  120,
  1,
  100,
  1,
  addDays(300),
  now,
  now
);

function insertDoc(subjectType, subjectId, docType, expireDays) {
  const t = new Date().toISOString();
  db.prepare(
    `INSERT INTO documents
     (id, subject_type, subject_id, doc_type, file_name, ocr_json, expire_at, status, confidence, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    nanoid(),
    subjectType,
    subjectId,
    docType,
    `${docType}.jpg`,
    JSON.stringify({ provider: "seed", expireAt: addDays(expireDays) }),
    addDays(expireDays),
    "valid",
    0.95,
    t,
    t
  );
}

for (const doc of ["driver_license", "qualification"]) {
  insertDoc("driver", driverOk, doc, 200);
}
for (const doc of ["vehicle_license", "insurance"]) {
  insertDoc("vehicle", veh1, doc, 180);
  insertDoc("vehicle", veh2, doc, 180);
}
insertDoc("carrier", carrierId, "transport_permit", 400);
insertDoc("driver", driverOk, "hazmat_permit", 180);
insertDoc("vehicle", veh1, "manifest", 30);

// 即将过期样例（演示预警）
insertDoc("driver", driverNew, "driver_license", 5);

db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`).run(
  "device_mode",
  "mock"
);
db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`).run(
  "exception_dual_approve",
  "true"
);
db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`).run("slot_capacity", "4");
db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`).run("dwell_warn_minutes", "90");
db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`).run(
  "warehouse_notify_email",
  "warehouse-leads@example.com"
);
db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`).run(
  "hazmat_verify_provider",
  "mock-hazmat-verify"
);
db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`).run(
  "hazmat_directory_mode",
  "manual_cached"
);
db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)`).run(
  "hazmat_carrier_license_ok",
  "true"
);

insertDoc("driver", driverOk, "id_card", 2000);

const day = now.slice(0, 10);
const slotA = `${day}T09:00:00`;
const slotAEnd = `${day}T09:30:00`;
const slotB = `${day}T10:00:00`;
const slotBEnd = `${day}T10:30:00`;

// 门岗演示待办：低风险安检中 + 高风险待准入
db.prepare(
  `INSERT INTO visits
   (id, site_id, carrier_id, driver_id, vehicle_id, appointment_at, status, block_reasons,
    checkin_at, admitted_at, visit_type, selected_options, slot_start, slot_end,
    pass_code, risk_score, risk_level, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, 'inspecting', NULL, ?, ?, 'carrier_inbound', '[]', ?, ?, ?, ?, ?, ?, ?)`
).run(
  "visit-demo-inspect",
  siteId,
  carrierId,
  driverOk,
  veh1,
  slotA,
  now,
  now,
  slotA,
  slotAEnd,
  "GATE01",
  22,
  "low",
  now,
  now
);

db.prepare(
  `INSERT INTO visits
   (id, site_id, carrier_id, driver_id, vehicle_id, appointment_at, status, block_reasons,
    checkin_at, visit_type, selected_options, slot_start, slot_end,
    pass_code, risk_score, risk_level, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, 'access_pending', ?, ?, 'carrier_inbound', '[]', ?, ?, ?, ?, ?, ?, ?)`
).run(
  "visit-demo-pending",
  siteId,
  carrierId,
  driverNew,
  veh2,
  slotB,
  JSON.stringify([
    { code: "TRAINING_REQUIRED", message: "首次到场或培训失效：须完成安全视频并答题通过" },
  ]),
  now,
  slotB,
  slotBEnd,
  "WAIT88",
  78,
  "high",
  now,
  now
);

const slotC = `${day}T11:00:00`;
const slotCEnd = `${day}T11:30:00`;
const slotD = `${day}T13:00:00`;
const slotDEnd = `${day}T13:30:00`;

db.prepare(
  `INSERT INTO visits
   (id, site_id, carrier_id, driver_id, vehicle_id, appointment_at, status, block_reasons,
    checkin_at, admitted_at, visit_type, selected_options, pickup_ref, slot_start, slot_end,
    pass_code, risk_score, risk_level, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, 'inspecting', NULL, ?, ?, 'carrier_inbound', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(
  "visit-demo-hazmat",
  siteId,
  carrierId,
  driverOk,
  veh1,
  slotC,
  now,
  now,
  JSON.stringify(["hazmat"]),
  "DN-HAZ-20260722",
  slotC,
  slotCEnd,
  "HAZ001",
  35,
  "medium",
  now,
  now
);

db.prepare(
  `INSERT INTO visits
   (id, site_id, carrier_id, driver_id, vehicle_id, appointment_at, status, block_reasons,
    checkin_at, visit_type, selected_options, pickup_ref, slot_start, slot_end,
    pass_code, risk_score, risk_level, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, 'access_pending', ?, ?, 'carrier_inbound', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
).run(
  "visit-demo-hazmat-block",
  siteId,
  carrierId,
  driverOk,
  veh2,
  slotD,
  JSON.stringify([{ code: "HAZMAT_DIR_NOT_LISTED", message: "未通过上海联网联控目录/准入核验" }]),
  now,
  JSON.stringify(["hazmat"]),
  "DN-HAZ-BLOCK",
  slotD,
  slotDEnd,
  "HAZBAD",
  82,
  "high",
  now,
  now
);

console.log("Seed OK");
console.log("Site:", siteId);
console.log("Drivers: 13900000001 (首次) / 13900000002 (已准入)");
console.log("Hazmat demo pass codes: HAZ001 (ok) / HAZBAD (directory block)");
console.log("Self-pickup: 13700000001 / pickup123");
console.log("Gate: 13800000002 / gate123");
console.log("Demo visits: inspecting(GATE01) + access_pending(WAIT88)");
