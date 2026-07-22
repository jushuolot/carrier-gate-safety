/** Map API status / type / doc / checklist / risk keys to translated labels. */

const LEGACY_RISK = {
  临时车辆通道: "rf_temporary_lane",
  自提轻量通道: "rf_self_pickup_lane",
  准入未通过: "rf_access_denied",
  培训风险: "rf_training",
  证件风险: "rf_doc",
  无有效培训记录: "rf_no_training",
  首次到场: "rf_first_visit",
};

const LEGACY_REASON = {
  TRAINING_REQUIRED: "rc_training_required",
  TRAINING_EXPIRED: "rc_training_expired",
  DOC_MISSING: "rc_doc_missing",
  DOC_EXPIRED: "rc_doc_expired",
  CARRIER_BLOCKED: "rc_carrier_blocked",
  DRIVER_BLOCKED: "rc_driver_blocked",
  VEHICLE_BLOCKED: "rc_vehicle_blocked",
  HAZMAT_NO_PLATE: "rc_hazmat_no_plate",
  HAZMAT_PERMIT_MISMATCH: "rc_hazmat_permit_mismatch",
  HAZMAT_PERMIT_EXPIRED: "rc_hazmat_permit_expired",
  HAZMAT_QUAL_EXPIRED: "rc_hazmat_qual_expired",
  HAZMAT_QUAL_PERSON_MISMATCH: "rc_hazmat_qual_person",
  HAZMAT_CARRIER_LICENSE: "rc_hazmat_carrier_license",
  HAZMAT_DIR_NOT_LISTED: "rc_hazmat_dir",
  HAZMAT_WAYBILL_MISSING: "rc_hazmat_waybill",
};

export function localeOf(lang) {
  if (lang === "de") return "de-DE";
  if (lang === "en") return "en-US";
  return "zh-CN";
}

export function formatDateTime(lang, iso, opts = {}) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString(localeOf(lang), {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      ...opts,
    });
  } catch {
    return String(iso).slice(0, opts.second ? 19 : 16);
  }
}

export function statusLabel(t, status) {
  return t(`st_${status}`) || status;
}

export function visitTypeLabel(t, id) {
  if (!id) return "";
  const key = id === "carrier" ? "vt_carrier_inbound" : `vt_${id}`;
  return t(key) || id;
}

export function docTypeLabel(t, type) {
  return t(`doc_${type}`) || type;
}

export function checkLabel(t, key) {
  return t(`ck_${key}`) || key;
}

export function riskFactorLabel(t, factor) {
  if (!factor) return "";
  if (typeof factor === "string" && factor.startsWith("rf_")) {
    const [base, n] = factor.split(":");
    const tpl = t(base);
    if (n != null && tpl.includes("{n}")) return tpl.replace("{n}", n);
    return tpl || factor;
  }
  const legacyKey = LEGACY_RISK[factor];
  if (legacyKey) return t(legacyKey);
  const expiring = /^培训(\d+)天内到期$/.exec(factor);
  if (expiring) return t("rf_training_expiring").replace("{n}", expiring[1]);
  const blocks = /^承运商近30天拦截 (\d+) 次$/.exec(factor);
  if (blocks) return t("rf_carrier_blocks").replace("{n}", blocks[1]);
  return factor;
}

export function reasonLabel(t, reason) {
  if (!reason) return "";
  const code = reason.code;
  if (code && LEGACY_REASON[code]) {
    let msg = t(LEGACY_REASON[code]);
    if (reason.docType) msg = msg.replace("{doc}", docTypeLabel(t, reason.docType));
    if (reason.validUntil != null) msg = msg.replace("{date}", reason.validUntil);
    return msg;
  }
  return reason.message || code || "";
}

export function riskLevelLabel(t, level) {
  return t(`risk_${level}`) || level;
}

export function subjectTypeLabel(t, type) {
  return t(`subj_${type}`) || type;
}
