import { db } from "../db.js";

const REQUIRED_DRIVER_DOCS = ["driver_license", "qualification"];
const REQUIRED_VEHICLE_DOCS = ["vehicle_license", "insurance"];
const REQUIRED_CARRIER_DOCS = ["transport_permit"];

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

/**
 * 准入判定
 * @param {{ siteId, driverId, vehicleId, carrierId, visitType?: string, selectedOptions?: string[] }} args
 */
export function evaluateAccess({
  siteId,
  driverId,
  vehicleId,
  carrierId,
  visitType = "carrier",
  selectedOptions = [],
}) {
  // 客户自提：轻量准入（身份/单据在门岗安检勾选；可选短训在离场步骤约束）
  if (visitType === "self_pickup") {
    const reasons = [];
    if (vehicleId) {
      const vehicle = db.prepare(`SELECT * FROM vehicles WHERE id = ?`).get(vehicleId);
      if (vehicle && vehicle.status !== "active") {
        reasons.push({ code: "VEHICLE_BLOCKED", message: "车辆状态不可用" });
      }
    }
    return {
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
      note: "自提走轻量准入；身份核验与提货单核对在门岗安检完成；勾选的可选步骤在离场收口强制完成",
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

  const course = db
    .prepare(
      `SELECT * FROM training_courses WHERE site_id = ? AND active = 1 ORDER BY version DESC LIMIT 1`
    )
    .get(siteId);

  let training = null;
  let trainingOk = false;
  if (!course) {
    reasons.push({ code: "NO_COURSE", message: "厂区未配置安全培训课程" });
  } else {
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
        message: "首次到场或培训失效：须完成安全视频并答题通过",
      });
    } else if (!training.valid_until || training.valid_until < today()) {
      reasons.push({
        code: "TRAINING_EXPIRED",
        message: `培训已过期（有效至 ${training.valid_until || "-"}），须复训`,
      });
    } else {
      trainingOk = true;
    }
  }

  const driverDocs = validDocs("driver", driverId, REQUIRED_DRIVER_DOCS);
  const vehicleDocs = validDocs("vehicle", vehicleId, REQUIRED_VEHICLE_DOCS);
  const carrierDocs = validDocs("carrier", carrierId, REQUIRED_CARRIER_DOCS);

  for (const t of driverDocs.missing) {
    reasons.push({ code: "DOC_MISSING", message: `司机缺少证件: ${t}`, docType: t });
  }
  for (const t of driverDocs.expired) {
    reasons.push({ code: "DOC_EXPIRED", message: `司机证件过期: ${t}`, docType: t });
  }
  for (const t of vehicleDocs.missing) {
    reasons.push({ code: "DOC_MISSING", message: `车辆缺少证件: ${t}`, docType: t });
  }
  for (const t of vehicleDocs.expired) {
    reasons.push({ code: "DOC_EXPIRED", message: `车辆证件过期: ${t}`, docType: t });
  }
  for (const t of carrierDocs.missing) {
    reasons.push({ code: "DOC_MISSING", message: `承运商缺少证件: ${t}`, docType: t });
  }
  for (const t of carrierDocs.expired) {
    reasons.push({ code: "DOC_EXPIRED", message: `承运商证件过期: ${t}`, docType: t });
  }

  const docsOk =
    driverDocs.missing.length === 0 &&
    driverDocs.expired.length === 0 &&
    vehicleDocs.missing.length === 0 &&
    vehicleDocs.expired.length === 0 &&
    carrierDocs.missing.length === 0 &&
    carrierDocs.expired.length === 0;

  return {
    allowed: reasons.length === 0,
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
    mode: "carrier",
  };
}

export const VISIT_FLOW = [
  "appointed",
  "checked_in",
  "access_pending",
  "inspecting",
  "onsite",
  "departing",
  "completed",
  "rejected",
];
