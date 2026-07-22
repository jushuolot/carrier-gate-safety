/**
 * GitHub Pages 演示：浏览器内 mock API（无后端）
 * 数据落在 localStorage，刷新可续。
 */

import { localDocOk, verifyHazmat } from "../../server/src/services/hazmatVerify.js";

const STORE_KEY = "cgs-pages-demo-v8";
const LEGACY_STORE_KEYS = [
  "cgs-pages-demo-v1",
  "cgs-pages-demo-v2",
  "cgs-pages-demo-v3",
  "cgs-pages-demo-v4",
  "cgs-pages-demo-v5",
  "cgs-pages-demo-v6",
  "cgs-pages-demo-v7",
];

const CAP = {
  audit: 40,
  deviceEvents: 24,
  visits: 36,
  documents: 60,
  training: 24,
};

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function now() {
  return new Date().toISOString();
}

function nid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function makePassCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function slotCapacity(s) {
  return Number(s.settings?.slot_capacity ?? 4);
}

function dwellWarnMinutes(s) {
  return Number(s.settings?.dwell_warn_minutes ?? 90);
}

function dualApprove(s) {
  return String(s.settings?.exception_dual_approve ?? "true") === "true";
}

function listSlots(s, dayIso) {
  const day = dayIso || addDays(0);
  const capacity = slotCapacity(s);
  const slots = [];
  for (let h = 8; h < 18; h++) {
    for (const m of [0, 30]) {
      const start = `${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
      const endMin = m + 30;
      const endH = endMin >= 60 ? h + 1 : h;
      const endM = endMin % 60;
      const end = `${day}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;
      const booked = s.visits.filter(
        (v) => v.slot_start === start && !["rejected", "completed"].includes(v.status)
      ).length;
      slots.push({
        slotStart: start,
        slotEnd: end,
        label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}–${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
        capacity,
        booked,
        remaining: Math.max(0, capacity - booked),
        available: booked < capacity,
      });
    }
  }
  return slots;
}

function dwellMinutes(onsiteAt) {
  if (!onsiteAt) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(onsiteAt).getTime()) / 60000));
}

