/**
 * 模拟 OCR：从文件名/手工字段推断证件信息。
 * 生产替换为真实 OCR SDK，保持 extractDocument 返回结构不变即可。
 */

const DOC_TEMPLATES = {
  driver_license: {
    fields: ["name", "licenseNo", "vehicleClass", "expireAt"],
    defaultExpireDays: 400,
  },
  vehicle_license: {
    fields: ["plateNo", "owner", "vehicleType", "expireAt"],
    defaultExpireDays: 300,
  },
  qualification: {
    fields: ["name", "category", "expireAt"],
    defaultExpireDays: 500,
  },
  transport_permit: {
    fields: ["companyName", "permitNo", "expireAt"],
    defaultExpireDays: 600,
  },
  insurance: {
    fields: ["policyNo", "coverage", "expireAt"],
    defaultExpireDays: 200,
  },
  id_card: {
    fields: ["name", "idNo", "expireAt"],
    defaultExpireDays: 3650,
  },
  hazmat_permit: {
    fields: ["name", "permitNo", "category", "expireAt"],
    defaultExpireDays: 365,
  },
  manifest: {
    fields: ["manifestNo", "goodsName", "expireAt"],
    defaultExpireDays: 30,
  },
  delivery_note: {
    fields: ["dnNo", "customer", "expireAt"],
    defaultExpireDays: 30,
  },
  auth_letter: {
    fields: ["principal", "agent", "expireAt"],
    defaultExpireDays: 30,
  },
};

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * @param {{ docType: string, hint?: object, forceExpireDays?: number }} input
 */
export function extractDocument(input) {
  const tpl = DOC_TEMPLATES[input.docType];
  if (!tpl) {
    return {
      ok: false,
      confidence: 0,
      fields: {},
      expireAt: null,
      error: `不支持的证件类型: ${input.docType}`,
    };
  }

  const hint = input.hint || {};
  const expireAt =
    hint.expireAt ||
    addDays(
      typeof input.forceExpireDays === "number"
        ? input.forceExpireDays
        : tpl.defaultExpireDays
    );

  const fields = { expireAt };
  for (const f of tpl.fields) {
    if (f === "expireAt") continue;
    fields[f] = hint[f] || demoValue(input.docType, f, hint);
  }

  const confidence = hint.lowConfidence ? 0.55 : 0.92 + Math.random() * 0.06;

  return {
    ok: true,
    confidence: Math.min(0.99, Number(confidence.toFixed(3))),
    fields,
    expireAt,
    provider: "mock-ocr",
    needsManualReview: confidence < 0.7,
  };
}

function demoValue(docType, field, hint) {
  const map = {
    driver_license: {
      name: hint.name || "张师傅",
      licenseNo: "310***********1234",
      vehicleClass: "A2",
    },
    vehicle_license: {
      plateNo: hint.plateNo || "沪A12345",
      owner: hint.owner || "示例物流有限公司",
      vehicleType: "重型厢式货车",
    },
    qualification: {
      name: hint.name || "张师傅",
      category: "道路货物运输驾驶员",
    },
    transport_permit: {
      companyName: hint.companyName || "示例物流有限公司",
      permitNo: "交运许沪字 3100001",
    },
    insurance: {
      policyNo: "PICC-2026-000881",
      coverage: "交强险+商业险",
    },
    id_card: {
      name: hint.name || "张师傅",
      idNo: "310***********1234",
    },
    hazmat_permit: {
      name: hint.name || "张师傅",
      permitNo: "危运许-2026-881",
      category: "3 类易燃液体",
    },
    manifest: {
      manifestNo: hint.manifestNo || "EM-2026-0001",
      goodsName: hint.goodsName || "示例危化品",
    },
    delivery_note: {
      dnNo: hint.dnNo || "DN-2026-0001",
      customer: hint.customer || "示例客户",
    },
    auth_letter: {
      principal: hint.principal || "示例客户公司",
      agent: hint.agent || hint.name || "提货人",
    },
  };
  return map[docType]?.[field] || "";
}

export const DOC_TYPE_LABELS = {
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
