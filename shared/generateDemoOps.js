/**
 * 产品向演示运营数据（无硬件）
 * 生成约 14 天多状态到访、危货混合、证件到期、在场超时、待双签例外。
 * 确定性输出，便于演示复现。
 */

function pad(n) {
  return String(n).padStart(2, "0");
}

function dayIso(base, offsetDays) {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function atDay(base, offsetDays, hour, minute = 0) {
  const d = new Date(base);
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function archiveKey(day, plate) {
  return `${day.replace(/-/g, "")}_${plate}`;
}

/**
 * @param {{ nid: () => string, now?: () => string }} helpers
 */
export function buildDemoOpsBundle(helpers = {}) {
  const nid = helpers.nid || (() => Math.random().toString(36).slice(2, 12));
  const clock = helpers.now ? new Date(helpers.now()) : new Date();
  const today = clock.toISOString().slice(0, 10);

  const plates = {
    "veh-1": "沪A12345",
    "veh-2": "沪B67890",
    "veh-pickup": "沪C88888",
  };

  const documents = [
    {
      id: "doc-exp-qual",
      subject_type: "driver",
      subject_id: "driver-ok",
      doc_type: "qualification",
      expire_at: dayIso(clock, 9),
      status: "valid",
      confidence: 0.93,
      ocr_json: { expireAt: dayIso(clock, 9), provider: "demo-ops" },
      created_at: atDay(clock, -20, 10),
      updated_at: atDay(clock, -20, 10),
    },
    {
      id: "doc-expired-ins",
      subject_type: "vehicle",
      subject_id: "veh-2",
      doc_type: "insurance",
      expire_at: dayIso(clock, -2),
      status: "valid",
      confidence: 0.9,
      ocr_json: { expireAt: dayIso(clock, -2), provider: "demo-ops" },
      created_at: atDay(clock, -40, 11),
      updated_at: atDay(clock, -40, 11),
    },
    {
      id: "doc-soon-permit",
      subject_type: "carrier",
      subject_id: "carrier-1",
      doc_type: "transport_permit",
      expire_at: dayIso(clock, 12),
      status: "valid",
      confidence: 0.94,
      ocr_json: { expireAt: dayIso(clock, 12), provider: "demo-ops" },
      created_at: atDay(clock, -60, 9),
      updated_at: atDay(clock, -60, 9),
    },
    {
      id: "doc-haz-driver-new",
      subject_type: "driver",
      subject_id: "driver-new",
      doc_type: "hazmat_permit",
      expire_at: dayIso(clock, 4),
      status: "valid",
      confidence: 0.88,
      ocr_json: { expireAt: dayIso(clock, 4), provider: "demo-ops" },
      created_at: atDay(clock, -10, 14),
      updated_at: atDay(clock, -10, 14),
    },
  ];

  const training = [
    {
      id: "tr-ok-expiring",
      driver_id: "driver-ok",
      course_id: "course-1",
      site_id: "site-1",
      watched_seconds: 120,
      video_completed: 1,
      quiz_score: 90,
      quiz_passed: 1,
      valid_until: dayIso(clock, 18),
      completed_at: atDay(clock, -40, 15),
      created_at: atDay(clock, -40, 15),
    },
  ];

  /** @type {any[]} */
  const visits = [];
  const audit = [];

  const typeCycle = [
    "carrier_inbound",
    "carrier_inbound",
    "carrier_outbound",
    "self_pickup",
    "temporary",
    "carrier_inbound",
  ];
  const statusPlan = [
    // dayOffset, hour, status, vehicle, driver, carrier, typeIdx, hazmat, risk, extra
    [-1, 8, "completed", "veh-1", "driver-ok", "carrier-1", 0, false, 18],
    [-1, 10, "completed", "veh-2", "driver-ok", "carrier-1", 2, false, 28],
    [-1, 14, "completed", "veh-pickup", "driver-pickup", "carrier-self", 3, false, 15],
    [-2, 9, "completed", "veh-1", "driver-ok", "carrier-1", 0, true, 40],
    [-2, 15, "rejected", "veh-2", "driver-new", "carrier-1", 0, false, 70],
    [-3, 11, "completed", "veh-1", "driver-ok", "carrier-1", 1, false, 22],
    [-3, 16, "completed", "veh-2", "driver-ok", "carrier-1", 0, true, 45],
    [-4, 9, "completed", "veh-pickup", "driver-pickup", "carrier-self", 3, false, 12],
    [-5, 8, "completed", "veh-1", "driver-ok", "carrier-1", 0, false, 20],
    [-5, 13, "completed", "veh-2", "driver-ok", "carrier-1", 2, false, 30],
    [-6, 10, "completed", "veh-1", "driver-ok", "carrier-1", 0, true, 38],
    [-7, 9, "completed", "veh-1", "driver-ok", "carrier-1", 4, false, 25],
    [-8, 11, "completed", "veh-2", "driver-ok", "carrier-1", 0, false, 24],
    [-9, 8, "completed", "veh-pickup", "driver-pickup", "carrier-self", 3, false, 14],
    [-10, 14, "completed", "veh-1", "driver-ok", "carrier-1", 0, true, 42],
    [-11, 9, "completed", "veh-2", "driver-ok", "carrier-1", 2, false, 26],
    [-12, 10, "completed", "veh-1", "driver-ok", "carrier-1", 0, false, 19],
    [-13, 15, "completed", "veh-1", "driver-ok", "carrier-1", 1, false, 21],
    // live / open
    [0, 7, "appointed", "veh-1", "driver-ok", "carrier-1", 0, false, 16],
    [0, 8, "appointed", "veh-pickup", "driver-pickup", "carrier-self", 3, false, 12],
    [0, 9, "onsite", "veh-1", "driver-ok", "carrier-1", 0, false, 20, { dwellMin: 40 }],
    [0, 6, "onsite", "veh-2", "driver-ok", "carrier-1", 2, false, 55, { dwellMin: 125 }],
    [0, 5, "departing", "veh-1", "driver-ok", "carrier-1", 0, true, 36, { dwellMin: 95 }],
    [0, 12, "exception_requested", "veh-2", "driver-ok", "carrier-1", 0, true, 68],
    [-1, 17, "exception_requested", "veh-1", "driver-new", "carrier-1", 0, false, 72],
    [0, 15, "access_pending", "veh-2", "driver-new", "carrier-1", 0, false, 75],
  ];

  for (let i = 0; i < statusPlan.length; i++) {
    const [dayOff, hour, status, vehicleId, driverId, carrierId, typeIdx, hazmat, risk, extra] =
      statusPlan[i];
    const visitType = typeCycle[typeIdx % typeCycle.length];
    const day = dayIso(clock, dayOff);
    const created = atDay(clock, dayOff, hour, (i * 7) % 50);
    const slotStart = atDay(clock, dayOff, hour, 0);
    const slotEnd = atDay(clock, dayOff, hour, 30);
    const plate = plates[vehicleId];
    const selected = hazmat ? ["hazmat"] : [];
    const isPickup = visitType === "self_pickup";
    const id = `ops-${day.replace(/-/g, "")}-${pad(i)}-${status.slice(0, 3)}`;

    const visit = {
      id,
      site_id: "site-1",
      carrier_id: carrierId,
      driver_id: isPickup ? "driver-pickup" : driverId,
      vehicle_id: isPickup ? "veh-pickup" : vehicleId,
      appointment_at: slotStart,
      status,
      block_reasons: null,
      checkin_at: null,
      admitted_at: null,
      onsite_at: null,
      checkout_at: null,
      inspection_json: null,
      departure_json: null,
      exception_note: null,
      visit_type: visitType,
      selected_options: selected,
      customer_name: isPickup ? "自提客户·陈女士" : null,
      customer_phone: isPickup ? "13700000001" : null,
      pickup_ref: isPickup || hazmat ? `DN-${day.replace(/-/g, "")}-${pad(i)}` : null,
      slot_start: slotStart,
      slot_end: slotEnd,
      pass_code: status === "appointed" ? null : `OP${pad(i)}${String.fromCharCode(65 + (i % 26))}`,
      risk_score: risk,
      risk_level: risk >= 60 ? "high" : risk >= 35 ? "medium" : "low",
      archive_key: null,
      created_at: created,
      updated_at: created,
    };

    if (["inspecting", "onsite", "departing", "completed", "exception_requested", "access_pending", "rejected"].includes(status)) {
      visit.checkin_at = atDay(clock, dayOff, hour, 5);
    }
    if (["onsite", "departing", "completed"].includes(status)) {
      const dwell = extra?.dwellMin || 50;
      const onsite = new Date(clock);
      if (dayOff === 0 && (status === "onsite" || status === "departing")) {
        onsite.setMinutes(onsite.getMinutes() - dwell);
        visit.onsite_at = onsite.toISOString();
      } else {
        visit.onsite_at = atDay(clock, dayOff, hour, 20);
      }
      visit.admitted_at = visit.onsite_at;
      visit.inspection_json = {
        pass: true,
        checklist: { idMatch: true, ppe: true, vehicle: true, docs: true },
        snapshot: { url: "demo://snap", at: visit.onsite_at },
      };
    }
    if (status === "completed") {
      visit.checkout_at = atDay(clock, dayOff, hour + 2, 10);
      visit.archive_key = archiveKey(day, plate);
      visit.departure_json = {
        readyForSign: true,
        signs: {
          driver: { at: atDay(clock, dayOff, hour + 1, 40), by: driverId },
          gate: { at: atDay(clock, dayOff, hour + 1, 50), by: "u-gate" },
        },
        archiveKey: visit.archive_key,
        warehouseNotified: true,
      };
      visit.updated_at = visit.checkout_at;
      audit.push({
        id: nid(),
        actor_id: "u-gate",
        actor_name: "门岗值班",
        action: "visit.checkout.confirm",
        entity_type: "visit",
        entity_id: id,
        detail: { archive_key: visit.archive_key },
        created_at: visit.checkout_at,
      });
    }
    if (status === "rejected") {
      visit.block_reasons = [{ code: "DOC_EXPIRED", message: "DOC_EXPIRED", docType: "insurance" }];
      visit.inspection_json = { pass: false, reason: "证件过期" };
    }
    if (status === "access_pending" && !visit.block_reasons) {
      visit.block_reasons = [{ code: "TRAINING_REQUIRED", message: "TRAINING_REQUIRED" }];
    }
    if (status === "exception_requested") {
      visit.exception_note = {
        pending: true,
        reason: hazmat ? "危货联控核验通道超时，申请保供例外" : "培训记录异常，申请紧急入场",
        requestedBy: "u-gate",
        requestedAt: created,
      };
      visit.pass_code = visit.pass_code || makePass(i);
    }
    if (status === "departing") {
      visit.departure_json = {
        readyForSign: true,
        signs: {
          driver: { at: atDay(clock, 0, hour, 50), by: "driver-ok" },
          gate: null,
        },
      };
    }

    visits.push(visit);
  }

  return {
    generatedAt: clock.toISOString(),
    today,
    documents,
    training,
    visits,
    audit,
    summary: {
      visits: visits.length,
      completed: visits.filter((v) => v.status === "completed").length,
      onsite: visits.filter((v) => v.status === "onsite").length,
      exceptions: visits.filter((v) => v.status === "exception_requested").length,
      hazmat: visits.filter((v) => (v.selected_options || []).includes("hazmat")).length,
    },
  };
}

function makePass(i) {
  return `EX${pad(i)}Z`;
}

/** 看板产品指标（基于 visits/documents 列表） */
export function computeOpsProductStats(visits, documents, { today, addDaysFn, dwellWarn = 90, dwellMinutesFn }) {
  const dayStart = today;
  const day14 = addDaysFn(-13);
  const completed14d = visits.filter(
    (v) => v.status === "completed" && (v.checkout_at || v.updated_at || "").slice(0, 10) >= day14
  ).length;
  const hazmatOpen = visits.filter(
    (v) =>
      (v.selected_options || []).includes("hazmat") &&
      !["completed", "rejected"].includes(v.status)
  ).length;
  const byType = {};
  for (const v of visits) {
    const t = v.visit_type || "carrier_inbound";
    byType[t] = (byType[t] || 0) + 1;
  }
  const recentCompleted = visits
    .filter((v) => v.status === "completed")
    .sort((a, b) => String(b.checkout_at || b.updated_at).localeCompare(String(a.checkout_at || a.updated_at)))
    .slice(0, 6)
    .map((v) => ({
      id: v.id,
      plate: null, // filled by caller if needed
      archive_key: v.archive_key,
      visit_type: v.visit_type,
      checkout_at: v.checkout_at,
      hazmat: (v.selected_options || []).includes("hazmat"),
    }));

  const expiredDocs = documents.filter((d) => d.expire_at && d.expire_at < dayStart).length;
  const openStatuses = {};
  for (const v of visits) {
    openStatuses[v.status] = (openStatuses[v.status] || 0) + 1;
  }

  return {
    completed14d,
    hazmatOpen,
    byType,
    recentCompleted,
    expiredDocs,
    openStatuses,
    dwellWarnMinutes: dwellWarn,
  };
}