function computeRisk(s, { allowed, reasons, training, driverId, carrierId, visitType }) {
  if (visitType === "self_pickup" || visitType === "temporary") {
    return {
      riskScore: visitType === "temporary" ? 40 : 25,
      riskLevel: visitType === "temporary" ? "medium" : "low",
      riskFactors: [visitType === "temporary" ? "rf_temporary_lane" : "rf_self_pickup_lane"],
      fastLane: visitType === "self_pickup",
    };
  }
  let score = 12;
  const factors = [];
  if (!allowed) {
    score += 35;
    factors.push("rf_access_denied");
  }
  for (const r of reasons || []) {
    if (r.code?.includes("TRAINING")) {
      score += 18;
      factors.push("rf_training");
    }
    if (r.code?.includes("DOC")) {
      score += 12;
      factors.push("rf_doc");
    }
  }
  if (training?.valid_until) {
    const daysLeft = Math.ceil((new Date(training.valid_until).getTime() - Date.now()) / 86400000);
    if (daysLeft <= 30) {
      score += 15;
      factors.push(`rf_training_expiring:${daysLeft}`);
    }
  } else if (!training) {
    score += 10;
    factors.push("rf_no_training");
  }
  const priorOk = s.visits.filter((v) => v.driver_id === driverId && v.status === "completed").length;
  if (priorOk === 0) {
    score += 14;
    factors.push("rf_first_visit");
  }
  const priorBlocks = s.visits.filter(
    (v) =>
      v.carrier_id === carrierId &&
      ["access_pending", "rejected"].includes(v.status) &&
      (v.created_at || "").slice(0, 10) >= addDays(-30)
  ).length;
  if (priorBlocks > 0) {
    score += Math.min(20, priorBlocks * 5);
    factors.push(`rf_carrier_blocks:${priorBlocks}`);
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  let riskLevel = "low";
  if (score >= 60) riskLevel = "high";
  else if (score >= 35) riskLevel = "medium";
  return {
    riskScore: score,
    riskLevel,
    riskFactors: [...new Set(factors)].slice(0, 6),
    fastLane: riskLevel === "low" && allowed,
  };
}

function seed() {
  const courseId = "course-1";
  const qids = ["q1", "q2", "q3", "q4", "q5"];
  return {
    users: [
      { id: "u-admin", phone: "13800000000", name: "系统管理员", password: "admin123", role: "admin", carrier_id: null, driver_id: null },
      { id: "u-ehs", phone: "13800000001", name: "EHS安全员", password: "ehs123", role: "ehs", carrier_id: null, driver_id: null },
      { id: "u-gate", phone: "13800000002", name: "门岗值班", password: "gate123", role: "gate", carrier_id: null, driver_id: null },
      { id: "u-carrier", phone: "13800000003", name: "承运商管理员", password: "carrier123", role: "carrier_admin", carrier_id: "carrier-1", driver_id: null },
      { id: "u-d1", phone: "13900000001", name: "新司机·王强", password: "driver123", role: "driver", carrier_id: "carrier-1", driver_id: "driver-new" },
      { id: "u-d2", phone: "13900000002", name: "熟手·李明", password: "driver123", role: "driver", carrier_id: "carrier-1", driver_id: "driver-ok" },
      { id: "u-pickup", phone: "13700000001", name: "自提客户·陈女士", password: "pickup123", role: "driver", carrier_id: "carrier-self", driver_id: "driver-pickup" },
    ],
    carriers: [
      { id: "carrier-1", name: "示例物流有限公司", credit_code: "91310000MA1XXXXX1X", status: "active", risk_score: 0 },
      { id: "carrier-self", name: "客户自提通道", credit_code: "SELF-PICKUP", status: "active", risk_score: 0 },
    ],
    drivers: [
      { id: "driver-new", carrier_id: "carrier-1", name: "新司机·王强", phone: "13900000001", status: "active" },
      { id: "driver-ok", carrier_id: "carrier-1", name: "熟手·李明", phone: "13900000002", status: "active" },
      { id: "driver-pickup", carrier_id: "carrier-self", name: "自提客户（通用）", phone: "13700000001", status: "active" },
    ],
    vehicles: [
      {
        id: "veh-1",
        carrier_id: "carrier-1",
        plate_no: "沪A12345",
        plate_color: "2",
        vehicle_type: "重型厢式货车",
        status: "active",
        network_directory_ok: true,
        network_directory_at: now(),
        permit_mismatch: false,
      },
      {
        id: "veh-2",
        carrier_id: "carrier-1",
        plate_no: "沪B67890",
        plate_color: "2",
        vehicle_type: "重型厢式货车",
        status: "active",
        network_directory_ok: false,
        network_directory_at: null,
        permit_mismatch: false,
      },
      {
        id: "veh-pickup",
        carrier_id: "carrier-self",
        plate_no: "沪C88888",
        plate_color: "1",
        vehicle_type: "小型客车/自提",
        status: "active",
        network_directory_ok: false,
        network_directory_at: null,
        permit_mismatch: false,
      },
    ],
    sites: [{ id: "site-1", name: "华东一号仓", address: "上海市浦东新区示例路 88 号" }],
    course: {
      id: courseId,
      site_id: "site-1",
      title: "厂区安全准入培训（2026）",
      min_watch_seconds: 30,
      pass_score: 80,
      valid_days: 365,
    },
    questions: [
      { id: qids[0], stem: "进入厂区必须佩戴哪些防护用品？", options: ["仅安全帽", "安全帽与反光背心", "随意着装", "仅手套"], answer_index: 1 },
      { id: qids[1], stem: "车辆限速一般为多少？", options: ["不限速", "≤20km/h", "≤60km/h", "≤80km/h"], answer_index: 1 },
      { id: qids[2], stem: "发现泄漏或火情应首先？", options: ["继续作业", "离开并上报", "围观拍照", "自行处理化学品"], answer_index: 1 },
      { id: qids[3], stem: "装卸作业时发动机应？", options: ["保持怠速", "熄火并拉驻车", "加大油门", "无人看管"], answer_index: 1 },
      { id: qids[4], stem: "证件过期时系统策略是？", options: ["口头说明即可", "硬拦截不得入场", "交押金放行", "门岗随意决定"], answer_index: 1 },
    ],
    training: [
      {
        id: "tr-ok",
        driver_id: "driver-ok",
        course_id: courseId,
        site_id: "site-1",
        watched_seconds: 120,
        video_completed: 1,
        quiz_score: 100,
        quiz_passed: 1,
        valid_until: addDays(300),
        completed_at: now(),
        created_at: now(),
      },
    ],
    documents: [
      doc("driver", "driver-ok", "driver_license", 200),
      doc("driver", "driver-ok", "qualification", 200),
      doc("driver", "driver-ok", "id_card", 2000),
      doc("vehicle", "veh-1", "vehicle_license", 180),
      doc("vehicle", "veh-1", "insurance", 180),
      doc("vehicle", "veh-2", "vehicle_license", 180),
      doc("vehicle", "veh-2", "insurance", 180),
      doc("carrier", "carrier-1", "transport_permit", 400),
      doc("driver", "driver-ok", "hazmat_permit", 180),
      doc("vehicle", "veh-1", "manifest", 30),
      doc("driver", "driver-new", "driver_license", 5),
    ],
    visits: [
      {
        id: "visit-demo-inspect",
        site_id: "site-1",
        carrier_id: "carrier-1",
        driver_id: "driver-ok",
        vehicle_id: "veh-1",
        appointment_at: `${addDays(0)}T09:00:00`,
        checkin_at: now(),
        admitted_at: now(),
        status: "inspecting",
        block_reasons: null,
        visit_type: "carrier_inbound",
        selected_options: [],
        customer_name: null,
        customer_phone: null,
        pickup_ref: null,
        slot_start: `${addDays(0)}T09:00:00`,
        slot_end: `${addDays(0)}T09:30:00`,
        pass_code: "GATE01",
        risk_score: 22,
        risk_level: "low",
        created_at: now(),
        updated_at: now(),
      },
      {
        id: "visit-demo-hazmat",
        site_id: "site-1",
        carrier_id: "carrier-1",
        driver_id: "driver-ok",
        vehicle_id: "veh-1",
        appointment_at: `${addDays(0)}T11:00:00`,
        checkin_at: now(),
        admitted_at: now(),
        status: "inspecting",
        block_reasons: null,
        visit_type: "carrier_inbound",
        selected_options: ["hazmat"],
        customer_name: null,
        customer_phone: null,
        pickup_ref: "DN-HAZ-20260722",
        slot_start: `${addDays(0)}T11:00:00`,
        slot_end: `${addDays(0)}T11:30:00`,
        pass_code: "HAZ001",
        risk_score: 35,
        risk_level: "medium",
        created_at: now(),
        updated_at: now(),
      },
      {
        id: "visit-demo-hazmat-block",
        site_id: "site-1",
        carrier_id: "carrier-1",
        driver_id: "driver-ok",
        vehicle_id: "veh-2",
        appointment_at: `${addDays(0)}T13:00:00`,
        checkin_at: now(),
        status: "access_pending",
        block_reasons: [
          { code: "HAZMAT_DIR_NOT_LISTED", message: "HAZMAT_DIR_NOT_LISTED" },
        ],
        visit_type: "carrier_inbound",
        selected_options: ["hazmat"],
        customer_name: null,
        customer_phone: null,
        pickup_ref: "DN-HAZ-BLOCK",
        slot_start: `${addDays(0)}T13:00:00`,
        slot_end: `${addDays(0)}T13:30:00`,
        pass_code: "HAZBAD",
        risk_score: 82,
        risk_level: "high",
        created_at: now(),
        updated_at: now(),
      },
      {
        id: "visit-demo-pending",
        site_id: "site-1",
        carrier_id: "carrier-1",
        driver_id: "driver-new",
        vehicle_id: "veh-2",
        appointment_at: `${addDays(0)}T10:00:00`,
        checkin_at: now(),
        status: "access_pending",
        block_reasons: [
          { code: "TRAINING_REQUIRED", message: "TRAINING_REQUIRED" },
        ],
        visit_type: "carrier_inbound",
        selected_options: [],
        customer_name: null,
        customer_phone: null,
        pickup_ref: null,
        slot_start: `${addDays(0)}T10:00:00`,
        slot_end: `${addDays(0)}T10:30:00`,
        pass_code: "WAIT88",
        risk_score: 78,
        risk_level: "high",
        created_at: now(),
        updated_at: now(),
      },
    ],
    settings: {
      device_mode: "mock",
      exception_dual_approve: "true",
      slot_capacity: 4,
      dwell_warn_minutes: 90,
      hazmat_verify_provider: "mock-hazmat-verify",
      hazmat_directory_mode: "manual_cached",
      hazmat_carrier_license_ok: "true",
    },
    audit: [],
    deviceEvents: [],
    devices: [
      { id: "barrier-in-1", type: "barrier", name: "一号门入口道闸（模拟）", online: true },
      { id: "barrier-out-1", type: "barrier", name: "一号门出口道闸（模拟）", online: true },
      { id: "lpr-gate-1", type: "lpr", name: "入口车牌识别（模拟）", online: true },
      { id: "cam-gate-1", type: "camera", name: "门岗抓拍相机（模拟）", online: true },
      { id: "scale-1", type: "weighbridge", name: "地磅 1#（模拟）", online: true },
      { id: "face-1", type: "face", name: "人脸核验终端（模拟·可选）", online: true },
      { id: "hik-barrier-stub", type: "barrier", name: "海康道闸（待对接）", online: false },
      { id: "dahua-lpr-stub", type: "lpr", name: "大华车牌识别（待对接）", online: false },
    ],
  };
}

function doc(subjectType, subjectId, docType, days) {
  return {
    id: nid(),
    subject_type: subjectType,
    subject_id: subjectId,
    doc_type: docType,
    expire_at: addDays(days),
    status: "valid",
    confidence: 0.95,
    ocr_json: { expireAt: addDays(days), provider: "pages-mock" },
    created_at: now(),
    updated_at: now(),
  };
}

const LABELS = {
  driver_license: "驾驶证",
  vehicle_license: "行驶证",
  qualification: "从业资格证",
  transport_permit: "道路运输证",
  insurance: "保险单",
  id_card: "身份证",
  hazmat_permit: "危化品从业资格/运输许可",
  manifest: "电子运单",
  delivery_note: "提货单/DN",
  auth_letter: "授权委托书",
};

const VISIT_TYPES = {
  carrier_inbound: {
    id: "carrier_inbound",
    label: "运输入场（送货）",
    accessMode: "full",
    inspectChecklist: [
      { key: "idMatch", label: "人证一致（证件与本人）" },
      { key: "ppe", label: "PPE 佩戴合格（安全帽/反光衣）" },
      { key: "vehicle", label: "车辆外观/轮胎/车牌核验" },
      { key: "docs", label: "纸质证件与系统一致" },
      { key: "hazard", label: "无泄漏/危化信息与电子运单一致" },
    ],
    departCore: [
      { key: "loadDone", label: "装卸作业完成确认" },
      { key: "inventoryDone", label: "仓管按 DN/实物核对完成" },
      { key: "ehsDepartCheck", label: "EHS 离场安全检查" },
    ],
    departOptional: [
      { key: "hazmat", label: "危化品运输（须电子运单一致）" },
      { key: "weighbridge", label: "过磅记录" },
      { key: "sealPhoto", label: "铅封拍照取证" },
    ],
  },
  carrier_outbound: {
    id: "carrier_outbound",
    label: "运输出场（提货）",
    accessMode: "full",
    inspectChecklist: [
      { key: "idMatch", label: "人证一致（证件与本人）" },
      { key: "ppe", label: "PPE 佩戴合格" },
      { key: "vehicle", label: "车辆外观/车牌核验" },
      { key: "docs", label: "纸质证件与系统一致" },
      { key: "orderMatch", label: "提货指令/DN 与预约一致" },
    ],
    departCore: [
      { key: "loadDone", label: "装货完成确认" },
      { key: "inventoryDone", label: "仓管按 DN 核对并电子签收" },
      { key: "ehsDepartCheck", label: "EHS 离场安全检查" },
    ],
    departOptional: [
      { key: "hazmat", label: "危化品运输（须电子运单一致）" },
      { key: "weighbridge", label: "过磅记录" },
      { key: "sealPhoto", label: "铅封拍照取证" },
    ],
  },
  carrier: { id: "carrier", label: "承运到场", aliasOf: "carrier_inbound" },
  self_pickup: {
    id: "self_pickup",
    label: "客户自提",
    accessMode: "light",
    inspectChecklist: [
      { key: "idVerify", label: "提货人身份核验" },
      { key: "orderMatch", label: "提货单/订单与实物一致" },
      { key: "authLetter", label: "授权委托书核验（如代提）" },
      { key: "ppe", label: "进入作业区 PPE 合格（若入区）" },
    ],
    departCore: [
      { key: "orderConfirm", label: "仓管按 DN 核对完成" },
      { key: "goodsHandover", label: "货物交接电子签收" },
      { key: "ehsDepartCheck", label: "EHS 离场检查" },
    ],
    departOptional: [
      { key: "safetyBrief", label: "现场安全告知（短训确认）" },
      { key: "vehicleInspect", label: "自提车辆外观检查" },
      { key: "weighbridge", label: "过磅" },
      { key: "packingPhoto", label: "装车/件数拍照取证" },
      { key: "invoicePrint", label: "打印出门证/提货凭证" },
    ],
  },
  temporary: {
    id: "temporary",
    label: "其他临时车辆",
    accessMode: "temporary",
    inspectChecklist: [
      { key: "idMatch", label: "人员身份核验" },
      { key: "vehicle", label: "车牌与登记一致" },
      { key: "purpose", label: "进厂事由确认" },
      { key: "ppe", label: "PPE 合格（若入作业区）" },
    ],
    departCore: [
      { key: "workDone", label: "临时作业/拜访完成" },
      { key: "ehsDepartCheck", label: "EHS 离场检查" },
    ],
    departOptional: [
      { key: "safetyBrief", label: "现场安全告知" },
      { key: "escortConfirm", label: "陪同人确认" },
    ],
  },
};

function normalizeVisitType(visitType) {
  if (!visitType || visitType === "carrier") return "carrier_inbound";
  const t = VISIT_TYPES[visitType];
  if (t?.aliasOf) return t.aliasOf;
  return t ? t.id : "carrier_inbound";
}

function getVisitProfile(visitType) {
  return VISIT_TYPES[normalizeVisitType(visitType)] || VISIT_TYPES.carrier_inbound;
}

function resolveDepartSteps(visitType, selectedOptions = []) {
  const profile = getVisitProfile(visitType);
  const allowed = new Set(profile.departOptional.map((s) => s.key));
  const selected = (selectedOptions || []).filter((k) => allowed.has(k) && k !== "hazmat");
  const optMap = Object.fromEntries(profile.departOptional.map((s) => [s.key, s]));
  return [
    ...profile.departCore.map((s) => ({ ...s, required: true, source: "core" })),
    ...selected.map((key) => ({ ...optMap[key], required: true, source: "optional" })),
  ];
}

function makeArchiveKey(plateNo, at = new Date()) {
  const d = at instanceof Date ? at : new Date(at);
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const plate = String(plateNo || "NOPLATE").replace(/\s+/g, "").toUpperCase();
  return `${ymd}_${plate}`;
}

function clearLegacyStores() {
  try {
    const kill = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("cgs-pages-demo")) kill.push(k);
    }
    for (const k of kill) {
      if (k !== STORE_KEY) localStorage.removeItem(k);
    }
    for (const k of LEGACY_STORE_KEYS) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** 压缩演示库，避免 localStorage 配额打满导致登录失败 */
function pruneStore(s) {
  if (!s || typeof s !== "object") return s;
  if (Array.isArray(s.audit) && s.audit.length > CAP.audit) {
    s.audit = s.audit.slice(0, CAP.audit);
  }
  if (Array.isArray(s.deviceEvents) && s.deviceEvents.length > CAP.deviceEvents) {
    s.deviceEvents = s.deviceEvents.slice(0, CAP.deviceEvents);
  }
  if (Array.isArray(s.documents) && s.documents.length > CAP.documents) {
    s.documents = s.documents.slice(0, CAP.documents);
  }
  if (Array.isArray(s.training) && s.training.length > CAP.training) {
    s.training = s.training.slice(0, CAP.training);
  }
  if (Array.isArray(s.visits) && s.visits.length > CAP.visits) {
    const keepIds = new Set(["visit-demo-inspect", "visit-demo-pending"]);
    const demos = s.visits.filter((v) => keepIds.has(v.id));
    const rest = s.visits.filter((v) => !keepIds.has(v.id)).slice(0, CAP.visits - demos.length);
    s.visits = [...demos, ...rest];
  }
  return s;
}

function load() {
  clearLegacyStores();
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return pruneStore(parsed);
    }
  } catch {
    /* ignore */
  }
  const s = seed();
  save(s);
  return s;
}

