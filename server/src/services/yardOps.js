import { db } from "../db.js";

export function getSetting(key, fallback) {
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key);
  if (!row) return fallback;
  return row.value;
}

export function getSettingInt(key, fallback) {
  const n = Number(getSetting(key, String(fallback)));
  return Number.isFinite(n) ? n : fallback;
}

export function slotCapacity() {
  return getSettingInt("slot_capacity", 4);
}

export function dwellWarnMinutes() {
  return getSettingInt("dwell_warn_minutes", 90);
}

export function dualApproveEnabled() {
  return getSetting("exception_dual_approve", "true") === "true";
}

/** Generate half-hour slots for a local calendar day (08:00–18:00). */
export function listSlotsForDay(dayIso) {
  const day = dayIso || new Date().toISOString().slice(0, 10);
  const capacity = slotCapacity();
  const slots = [];
  for (let h = 8; h < 18; h++) {
    for (const m of [0, 30]) {
      const start = `${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
      const endMin = m + 30;
      const endH = endMin >= 60 ? h + 1 : h;
      const endM = endMin % 60;
      const end = `${day}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;
      const booked = db
        .prepare(
          `SELECT COUNT(*) AS c FROM visits
           WHERE slot_start = ? AND status NOT IN ('rejected','completed')`
        )
        .get(start).c;
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

export function assertSlotAvailable(slotStart, slotEnd) {
  if (!slotStart || !slotEnd) {
    const err = new Error("请选择到场时段");
    err.status = 400;
    throw err;
  }
  const capacity = slotCapacity();
  const booked = db
    .prepare(
      `SELECT COUNT(*) AS c FROM visits
       WHERE slot_start = ? AND status NOT IN ('rejected','completed')`
    )
    .get(slotStart).c;
  if (booked >= capacity) {
    const err = new Error("该时段已满，请选择其他时段");
    err.status = 400;
    throw err;
  }
}

export function makePassCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

/**
 * Risk score 0–100 (higher = riskier) + tier.
 * Works with evaluateAccess output + history queries.
 */
export function computeRisk({
  allowed,
  reasons = [],
  training,
  driverId,
  carrierId,
  visitType = "carrier",
}) {
  if (visitType === "self_pickup") {
    return {
      riskScore: 25,
      riskLevel: "low",
      riskFactors: ["自提轻量通道"],
      fastLane: true,
    };
  }

  let score = 12;
  const factors = [];

  if (!allowed) {
    score += 35;
    factors.push("准入未通过");
  }

  for (const r of reasons) {
    if (r.code === "TRAINING_REQUIRED" || r.code === "TRAINING_EXPIRED") {
      score += 18;
      factors.push("培训风险");
    }
    if (r.code === "DOC_MISSING" || r.code === "DOC_EXPIRED") {
      score += 12;
      factors.push(`证件: ${r.docType || r.message}`);
    }
  }

  if (training?.valid_until) {
    const daysLeft = Math.ceil(
      (new Date(training.valid_until).getTime() - Date.now()) / 86400000
    );
    if (daysLeft <= 30) {
      score += 15;
      factors.push(`培训${daysLeft}天内到期`);
    } else if (daysLeft <= 90) {
      score += 6;
      factors.push("培训临近复训窗口");
    }
  } else if (!training) {
    score += 10;
    factors.push("无有效培训记录");
  }

  const nearDocs = db
    .prepare(
      `SELECT COUNT(*) AS c FROM documents
       WHERE status = 'valid' AND expire_at IS NOT NULL
         AND expire_at <= date('now', '+14 days')
         AND (
           (subject_type = 'driver' AND subject_id = ?)
           OR (subject_type = 'carrier' AND subject_id = ?)
         )`
    )
    .get(driverId, carrierId).c;
  if (nearDocs > 0) {
    score += 10 + Math.min(10, nearDocs * 4);
    factors.push(`${nearDocs} 份证件临期`);
  }

  const priorBlocks = db
    .prepare(
      `SELECT COUNT(*) AS c FROM visits
       WHERE carrier_id = ? AND status IN ('access_pending','rejected')
         AND created_at >= datetime('now', '-30 days')`
    )
    .get(carrierId).c;
  if (priorBlocks > 0) {
    score += Math.min(20, priorBlocks * 5);
    factors.push(`承运商近30天拦截 ${priorBlocks} 次`);
  }

  const priorOk = db
    .prepare(
      `SELECT COUNT(*) AS c FROM visits
       WHERE driver_id = ? AND status = 'completed'`
    )
    .get(driverId).c;
  if (priorOk === 0) {
    score += 14;
    factors.push("首次到场");
  }

  const priorException = db
    .prepare(
      `SELECT COUNT(*) AS c FROM visits
       WHERE driver_id = ? AND exception_note IS NOT NULL`
    )
    .get(driverId).c;
  if (priorException > 0) {
    score += 12;
    factors.push("有过例外放行记录");
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

export function dwellMinutes(onsiteAt) {
  if (!onsiteAt) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(onsiteAt).getTime()) / 60000));
}

export function isDwellOver(onsiteAt) {
  return dwellMinutes(onsiteAt) >= dwellWarnMinutes();
}
