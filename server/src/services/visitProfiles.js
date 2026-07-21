/**
 * 到访类型与步骤配置 — 对齐厂区运输车辆/客户自提全生命周期图
 * 1 预约 → 2 培训 → 3 登记 → 4 OCR校验 → 5 门岗 Check In → 6 作业/离场检查 → 7 双签 Check Out
 */

export const VISIT_TYPES = {
  carrier_inbound: {
    id: "carrier_inbound",
    label: "运输入场（送货）",
    accessMode: "full",
    lifecycle: "carrier",
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
      { key: "weighbridge", label: "过磅记录", device: "scale" },
      { key: "sealPhoto", label: "铅封拍照取证" },
    ],
  },
  carrier_outbound: {
    id: "carrier_outbound",
    label: "运输出场（提货）",
    accessMode: "full",
    lifecycle: "carrier",
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
      { key: "weighbridge", label: "过磅记录", device: "scale" },
      { key: "sealPhoto", label: "铅封拍照取证" },
    ],
  },
  /** 兼容旧种子/自检：等同运输入场 */
  carrier: {
    id: "carrier",
    label: "承运到场",
    aliasOf: "carrier_inbound",
  },
  self_pickup: {
    id: "self_pickup",
    label: "客户自提",
    accessMode: "light",
    lifecycle: "pickup",
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
      { key: "weighbridge", label: "过磅", device: "scale" },
      { key: "packingPhoto", label: "装车/件数拍照取证" },
      { key: "invoicePrint", label: "打印出门证/提货凭证" },
    ],
  },
  temporary: {
    id: "temporary",
    label: "其他临时车辆",
    accessMode: "temporary",
    lifecycle: "temporary",
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

/** 将历史 carrier 归一到 carrier_inbound */
export function normalizeVisitType(visitType) {
  if (!visitType || visitType === "carrier") return "carrier_inbound";
  if (VISIT_TYPES[visitType]) {
    const t = VISIT_TYPES[visitType];
    return t.aliasOf || t.id;
  }
  return "carrier_inbound";
}

export function listVisitTypeMeta() {
  return ["carrier_inbound", "carrier_outbound", "self_pickup", "temporary"].map((id) => {
    const t = getVisitProfile(id);
    return {
      id: t.id,
      label: t.label,
      accessMode: t.accessMode,
      departCore: t.departCore,
      departOptional: t.departOptional,
      inspectChecklist: t.inspectChecklist,
    };
  });
}

export function getVisitProfile(visitType) {
  let key = visitType || "carrier_inbound";
  let raw = VISIT_TYPES[key];
  if (raw?.aliasOf) raw = VISIT_TYPES[raw.aliasOf];
  if (!raw || raw.aliasOf) raw = VISIT_TYPES[normalizeVisitType(visitType)];
  return raw || VISIT_TYPES.carrier_inbound;
}

/** 解析创建时勾选的可选项（仅允许本类型 optional 清单内的 key） */
export function normalizeSelectedOptions(visitType, selected = []) {
  const profile = getVisitProfile(visitType);
  const allowed = new Set(profile.departOptional.map((s) => s.key));
  const list = Array.isArray(selected) ? selected : [];
  return [...new Set(list.filter((k) => allowed.has(k)))];
}

/** 本次离场实际必做步骤 = core + 已选 optional（不含门岗双签，双签走 checkout） */
export function resolveDepartSteps(visitType, selectedOptions = []) {
  const profile = getVisitProfile(visitType);
  const selected = normalizeSelectedOptions(visitType, selectedOptions).filter((k) => k !== "hazmat");
  const optionalMap = Object.fromEntries(profile.departOptional.map((s) => [s.key, s]));
  const steps = [
    ...profile.departCore.map((s) => ({ ...s, required: true, source: "core" })),
    ...selected
      .filter((key) => optionalMap[key] && optionalMap[key].key !== "hazmat")
      .map((key) => ({
        ...optionalMap[key],
        required: true,
        source: "optional",
      })),
  ];
  return steps;
}

export function missingDepartSteps(visitType, selectedOptions, submitted = {}) {
  const required = resolveDepartSteps(visitType, selectedOptions);
  const steps = { ...(submitted.steps || {}), ...submitted };
  const missing = required.filter((s) => !steps[s.key]).map((s) => s.key);
  return { required, missing, steps: Object.fromEntries(required.map((s) => [s.key, !!steps[s.key]])) };
}

export function needsWeighOnDepart(visitType, selectedOptions) {
  return resolveDepartSteps(visitType, selectedOptions).some((s) => s.device === "scale");
}

export function isHazmatVisit(selectedOptions = []) {
  return (selectedOptions || []).includes("hazmat");
}