function save(s) {
  pruneStore(s);
  const payload = JSON.stringify(s);
  try {
    localStorage.setItem(STORE_KEY, payload);
    return;
  } catch (e) {
    const quota =
      e?.name === "QuotaExceededError" ||
      e?.code === 22 ||
      /quota|exceeded/i.test(String(e?.message || e));
    if (!quota) throw e;
  }

  // 配额恢复：清旧键 → 再裁剪 → 仍失败则重置种子
  clearLegacyStores();
  try {
    localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
  s.audit = (s.audit || []).slice(0, 10);
  s.deviceEvents = (s.deviceEvents || []).slice(0, 8);
  s.visits = (s.visits || [])
    .filter((v) => ["visit-demo-inspect", "visit-demo-pending"].includes(v.id) || v.status !== "completed")
    .slice(0, 12);
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
    return;
  } catch {
    /* fall through */
  }
  const fresh = seed();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(fresh));
    Object.keys(s).forEach((k) => delete s[k]);
    Object.assign(s, fresh);
  } catch (e2) {
    throw new Error("浏览器本地存储已满，请清理本站数据后重试（设置 → 清除网站数据）");
  }
}

/** 供登录等场景：主动腾出配额 */
export function reclaimDemoStorage() {
  try {
    const kill = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("cgs-pages-demo") || k === "cgs_token" || k === "cgs_user")) {
        kill.push(k);
      }
    }
    for (const k of kill) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

