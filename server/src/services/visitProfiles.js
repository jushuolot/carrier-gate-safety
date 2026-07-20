/**
 * 到访类型与步骤配置
 * - carrier：承运商到离场（原流程）
 * - self_pickup：客户自提；必选步骤固定，可选项创建时勾选
 */

export const VISIT_TYPES = {
  carrier: {
    id: "carrier",
    label: "承运到场",
    accessMode: "full", // 培训+人车组织证件
    inspectChecklist: [
      { key: "ppe", label: "PPE 佩戴合格（安全帽/反光衣）" },
      { key: "vehicle", label: "车辆外观/轮胎检查合格" },
      { key: "docs", label: "纸质证件与系统一致" },
      { key: "hazard", label: "无泄漏/无危险品违规" },
    ],
    departCore: [
      { key: "loadDone", label: "装卸完成确认" },
      { key: "inventoryDone", label: "物资/铅封清点" },
      { key: "safetySigned", label: "安全确认签署" },
      { key: "gateCheckout", label: "门岗签退" },
    ],
    departOptional: [
      { key: "weighbridge", label: "过磅记录", device: "scale" },
      { key: "sealPhoto", label: "铅封拍照取证" },
    ],
  },
  self_pickup: {
    id: "self_pickup",
    label: "客户自提",
    accessMode: "light", // 不强制承运培训/全量证件；按勾选步骤管控
    inspectChecklist: [
      { key: "idVerify", label: "提货人身份核验" },
      { key: "orderMatch", label: "提货单/订单与实物一致" },
      { key: "ppe", label: "进入作业区 PPE 合格（若入区）" },
    ],
    /** 自提固定必做（离场收口） */
    departCore: [
      { key: "orderConfirm", label: "提货单核对完成" },
      { key: "goodsHandover", label: "货物交接签收" },
      { key: "gateCheckout", label: "门岗签退/出门证" },
    ],
    /** 创建预约时可勾选；勾选后成为本次必做 */
    departOptional: [
      { key: "safetyBrief", label: "现场安全告知（短训确认）" },
      { key: "vehicleInspect", label: "自提车辆外观检查" },
      { key: "weighbridge", label: "过磅", device: "scale" },
      { key: "packingPhoto", label: "装车/件数拍照取证" },
      { key: "invoicePrint", label: "打印出门证/提货凭证" },
    ],
  },
};

export function listVisitTypeMeta() {
  return Object.values(VISIT_TYPES).map((t) => ({
    id: t.id,
    label: t.label,
    accessMode: t.accessMode,
    departCore: t.departCore,
    departOptional: t.departOptional,
    inspectChecklist: t.inspectChecklist,
  }));
}

export function getVisitProfile(visitType) {
  return VISIT_TYPES[visitType] || VISIT_TYPES.carrier;
}

/** 解析创建时勾选的可选项（仅允许本类型 optional 清单内的 key） */
export function normalizeSelectedOptions(visitType, selected = []) {
  const profile = getVisitProfile(visitType);
  const allowed = new Set(profile.departOptional.map((s) => s.key));
  const list = Array.isArray(selected) ? selected : [];
  return [...new Set(list.filter((k) => allowed.has(k)))];
}

/** 本次离场实际必做步骤 = core + 已选 optional */
export function resolveDepartSteps(visitType, selectedOptions = []) {
  const profile = getVisitProfile(visitType);
  const selected = normalizeSelectedOptions(visitType, selectedOptions);
  const optionalMap = Object.fromEntries(profile.departOptional.map((s) => [s.key, s]));
  const steps = [
    ...profile.departCore.map((s) => ({ ...s, required: true, source: "core" })),
    ...selected.map((key) => ({
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
