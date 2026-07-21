import { db } from "../db.js";
import { computeRisk } from "./yardOps.js";
import { isHazmatVisit, normalizeVisitType } from "./visitProfiles.js";

const REQUIRED_DRIVER_DOCS = ["driver_license", "qualification"];
const REQUIRED_VEHICLE_DOCS = ["vehicle_license", "insurance"];
const REQUIRED_CARRIER_DOCS = ["transport_permit"];
const REQUIRED_TEMP_DOCS = ["id_card"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function validDocs(subjectType, subjectId, required) {
  const rows = db
    .prepare(
      `SELECT doc_type, expire_at, status FROM documents
       WHERE subject_type = ? AND subject_id = ? AND status = 'valid'`
    )
    .all(subjectType, subjectId);

  const byType = Object.fromEntries(rows.map((r) => [r.doc_type, r]));
  const missing = [];
  const expired = [];

  for (const t of required) {
    const d = byType[t];
    if (!d) {
      missing.push(t);
      continue;
    }
    if (d.expire_at && d.expire_at < today()) expired.push(t);
  }
  return { missing, expired, docs: rows };
}

function pushDocReasons(reasons, prefix, result) {
  for (const t of result.missing) {
    reasons.push({ code: "DOC_MISSING", message: `${prefix}缺少证件: ${t}`, docType: t });
  }
  for (const t of result.expired) {
    reasons.push({ code: "DOC_EXPIRED", message: `${prefix}证件过期: ${t}`, docType: t });
  }
}

function checkTraining(reasons, siteId, driverId) {
  const course = db
    .prepare(
      `SELECT * FROM training_courses WHERE site_id = ? AND active = 1 ORDER BY version DESC LIMIT 1`
    )
    .get(siteId);

  let training = null;
  let trainingOk = false;
  if (!course) {
    reasons.push({ code: "NO_COURSE", message: "厂区未配置安全培训课程" });
    return { training, trainingOk, course: null };
  }
  training = db
    .prepare(
      `SELECT * FROM training_records
       WHERE driver_id = ? AND course_id = ? AND quiz_passed = 1
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(driverId, course.id);

  if (!training) {
    reasons.push({
      code: "TRAINING_REQUIRED",
      message: "首次到场或培训失效：须完成安全视频并答题通过（有效期 1 年）",
    });
  } else if (!training.valid_until || training.valid_until < today()) {
    reasons.push({
      code: "TRAINING_EXPIRED",
      message: `培训已过期（有效至 ${training.valid_until || "-"}），须复训`,
    });
  } else {
    trainingOk = true;
  }
  return { training, trainingOk, course };
}

/**
 * 准入判定 + 动态风险评分
 */
export function evaluateAccess({
  siteId,
  driverId,
  vehicleId,
  carrierId,
  visitType = "carrier_inbound",
  selectedOptions = [],
}) {
  const type = normalizeVisitType(visitType);

  if (type === "self_pickup") {
    const reasons = [];
    if (vehicleId) {
      const vehicle = db.prepare(`SELECT * FROM vehicles WHERE id = ?`).get(vehicleId);
      if (vehicle && vehicle.status !== "active") {
        reasons.push({ code: "VEHICLE_BLOCKED", message: "车辆状态不可用" });
      }
    }
    // 自提：提货单/授权书在登记字段与门岗核验；可选短训
    if (selectedOptions.includes("safetyBrief")) {
      const { trainingOk } = checkTraining(reasons, siteId, driverId);
      if (!trainingOk && reasons.every((r) => r.code !== "TRAINING_REQUIRED" && r.code !== "TRAINING_EXPIRED")) {
        /* already pushed */
      }
    }
    const base = {
      allowed: reasons.length === 0,
      reasons,
      lights: {
        training: !selectedOptions.includes("safetyBrief"),
        documents: true,
        subject: reasons.length === 0,
      },
      training: null,
      course: null,
      mode: "self_pickup",
      note: "自提：预约须填 DN；身份/授权书/订单在门岗 Check In；离场须仓管签收 + 双签 Check Out",
    };
    return {
      ...base,
      ...computeRisk({
        allowed: base.allowed,
        reasons,
        training: null,
        driverId,
        carrierId,
        visitType: type,
      }),
    };
  }

  if (type === "temporary") {
    const reasons = [];
    const driver = db.prepare(`SELECT * FROM drivers WHERE id = ?`).get(driverId);
    if (!driver || driver.status !== "active") {
      reasons.push({ code: "DRIVER_BLOCKED", message: "人员状态不可用" });
    }
    const vehicle = db.prepare(`SELECT * FROM vehicles WHERE id = ?`).get(vehicleId);
    if (!vehicle || vehicle.status !== "active") {
      reasons.push({ code: "VEHICLE_BLOCKED", message: "车辆状态不可用" });
    }
    const { training, trainingOk, course } = checkTraining(reasons, siteId, driverId);
    const idDocs = validDocs("driver", driverId, REQUIRED_TEMP_DOCS);
    pushDocReasons(reasons, "人员", idDocs);
    const docsOk = idDocs.missing.length === 0 && idDocs.expired.length === 0;
    const allowed = reasons.length === 0;
    return {
      allowed,
      reasons,
      lights: {
        training: trainingOk,
        documents: docsOk,
        subject: !reasons.some((r) => ["DRIVER_BLOCKED", "VEHICLE_BLOCKED"].includes(r.code)),
      },
      training,
      course,
      mode: "temporary",
      note: "临时车辆：须有效期内安全培训 + 身份证登记",
      ...computeRisk({ allowed, reasons, training, driverId, carrierId, visitType: type }),
    };
  }

  const reasons = [];

  const carrier = db.prepare(`SELECT * FROM carriers WHERE id = ?`).get(carrierId);
  if (!carrier || carrier.status !== "active") {
    reasons.push({ code: "CARRIER_BLOCKED", message: "承运商已冻结或不可用" });
  }

  const driver = db.prepare(`SELECT * FROM drivers WHERE id = ?`).get(driverId);
  if (!driver || driver.status !== "active") {
    reasons.push({ code: "DRIVER_BLOCKED", message: "司机状态不可用" });
  }

  const vehicle = db.prepare(`SELECT * FROM vehicles WHERE id = ?`).get(vehicleId);
  if (!vehicle || vehicle.status !== "active") {
    reasons.push({ code: "VEHICLE_BLOCKED", message: "车辆状态不可用" });
  }

  const { training, trainingOk, course } = checkTraining(reasons, siteId, driverId);

  const driverDocs = validDocs("driver", driverId, REQUIRED_DRIVER_DOCS);
  const vehicleDocs = validDocs("vehicle", vehicleId, REQUIRED_VEHICLE_DOCS);
  const carrierDocs = validDocs("carrier", carrierId, REQUIRED_CARRIER_DOCS);
  pushDocReasons(reasons, "司机", driverDocs);
  pushDocReasons(reasons, "车辆", vehicleDocs);
  pushDocReasons(reasons, "承运商", carrierDocs);

  if (isHazmatVisit(selectedOptions)) {
    const hazDriver = validDocs("driver", driverId, ["hazmat_permit"]);
    const hazVehicle = validDocs("vehicle", vehicleId, ["manifest"]);
    pushDocReasons(reasons, "危化", hazDriver);
    pushDocReasons(reasons, "运单", hazVehicle);
  }

  const docsOk =
    driverDocs.missing.length === 0 &&
    driverDocs.expired.length === 0 &&
    vehicleDocs.missing.length === 0 &&
    vehicleDocs.expired.length === 0 &&
    carrierDocs.missing.length === 0 &&
    carrierDocs.expired.length === 0 &&
    !reasons.some((r) => r.code === "DOC_MISSING" || r.code === "DOC_EXPIRED");

  const allowed = reasons.length === 0;
  const risk = computeRisk({
    allowed,
    reasons,
    training,
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
      subject: !reasons.some((r) =>
        ["CARRIER_BLOCKED", "DRIVER_BLOCKED", "VEHICLE_BLOCKED"].includes(r.code)
      ),
    },
    training,
    course,
    mode: type,
    ...risk,
  };
}

export const VISIT_FLOW = [
  "appointed",
  "access_pending",
  "inspecting",
  "exception_requested",
  "onsite",
  "departing",
  "completed",
  "rejected",
];