function publicUser(u) {
  const { password, ...rest } = u;
  return rest;
}

function enrichVisit(s, v) {
  const d = s.drivers.find((x) => x.id === v.driver_id);
  const vh = s.vehicles.find((x) => x.id === v.vehicle_id);
  const c = s.carriers.find((x) => x.id === v.carrier_id);
  const visitType = normalizeVisitType(v.visit_type || "carrier");
  const selectedOptions = v.selected_options || [];
  const mins = dwellMinutes(v.onsite_at);
  const warn = dwellWarnMinutes(s);
  const departure = v.departure_json || null;
  const signs = departure?.signs || { driver: null, gate: null };
  return {
    ...v,
    visit_type: visitType,
    visit_type_label: getVisitProfile(visitType).label,
    selected_options: selectedOptions,
    depart_steps: resolveDepartSteps(visitType, selectedOptions),
    driver_name: d?.name,
    driver_phone: d?.phone,
    plate_no: vh?.plate_no,
    carrier_name: c?.name,
    block_reasons: v.block_reasons || null,
    inspection: v.inspection_json || null,
    departure,
    exception: v.exception_note || null,
    dwell_minutes: v.status === "onsite" || v.status === "departing" ? mins : null,
    dwell_over: (v.status === "onsite" || v.status === "departing") && mins >= warn,
    dwell_warn_minutes: warn,
    fast_lane: v.risk_level === "low",
    checkout_signs: signs,
    ready_for_sign: !!departure?.readyForSign,
    both_signed: !!(signs.driver && signs.gate),
    archive_key: v.archive_key || departure?.archiveKey || null,
  };
}

function evaluate(
  s,
  { driverId, vehicleId, carrierId, visitType = "carrier_inbound", selectedOptions = [], pickupRef = "" }
) {
  const type = normalizeVisitType(visitType);
  if (type === "self_pickup") {
    const base = {
      allowed: true,
      reasons: [],
      lights: { training: !selectedOptions.includes("safetyBrief"), documents: true, subject: true },
      mode: "self_pickup",
      note: "自提：预约须填 DN；身份/授权书/订单在门岗 Check In；离场须仓管签收 + 双签 Check Out",
      training: null,
      course: null,
    };
    return {
      ...base,
      ...computeRisk(s, {
        allowed: true,
        reasons: [],
        training: null,
        driverId,
        carrierId,
        visitType: type,
      }),
    };
  }
  if (type === "temporary") {
    const reasons = [];
    const today = addDays(0);
    const driver = s.drivers.find((d) => d.id === driverId);
    const vehicle = s.vehicles.find((v) => v.id === vehicleId);
    if (!driver || driver.status !== "active") reasons.push({ code: "DRIVER_BLOCKED" });
    if (!vehicle || vehicle.status !== "active") reasons.push({ code: "VEHICLE_BLOCKED" });
    const training = [...s.training]
      .filter((t) => t.driver_id === driverId && t.course_id === s.course.id && t.quiz_passed)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    let trainingOk = false;
    if (!training) reasons.push({ code: "TRAINING_REQUIRED" });
    else if (!training.valid_until || training.valid_until < today)
      reasons.push({ code: "TRAINING_EXPIRED", validUntil: training.valid_until || "-" });
    else trainingOk = true;
    const idDoc = s.documents.find(
      (x) => x.subject_type === "driver" && x.subject_id === driverId && x.doc_type === "id_card" && x.status === "valid"
    );
    if (!idDoc) reasons.push({ code: "DOC_MISSING", docType: "id_card" });
    else if (idDoc.expire_at && idDoc.expire_at < today)
      reasons.push({ code: "DOC_EXPIRED", docType: "id_card" });
    const allowed = reasons.length === 0;
    return {
      allowed,
      reasons,
      lights: {
        training: trainingOk,
        documents: !!idDoc && !(idDoc.expire_at && idDoc.expire_at < today),
        subject: !reasons.some((r) => ["DRIVER_BLOCKED", "VEHICLE_BLOCKED"].includes(r.code)),
      },
      training: training || null,
      course: s.course,
      mode: "temporary",
      ...computeRisk(s, { allowed, reasons, training: training || null, driverId, carrierId, visitType: type }),
    };
  }
  const reasons = [];
  const today = addDays(0);
  const carrier = s.carriers.find((c) => c.id === carrierId);
  const driver = s.drivers.find((d) => d.id === driverId);
  const vehicle = s.vehicles.find((v) => v.id === vehicleId);
  if (!carrier || carrier.status !== "active") reasons.push({ code: "CARRIER_BLOCKED" });
  if (!driver || driver.status !== "active") reasons.push({ code: "DRIVER_BLOCKED" });
  if (!vehicle || vehicle.status !== "active") reasons.push({ code: "VEHICLE_BLOCKED" });

  const training = [...s.training]
    .filter((t) => t.driver_id === driverId && t.course_id === s.course.id && t.quiz_passed)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
  let trainingOk = false;
  if (!training) reasons.push({ code: "TRAINING_REQUIRED" });
  else if (!training.valid_until || training.valid_until < today)
    reasons.push({ code: "TRAINING_EXPIRED", validUntil: training.valid_until || "-" });
  else trainingOk = true;

  const need = {
    driver: ["driver_license", "qualification"],
    vehicle: ["vehicle_license", "insurance"],
    carrier: ["transport_permit"],
  };
  const check = (stype, id, list) => {
    for (const dt of list) {
      const d = s.documents
        .filter((x) => x.subject_type === stype && x.subject_id === id && x.doc_type === dt && x.status === "valid")
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      if (!d) reasons.push({ code: "DOC_MISSING", docType: dt });
      else if (d.expire_at && d.expire_at < today)
        reasons.push({ code: "DOC_EXPIRED", docType: dt });
    }
  };
  check("driver", driverId, need.driver);
  check("vehicle", vehicleId, need.vehicle);
  check("carrier", carrierId, need.carrier);
  let hazmatVerify = null;
  if ((selectedOptions || []).includes("hazmat")) {
    const day = today;
    const docsOf = (stype, id) =>
      s.documents.filter((x) => x.subject_type === stype && x.subject_id === id);
    hazmatVerify = verifyHazmat({
      plateNo: vehicle?.plate_no || "",
      plateColor: vehicle?.plate_color || "2",
      driverName: driver?.name || "",
      transportPermitOk: localDocOk(docsOf("carrier", carrierId), "transport_permit", day),
      hazmatQualOk: localDocOk(docsOf("driver", driverId), "hazmat_permit", day),
      manifestOk: localDocOk(docsOf("vehicle", vehicleId), "manifest", day),
      carrierLicenseOk: s.settings?.hazmat_carrier_license_ok !== "false",
      networkDirectoryOk: !!vehicle?.network_directory_ok,
      networkDirectorySource: s.settings?.hazmat_directory_mode || "manual_cached",
      permitMismatch: !!vehicle?.permit_mismatch,
      identityMatch: true,
      pickupRef: pickupRef || "",
      provider: s.settings?.hazmat_verify_provider || "mock-hazmat-verify",
    });
    for (const r of hazmatVerify.reasons) reasons.push(r);
  }

  const docsOk = !reasons.some((r) => r.code === "DOC_MISSING" || r.code === "DOC_EXPIRED");
  const hazmatOk = !hazmatVerify || hazmatVerify.ok;
  const allowed = reasons.length === 0;
  const risk = computeRisk(s, {
    allowed,
    reasons,
    training: training || null,
    driverId,
    carrierId,
    visitType: type,
  });
  return {
    allowed,
    reasons,
    lights: {
      training: trainingOk,
      documents: docsOk,
      subject: !reasons.some((r) => ["CARRIER_BLOCKED", "DRIVER_BLOCKED", "VEHICLE_BLOCKED"].includes(r.code)),
      ...(hazmatVerify ? { hazmat: hazmatOk } : {}),
    },
    hazmatVerify,
    training: training || null,
    course: s.course,
    mode: type,
    ...risk,
  };
}

