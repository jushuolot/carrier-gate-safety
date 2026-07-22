/**
 * 危货资质核验总线（对接优先）
 * 演示默认 mock；生产替换为 HTTP Adapter，不改准入状态机。
 *
 * @typedef {'pass'|'fail'|'unknown'|'manual_cached'} LightState
 */

/**
 * Mock / 可替换核验：实车车牌 + 本地辅证 + 车辆联控目录标记
 * @param {object} ctx
 */
export function verifyHazmat(ctx = {}) {
  const {
    plateNo = "",
    plateColor = "2",
    driverName = "",
    transportPermitOk = false,
    hazmatQualOk = false,
    manifestOk = false,
    carrierLicenseOk = true,
    networkDirectoryOk = false,
    networkDirectorySource = "manual_cached", // 'api' | 'manual_cached'
    permitMismatch = false,
    identityMatch = true,
    pickupRef = "",
    provider = "mock-hazmat-verify",
  } = ctx;

  const lights = {
    vehiclePermit: "unknown",
    driverQual: "unknown",
    carrierLicense: "unknown",
    networkDirectory: "unknown",
    waybill: "unknown",
    identityMatch: "unknown",
  };
  const reasons = [];

  if (!plateNo) {
    reasons.push({ code: "HAZMAT_NO_PLATE", message: "缺少实车车牌，无法核验" });
  }

  if (permitMismatch) {
    lights.vehiclePermit = "fail";
    reasons.push({
      code: "HAZMAT_PERMIT_MISMATCH",
      message: "运输证与车牌不一致（套牌嫌疑）",
    });
  } else if (transportPermitOk) {
    lights.vehiclePermit = "pass";
  } else {
    lights.vehiclePermit = "fail";
    reasons.push({
      code: "HAZMAT_PERMIT_EXPIRED",
      message: "道路运输证核验未通过或已过期",
    });
  }

  if (hazmatQualOk) {
    lights.driverQual = "pass";
  } else {
    lights.driverQual = "fail";
    reasons.push({
      code: "HAZMAT_QUAL_EXPIRED",
      message: "危货从业资格证核验未通过或已过期",
    });
  }

  if (identityMatch && driverName) {
    lights.identityMatch = "pass";
  } else {
    lights.identityMatch = "fail";
    reasons.push({
      code: "HAZMAT_QUAL_PERSON_MISMATCH",
      message: "资格证持有人与当前司机不一致",
    });
  }

  if (carrierLicenseOk) {
    lights.carrierLicense = "pass";
  } else {
    lights.carrierLicense = "fail";
    reasons.push({
      code: "HAZMAT_CARRIER_LICENSE",
      message: "危货道路运输经营许可无效或过期",
    });
  }

  if (networkDirectoryOk) {
    lights.networkDirectory =
      networkDirectorySource === "api" ? "pass" : "manual_cached";
  } else {
    lights.networkDirectory = "fail";
    reasons.push({
      code: "HAZMAT_DIR_NOT_LISTED",
      message: "未通过上海联网联控目录/准入核验",
    });
  }

  if (manifestOk || (pickupRef && String(pickupRef).trim())) {
    lights.waybill = "pass";
  } else {
    lights.waybill = "fail";
    reasons.push({
      code: "HAZMAT_WAYBILL_MISSING",
      message: "缺少电子运单/DN 或与预约不一致",
    });
  }

  const ok = reasons.length === 0;
  return {
    ok,
    lights,
    reasons,
    provider,
    requestId: `HZ-${Date.now().toString(36).toUpperCase()}`,
    plateNo,
    plateColor,
    checkedAt: new Date().toISOString(),
  };
}

/** 从本地证件列表判断是否有效（演示辅证 / 模拟 API 通过条件） */
export function localDocOk(docs, docType, today) {
  const d = (docs || [])
    .filter((x) => x.doc_type === docType && x.status === "valid")
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))[0];
  if (!d) return false;
  if (d.expire_at && d.expire_at < today) return false;
  return true;
}