function audit(s, user, action, entityType, entityId, detail) {
  s.audit.unshift({
    id: nid(),
    actor_id: user?.id,
    actor_name: user?.name || "system",
    action,
    entity_type: entityType,
    entity_id: entityId,
    detail,
    created_at: now(),
  });
}

function deviceEvent(s, type, id, eventType, payload) {
  s.deviceEvents.unshift({
    id: nid(),
    device_type: type,
    device_id: id,
    event_type: eventType,
    payload,
    created_at: now(),
  });
}

function parse(path) {
  const [p, qs] = path.split("?");
  const q = Object.fromEntries(new URLSearchParams(qs || ""));
  return { path: p, q };
}

function getUserFromAuth(s, headers) {
  const token = (headers.Authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  return s.users.find((u) => u.id === token) || null;
}

export async function mockApi(path, options = {}) {
  const s = load();
  const method = (options.method || "GET").toUpperCase();
  const body = options.body || {};
  const headers = options.headers || {};
  const user = getUserFromAuth(s, headers);
  const { path: p, q } = parse(path);

  const ok = (data) => data;
  const fail = (msg, code = 400) => {
    const e = new Error(msg);
    e.status = code;
    throw e;
  };

  if (p === "/health") return ok({ ok: true, service: "carrier-gate-safety-pages", demo: true, ts: now() });

  if (p === "/auth/login" && method === "POST") {
    const u = s.users.find((x) => x.phone === body.phone && x.password === body.password);
    if (!u) fail("手机号或密码错误", 401);
    const safe = publicUser(u);
    // 演示环境不写 login 审计，减少配额压力
    return ok({ token: safe.id, user: safe });
  }

  if (p === "/me") {
    if (!user) fail("未登录", 401);
    return ok({ user: publicUser(user) });
  }

  if (!user && p !== "/health") fail("未登录", 401);

  if (p === "/sites") return ok({ items: s.sites });
  if (p === "/meta/doc-types") return ok({ labels: LABELS });
  if (p === "/meta/visit-types") {
    return ok({
      items: ["carrier_inbound", "carrier_outbound", "self_pickup", "temporary"].map((id) => {
        const t = getVisitProfile(id);
        return {
          id: t.id,
          label: t.label,
          accessMode: t.accessMode,
          departCore: t.departCore,
          departOptional: t.departOptional,
          inspectChecklist: t.inspectChecklist,
        };
      }),
    });
  }

  if (p === "/meta/slots") {
    const day = q.day || addDays(0);
    return ok({ day, capacity: slotCapacity(s), items: listSlots(s, day) });
  }

  if (p === "/meta/yard-config") {
    return ok({
      slotCapacity: slotCapacity(s),
      dwellWarnMinutes: dwellWarnMinutes(s),
      dualApprove: dualApprove(s),
    });
  }

  if (p === "/dashboard") {
    const today = addDays(0);
    const warn = dwellWarnMinutes(s);
    const onsiteRows = s.visits.filter((v) => v.status === "onsite");
    return ok({
      onsite: onsiteRows.length,
      todayAppointed: s.visits.filter((v) => (v.created_at || "").startsWith(today)).length,
      blocked: s.visits.filter((v) => ["access_pending", "rejected"].includes(v.status)).length,
      expiring30d: s.documents.filter((d) => d.expire_at && d.expire_at <= addDays(30)).length,
      expired: s.documents.filter((d) => d.expire_at && d.expire_at < addDays(0)).length,
      exceptionRequested: s.visits.filter((v) => v.status === "exception_requested").length,
      inspecting: s.visits.filter((v) => v.status === "inspecting").length,
      accessPending: s.visits.filter((v) => v.status === "access_pending").length,
      releasedToday: s.visits.filter(
        (v) => ["onsite", "departing", "completed"].includes(v.status) && (v.onsite_at || "").startsWith(today)
      ).length,
      dwellOver: onsiteRows.filter((v) => dwellMinutes(v.onsite_at) >= warn).length,
      dwellWarnMinutes: warn,
    });
  }

  if (p === "/gate/kpi") {
    const warn = dwellWarnMinutes(s);
    const onsiteRows = s.visits.filter((v) => v.status === "onsite");
    return ok({
      inspecting: s.visits.filter((v) => v.status === "inspecting").length,
      accessPending: s.visits.filter((v) => v.status === "access_pending").length,
      exceptionRequested: s.visits.filter((v) => v.status === "exception_requested").length,
      dwellOver: onsiteRows.filter((v) => dwellMinutes(v.onsite_at) >= warn).length,
      releasedToday: s.visits.filter(
        (v) =>
          ["onsite", "departing", "completed"].includes(v.status) &&
          (v.onsite_at || v.admitted_at || "").startsWith(addDays(0))
      ).length,
      dwellWarnMinutes: warn,
    });
  }

  if (p === "/notifications") {
    const items = [];
    if (user.role === "driver" && user.driver_id) {
      const st = [...s.training]
        .filter((t) => t.driver_id === user.driver_id && t.quiz_passed)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
      if (!st) {
        items.push({
          id: "train-required",
          level: "high",
          title: "须完成安全培训",
          body: "首次到场或培训失效，请先完成视频与答题。",
          to: "/driver/training",
          vars: {},
        });
      } else if (st.valid_until) {
        const days = Math.ceil((new Date(st.valid_until).getTime() - Date.now()) / 86400000);
        if (days <= 30) {
          items.push({
            id: "train-expiring",
            level: days <= 7 ? "high" : "medium",
            title: "培训即将到期",
            body: `有效至 ${st.valid_until}（剩 ${days} 天）`,
            to: "/driver/training",
            vars: { date: st.valid_until, days },
          });
        }
      }
      const pending = s.visits.find((v) => v.driver_id === user.driver_id && v.status === "access_pending");
      if (pending) {
        items.push({
          id: `block-${pending.id}`,
          level: "high",
          title: "报到被拦截",
          body: pending.block_reasons?.[0]?.message || "请补齐培训或证件",
          to: "/driver/visit",
          vars: {},
        });
      }
      const inspecting = s.visits.find((v) => v.driver_id === user.driver_id && v.status === "inspecting");
      if (inspecting) {
        items.push({
          id: `ready-${inspecting.id}`,
          level: "low",
          title: "可入场 · 出示通行码",
          body: inspecting.pass_code ? `通行码 ${inspecting.pass_code}` : "请驶至门岗安检",
          to: "/driver/visit",
          vars: { code: inspecting.pass_code || "" },
        });
      }
      const onsite = s.visits.find((v) =>
        v.driver_id === user.driver_id && ["onsite", "departing"].includes(v.status)
      );
      if (onsite && dwellMinutes(onsite.onsite_at) >= dwellWarnMinutes(s)) {
        const mins = dwellMinutes(onsite.onsite_at);
        items.push({
          id: `dwell-${onsite.id}`,
          level: "medium",
          title: "在场超时催离",
          body: `已停留 ${mins} 分钟`,
          to: "/driver/visit",
          vars: { mins },
        });
      }
    }
    if (user.role === "ehs" || user.role === "admin") {
      const n = s.visits.filter((v) => v.status === "exception_requested").length;
      if (n > 0) {
        items.push({
          id: "dual-pending",
          level: "high",
          title: "待双签例外",
          body: `${n} 单等待批准`,
          to: "/admin",
          vars: { n },
        });
      }
    }
    return ok({ items });
  }

  if (p === "/carriers") return ok({ items: s.carriers });
  if (p === "/drivers") {
    const items = q.carrierId ? s.drivers.filter((d) => d.carrier_id === q.carrierId) : s.drivers;
    return ok({ items });
  }
  if (p === "/vehicles") {
    const items = q.carrierId ? s.vehicles.filter((d) => d.carrier_id === q.carrierId) : s.vehicles;
    return ok({ items });
  }

  if (p === "/documents") {
    let items = s.documents;
    if (q.subjectType && q.subjectId)
      items = items.filter((d) => d.subject_type === q.subjectType && d.subject_id === q.subjectId);
    return ok({
      items: items.map((d) => ({ ...d, ocr: d.ocr_json, label: LABELS[d.doc_type] || d.doc_type })),
    });
  }

  if (p === "/documents/expiring") {
    const days = Number(q.days || 30);
    const limit = addDays(days);
    const items = s.documents
      .filter((d) => d.expire_at && d.expire_at <= limit)
      .sort((a, b) => (a.expire_at > b.expire_at ? 1 : -1))
      .map((d) => ({
        ...d,
        ocr: d.ocr_json,
        label: LABELS[d.doc_type] || d.doc_type,
        expired: d.expire_at < addDays(0),
      }));
    return ok({ items });
  }

  if (p === "/documents/ocr" && method === "POST") {
    const expireAt = addDays(Number(body.forceExpireDays ?? 200));
    const id = nid();
    const row = {
      id,
      subject_type: body.subjectType,
      subject_id: body.subjectId,
      doc_type: body.docType,
      expire_at: expireAt,
      status: "valid",
      confidence: 0.93,
      ocr_json: {
        ok: true,
        confidence: 0.93,
        expireAt,
        fields: { ...(body.hint || {}), expireAt },
        provider: "pages-mock-ocr",
      },
      created_at: now(),
      updated_at: now(),
    };
    s.documents.unshift(row);
    audit(s, user, "document.ocr", "document", id, { docType: body.docType, expireAt });
    save(s);
    return ok({ id, status: "valid", ocr: row.ocr_json, label: LABELS[body.docType] || body.docType });
  }

  if (p === "/training/course") {
    return ok({
      course: s.course,
      questions: s.questions.map(({ id, stem, options }) => ({ id, stem, options })),
    });
  }

  if (p === "/training/status") {
    const driverId = q.driverId || user.driver_id;
    const record = [...s.training]
      .filter((t) => t.driver_id === driverId && t.course_id === s.course.id)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    const passed = !!(record && record.quiz_passed && record.valid_until >= addDays(0));
    return ok({ passed, record: record || null, course: s.course });
  }

  if (p === "/training/progress" && method === "POST") {
    const driverId = body.driverId || user.driver_id;
    let record = s.training.find((t) => t.driver_id === driverId && t.course_id === s.course.id && !t.quiz_passed);
    const watched = Number(body.watchedSeconds || 0);
    const completed = watched >= s.course.min_watch_seconds ? 1 : 0;
    if (!record) {
      record = {
        id: nid(),
        driver_id: driverId,
        course_id: s.course.id,
        site_id: "site-1",
        watched_seconds: watched,
        video_completed: completed,
        quiz_score: null,
        quiz_passed: 0,
        valid_until: null,
        completed_at: null,
        created_at: now(),
      };
      s.training.unshift(record);
    } else {
      record.watched_seconds = Math.max(record.watched_seconds, watched);
      record.video_completed = completed;
    }
    save(s);
    return ok({ record, minWatchSeconds: s.course.min_watch_seconds });
  }

  if (p === "/training/quiz" && method === "POST") {
    const driverId = body.driverId || user.driver_id;
    const record = s.training.find((t) => t.driver_id === driverId && t.course_id === s.course.id);
    if (!record || !record.video_completed) fail("请先完成安全培训视频观看");
    let correct = 0;
    for (const qn of s.questions) {
      if (Number(body.answers?.[qn.id]) === qn.answer_index) correct += 1;
    }
    const score = Math.round((correct / s.questions.length) * 100);
    const passed = score >= s.course.pass_score;
    record.quiz_score = score;
    record.quiz_passed = passed ? 1 : 0;
    record.valid_until = passed ? addDays(s.course.valid_days) : null;
    record.completed_at = passed ? now() : null;
    audit(s, user, "training.quiz", "training_record", record.id, { score, passed });
    save(s);
    return ok({ score, passed, passScore: s.course.pass_score, validUntil: record.valid_until, detail: [] });
  }


  if (p === "/access/evaluate" && method === "POST") {
    return ok(evaluate(s, body));
  }

  if (p === "/visits" && method === "GET") {
    if (q.passCode) {
      const hit = s.visits.find(
        (v) => (v.pass_code || "").toUpperCase() === String(q.passCode).trim().toUpperCase()
      );
      if (!hit) fail("未找到通行码对应单据", 404);
      const enriched = enrichVisit(s, hit);
      return ok({ items: [enriched], visit: enriched });
    }
    let items = s.visits.map((v) => enrichVisit(s, v));
    if (q.status) {
      const statuses = String(q.status)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      items = items.filter((v) => statuses.includes(v.status));
    }
    if (q.type) {
      const t = normalizeVisitType(q.type);
      items = items.filter((v) => normalizeVisitType(v.visit_type) === t);
    }
    if (q.plate) {
      const ptxt = String(q.plate).trim();
      items = items.filter((v) => (v.plate_no || "").includes(ptxt));
    }
    if (q.pickupRef) {
      const r = String(q.pickupRef).trim();
      items = items.filter((v) => (v.pickup_ref || "").includes(r));
    }
    if (q.archiveKey) {
      const a = String(q.archiveKey).trim();
      items = items.filter((v) => (v.archive_key || "").includes(a));
    }
    if (q.from) items = items.filter((v) => (v.updated_at || "") >= q.from);
    if (q.to) items = items.filter((v) => (v.updated_at || "") <= q.to);
    items.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0) || (a.updated_at < b.updated_at ? 1 : -1));
    return ok({ items });
  }

  if (p === "/visits" && method === "POST") {
    const type = normalizeVisitType(body.visitType);
    if (type === "self_pickup" && (!body.customerName || !body.pickupRef)) {
      fail("自提须填写提货人姓名与提货单号(DN)");
    }
    if (!body.slotStart || !body.slotEnd) fail("请选择到场时段");
    const booked = s.visits.filter(
      (v) => v.slot_start === body.slotStart && !["rejected", "completed"].includes(v.status)
    ).length;
    if (booked >= slotCapacity(s)) fail("该时段已满，请选择其他时段");

    const profile = getVisitProfile(type);
    const allowedOpts = new Set(profile.departOptional.map((x) => x.key));
    const selected = (body.selectedOptions || []).filter((k) => allowedOpts.has(k));
    const cid = body.carrierId || (type === "self_pickup" ? "carrier-self" : null);
    const did = body.driverId || (type === "self_pickup" ? "driver-pickup" : null);
    const vid = body.vehicleId || (type === "self_pickup" ? "veh-pickup" : null);
    if (type !== "self_pickup" && (!cid || !did || !vid)) fail("缺少承运商/司机/车辆");
    const access = evaluate(s, {
      driverId: did,
      vehicleId: vid,
      carrierId: cid,
      visitType: type,
      selectedOptions: selected,
    });
    const id = nid();
    const v = {
      id,
      site_id: body.siteId || "site-1",
      carrier_id: cid,
      driver_id: did,
      vehicle_id: vid,
      appointment_at: body.slotStart || body.appointmentAt || now(),
      status: "appointed",
      block_reasons: null,
      visit_type: type,
      selected_options: selected,
      customer_name: body.customerName || null,
      customer_phone: body.customerPhone || null,
      pickup_ref: body.pickupRef || null,
      slot_start: body.slotStart,
      slot_end: body.slotEnd,
      pass_code: null,
      risk_score: access.riskScore,
      risk_level: access.riskLevel,
      archive_key: null,
      created_at: now(),
      updated_at: now(),
    };
    s.visits.unshift(v);
    audit(s, user, "visit.create", "visit", id, { visitType: type, selected, slotStart: body.slotStart });
    save(s);
    return ok({ visit: enrichVisit(s, v), access });
  }

  const visitMatch = p.match(
    /^\/visits\/([^/]+)(?:\/(checkin|inspect|depart|checkout\/sign|checkout\/confirm|exception(?:\/approve|\/reject)?))?$/
  );
  if (visitMatch) {
    const visit = s.visits.find((v) => v.id === visitMatch[1]);
    if (!visit) fail("到访单不存在", 404);
    const action = visitMatch[2];

    if (!action && method === "GET") {
      const selectedOptions = visit.selected_options || [];
      const vt = normalizeVisitType(visit.visit_type);
      return ok({
        visit: enrichVisit(s, visit),
        access: evaluate(s, {
          driverId: visit.driver_id,
          vehicleId: visit.vehicle_id,
          carrierId: visit.carrier_id,
          visitType: vt,
          selectedOptions,
          pickupRef: visit.pickup_ref || "",
        }),
        departSteps: resolveDepartSteps(vt, selectedOptions),
        inspectChecklist: getVisitProfile(vt).inspectChecklist,
      });
    }

    if (action === "checkin" && method === "POST") {
      const selectedOptions = visit.selected_options || [];
      const access = evaluate(s, {
        driverId: visit.driver_id,
        vehicleId: visit.vehicle_id,
        carrierId: visit.carrier_id,
        visitType: visit.visit_type || "carrier",
        selectedOptions,
        pickupRef: visit.pickup_ref || "",
      });
      visit.checkin_at = now();
      visit.updated_at = now();
      visit.pass_code = visit.pass_code || makePassCode();
      visit.risk_score = access.riskScore;
      visit.risk_level = access.riskLevel;
      if (!access.allowed) {
        visit.status = "access_pending";
        visit.block_reasons = access.reasons;
        save(s);
        return ok({ ok: false, visit: enrichVisit(s, visit), access, message: "准入未通过，请先完成培训/证件" });
      }
      visit.status = "inspecting";
      visit.admitted_at = now();
      visit.block_reasons = null;
      save(s);
      return ok({ ok: true, visit: enrichVisit(s, visit), access });
    }

    if (action === "inspect" && method === "POST") {
      const profile = getVisitProfile(visit.visit_type);
      const checklist = body.checklist || {};
      const pass =
        body.pass !== false &&
        profile.inspectChecklist.every((c) => checklist[c.key] === true);
      const at = now();
      const evidence = {
        checklist,
        checkedAt: Object.fromEntries(Object.keys(checklist).map((k) => [k, checklist[k] ? at : null])),
        pass,
        at,
        by: user.name,
        snapshot: { ok: true, mock: true, url: `mock://snap/${visit.id}`, at },
        riskScore: visit.risk_score,
        riskLevel: visit.risk_level,
      };
      visit.updated_at = at;
      visit.inspection_json = evidence;
      if (!pass) {
        visit.status = "rejected";
        save(s);
        return ok({ ok: false, visit: enrichVisit(s, visit) });
      }
      visit.status = "onsite";
      visit.onsite_at = at;
      const deviceResult = { ok: true, gate: "open", txnId: nid(), at };
      deviceEvent(s, "barrier", "barrier-in-1", "opened", deviceResult);
      audit(s, user, "visit.admit", "visit", visit.id, { deviceResult });
      save(s);
      return ok({ ok: true, visit: enrichVisit(s, visit), deviceResult, evidence });
    }

    if (action === "depart" && method === "POST") {
      const visitType = normalizeVisitType(visit.visit_type);
      const selectedOptions = visit.selected_options || [];
      const required = resolveDepartSteps(visitType, selectedOptions);
      const steps = Object.fromEntries(
        required.map((step) => [step.key, !!(body[step.key] ?? body.steps?.[step.key])])
      );
      const missing = required.filter((step) => !steps[step.key]).map((step) => step.key);
      const prev = visit.departure_json || {};
      visit.updated_at = now();
      if (missing.length) {
        visit.status = "departing";
        visit.departure_json = {
          ...prev,
          steps,
          missing,
          required,
          signs: prev.signs || { driver: null, gate: null },
          at: now(),
        };
        save(s);
        return ok({
          ok: false,
          missing,
          required,
          visit: enrichVisit(s, visit),
          message: "作业完成/离场检查未完成（含已勾选的可选步骤）",
        });
      }
      const weight = selectedOptions.includes("weighbridge")
        ? { ok: true, weightKg: 15000 + Math.floor(Math.random() * 3000), at: now() }
        : prev.weight || null;
      visit.status = "departing";
      visit.departure_json = {
        ...prev,
        steps,
        missing: [],
        required,
        weight,
        selectedOptions,
        readyForSign: true,
        signs: prev.signs || { driver: null, gate: null },
        at: now(),
        preparedBy: user.name,
      };
      audit(s, user, "visit.depart_prepare", "visit", visit.id, { steps, visitType });
      save(s);
      return ok({
        ok: true,
        pendingCheckout: true,
        visit: enrichVisit(s, visit),
        weight,
        message: "作业与离场检查已完成，请司机与门岗双签后扫码放行",
      });
    }

    if (action === "checkout/sign" && method === "POST") {
      if (visit.status !== "departing") fail(`当前状态不可签退: ${visit.status}`);
      const dep = visit.departure_json || {};
      if (!dep.readyForSign) fail("请先完成作业/离场检查步骤");
      const roleName = body.role || (user.role === "gate" ? "gate" : "driver");
      if (!["driver", "gate"].includes(roleName)) fail("role 须为 driver 或 gate");
      if (roleName === "gate" && !["gate", "ehs", "admin"].includes(user.role)) fail("仅门岗可签退门岗端", 403);
      const signs = { ...(dep.signs || { driver: null, gate: null }) };
      signs[roleName] = {
        name: body.name || user.name,
        at: now(),
        byId: user.id,
        device: body.device || "mobile",
      };
      visit.departure_json = { ...dep, signs, at: now() };
      visit.updated_at = now();
      audit(s, user, "visit.checkout_sign", "visit", visit.id, { role: roleName });
      save(s);
      return ok({
        ok: true,
        visit: enrichVisit(s, visit),
        bothSigned: !!(signs.driver && signs.gate),
        message:
          signs.driver && signs.gate
            ? "双签完成，门岗可扫码确认离场"
            : `${roleName === "driver" ? "司机" : "门岗"}已签退`,
      });
    }

    if (action === "checkout/confirm" && method === "POST") {
      if (!["gate", "ehs", "admin"].includes(user.role)) fail("无权限", 403);
      if (visit.status !== "departing") fail(`当前状态不可确认离场: ${visit.status}`);
      const dep = visit.departure_json || {};
      if (!dep.readyForSign || !dep.signs?.driver || !dep.signs?.gate) {
        fail("须司机与门岗双方签退后才能开闸离场");
      }
      const code = (body.passCode || "").trim();
      if (code && visit.pass_code && code.toUpperCase() !== String(visit.pass_code).toUpperCase()) {
        fail("通行码不匹配");
      }
      const enrichedPre = enrichVisit(s, visit);
      const archiveKey = makeArchiveKey(enrichedPre.plate_no, new Date());
      const notify = {
        channel: "email",
        to: "warehouse-leads@example.com",
        subject: `到离场电子归档 ${archiveKey}`,
        body: `单据 ${visit.id} 已按 ${archiveKey} 归档`,
        sentAt: now(),
        mock: true,
      };
      visit.status = "completed";
      visit.checkout_at = now();
      visit.archive_key = archiveKey;
      visit.departure_json = {
        ...dep,
        confirmedBy: user.name,
        confirmedAt: now(),
        archiveKey,
        notify,
        at: now(),
      };
      visit.updated_at = now();
      const deviceResult = { ok: true, gate: "open", direction: "out", txnId: nid() };
      deviceEvent(s, "barrier", "barrier-out-1", "opened", deviceResult);
      audit(s, user, "visit.checkout_confirm", "visit", visit.id, { archiveKey, notify });
      save(s);
      return ok({
        ok: true,
        visit: enrichVisit(s, visit),
        deviceResult,
        archiveKey,
        notify,
        message: `离场闭环完成 · 归档 ${archiveKey}`,
      });
    }

    if (action === "exception" && method === "POST") {
      if (!body.reason) fail("须填写例外原因");
      const note = {
        reason: body.reason,
        approverNote: body.approverNote || null,
        requestedBy: user.name,
        requestedById: user.id,
        requestedAt: now(),
        status: dualApprove(s) ? "pending" : "approved",
      };
      if (dualApprove(s) && user.role === "gate") {
        visit.status = "exception_requested";
        visit.exception_note = note;
        visit.updated_at = now();
        audit(s, user, "visit.exception_request", "visit", visit.id, note);
        save(s);
        return ok({
          ok: true,
          pendingApproval: true,
          visit: enrichVisit(s, visit),
          message: "已提交双签例外，等待 EHS/管理员批准",
        });
      }
      note.approvedBy = user.name;
      note.approvedAt = now();
      note.status = "approved";
      visit.status = "onsite";
      visit.onsite_at = now();
      visit.exception_note = note;
      visit.updated_at = now();
      const deviceResult = { ok: true, gate: "open", txnId: nid(), exception: true };
      deviceEvent(s, "barrier", "barrier-in-1", "opened", deviceResult);
      audit(s, user, "visit.exception", "visit", visit.id, note);
      save(s);
      return ok({ ok: true, pendingApproval: false, visit: enrichVisit(s, visit), deviceResult });
    }

    if (action === "exception/approve" && method === "POST") {
      if (visit.status !== "exception_requested") fail(`当前状态不可批准: ${visit.status}`);
      const note = {
        ...(visit.exception_note || {}),
        approvedBy: user.name,
        approvedAt: now(),
        status: "approved",
        approverNote: body.approverNote || null,
      };
      visit.status = "onsite";
      visit.onsite_at = now();
      visit.exception_note = note;
      visit.updated_at = now();
      const deviceResult = { ok: true, gate: "open", txnId: nid(), exception: true };
      deviceEvent(s, "barrier", "barrier-in-1", "opened", deviceResult);
      audit(s, user, "visit.exception_approve", "visit", visit.id, note);
      save(s);
      return ok({ ok: true, visit: enrichVisit(s, visit), deviceResult });
    }

    if (action === "exception/reject" && method === "POST") {
      if (visit.status !== "exception_requested") fail(`当前状态不可驳回: ${visit.status}`);
      const note = {
        ...(visit.exception_note || {}),
        rejectedBy: user.name,
        rejectedAt: now(),
        status: "rejected",
        rejectReason: body.reason || "未批准",
      };
      visit.status = "access_pending";
      visit.exception_note = note;
      visit.updated_at = now();
      audit(s, user, "visit.exception_reject", "visit", visit.id, note);
      save(s);
      return ok({ ok: true, visit: enrichVisit(s, visit) });
    }
  }

  if (p === "/devices") {
    return ok({
      mode: "pages-mock",
      items: s.devices,
      note: "GitHub Pages 演示为浏览器内模拟设备",
    });
  }

  if (p.startsWith("/devices/") && p.endsWith("/execute") && method === "POST") {
    const id = p.split("/")[2];
    const result = { ok: true, cmd: body.cmd, deviceId: id, at: now(), txnId: nid() };
    deviceEvent(s, "device", id, body.cmd || "exec", result);
    save(s);
    return ok({ result });
  }

  if (p === "/devices/lpr/simulate" && method === "POST") {
    const captured = { ok: true, plateNo: body.plateNo || "沪A12345", confidence: 0.96, at: now() };
    const vehicle = s.vehicles.find((v) => v.plate_no === captured.plateNo) || null;
    let matchedVisit = null;
    if (vehicle) {
      const hit = s.visits.find(
        (v) =>
          v.vehicle_id === vehicle.id &&
          ["inspecting", "access_pending", "exception_requested", "appointed"].includes(v.status)
      );
      if (hit) matchedVisit = enrichVisit(s, hit);
    }
    deviceEvent(s, "lpr", "lpr-gate-1", "plate_captured", captured);
    save(s);
    return ok({ captured, vehicle, matchedVisit });
  }

  if (p === "/audit") return ok({ items: s.audit.slice(0, 200) });
  if (p === "/device-events") return ok({ items: s.deviceEvents.slice(0, 100) });

  fail(`未实现的演示接口: ${method} ${p}`, 404);
}


export function isPagesDemo() {
  if (import.meta.env.VITE_DEMO_MOCK === "true") return true;
  if (typeof location !== "undefined" && /\.github\.io$/i.test(location.hostname)) return true;
  return false;
}
