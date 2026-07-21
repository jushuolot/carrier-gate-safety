/** Demo/API content that still arrives in Chinese — localize by lang. */

export const TRAINING = {
  zh: {
    title: "厂区安全准入培训（2026）",
    questions: [
      {
        stem: "进入厂区必须佩戴哪些防护用品？",
        options: ["仅安全帽", "安全帽与反光背心", "随意着装", "仅手套"],
      },
      {
        stem: "车辆限速一般为多少？",
        options: ["不限速", "≤20km/h", "≤60km/h", "≤80km/h"],
      },
      {
        stem: "发现泄漏或火情应首先？",
        options: ["继续作业", "离开并上报", "围观拍照", "自行处理化学品"],
      },
      {
        stem: "装卸作业时发动机应？",
        options: ["保持怠速", "熄火并拉驻车", "加大油门", "无人看管"],
      },
      {
        stem: "证件过期时系统策略是？",
        options: ["口头说明即可", "硬拦截不得入场", "交押金放行", "门岗随意决定"],
      },
    ],
  },
  en: {
    title: "Site safety access training (2026)",
    questions: [
      {
        stem: "Which PPE is required when entering the site?",
        options: ["Hard hat only", "Hard hat and high-vis vest", "Casual dress", "Gloves only"],
      },
      {
        stem: "What is the usual vehicle speed limit?",
        options: ["No limit", "≤20 km/h", "≤60 km/h", "≤80 km/h"],
      },
      {
        stem: "If you spot a leak or fire, you should first:",
        options: ["Keep working", "Leave and report", "Take photos", "Handle chemicals yourself"],
      },
      {
        stem: "During loading/unloading the engine should be:",
        options: ["Idling", "Off with parking brake", "Revved up", "Unattended"],
      },
      {
        stem: "If credentials are expired, the system will:",
        options: ["Accept a verbal note", "Hard-block entry", "Allow with a deposit", "Leave it to the gate"],
      },
    ],
  },
  de: {
    title: "Werkzugangs-Sicherheitsschulung (2026)",
    questions: [
      {
        stem: "Welche PSA ist beim Betreten des Werks erforderlich?",
        options: ["Nur Helm", "Helm und Warnweste", "Freizeitkleidung", "Nur Handschuhe"],
      },
      {
        stem: "Wie hoch ist die übliche Geschwindigkeitsbegrenzung?",
        options: ["Kein Limit", "≤20 km/h", "≤60 km/h", "≤80 km/h"],
      },
      {
        stem: "Bei Leckage oder Feuer sollten Sie zuerst:",
        options: ["Weiterarbeiten", "Verlassen und melden", "Fotos machen", "Chemikalien selbst behandeln"],
      },
      {
        stem: "Beim Be-/Entladen sollte der Motor:",
        options: ["Im Leerlauf bleiben", "Aus sein (Handbremse)", "Hochdrehen", "Unbeaufsichtigt bleiben"],
      },
      {
        stem: "Bei abgelaufenen Ausweisen gilt:",
        options: ["Mündliche Erklärung reicht", "Harte Sperre", "Kaution und Einlass", "Entscheidung der Pforte"],
      },
    ],
  },
};

export const API_ERRORS = {
  "手机号或密码错误": { en: "Invalid phone or password", de: "Telefonnummer oder Passwort ungültig" },
  未登录: { en: "Not signed in", de: "Nicht angemeldet" },
  请先完成安全培训视频观看: {
    en: "Please finish watching the safety training video first",
    de: "Bitte zuerst das Sicherheitsschulungsvideo abschließen",
  },
  "未找到通行码对应单据": { en: "No visit found for this pass code", de: "Kein Vorgang für diesen Passcode" },
  "自提须填写提货人姓名与提货单号(DN)": {
    en: "Self-pickup requires pickup name and DN/order number",
    de: "Selbstabholung erfordert Name und DN/Auftragsnummer",
  },
  请选择到场时段: { en: "Please select an arrival slot", de: "Bitte Ankunftszeitfenster wählen" },
  "该时段已满，请选择其他时段": {
    en: "That slot is full — choose another",
    de: "Zeitfenster voll — bitte anderes wählen",
  },
  "缺少承运商/司机/车辆": { en: "Carrier / driver / vehicle missing", de: "Spediteur / Fahrer / Fahrzeug fehlt" },
  到访单不存在: { en: "Visit not found", de: "Besuch nicht gefunden" },
  "请先完成作业/离场检查步骤": {
    en: "Complete job / departure checklist steps first",
    de: "Zuerst Arbeits-/Abfahrtscheckliste abschließen",
  },
  "role 须为 driver 或 gate": { en: "role must be driver or gate", de: "role muss driver oder gate sein" },
  仅门岗可签退门岗端: { en: "Only gate staff can sign gate checkout", de: "Nur Pforte kann Gate-Checkout signieren" },
  无权限: { en: "Permission denied", de: "Keine Berechtigung" },
  须司机与门岗双方签退后才能开闸离场: {
    en: "Driver and gate must both sign before exit",
    de: "Fahrer und Pforte müssen vor Ausfahrt beide unterschreiben",
  },
  通行码不匹配: { en: "Pass code mismatch", de: "Passcode stimmt nicht" },
  须填写例外原因: { en: "Exception reason is required", de: "Ausnahmegrund erforderlich" },
  "浏览器本地存储已满，请清除本站数据后重试": {
    en: "Browser storage is full — clear site data and retry",
    de: "Browser-Speicher voll — Site-Daten löschen und erneut versuchen",
  },
  无法保存登录状态: { en: "Could not save session", de: "Sitzung konnte nicht gespeichert werden" },
  请求失败: { en: "Request failed", de: "Anfrage fehlgeschlagen" },
};

export const DEMO_NAMES = {
  "u-admin": { en: "System Admin", de: "Systemadmin" },
  "u-ehs": { en: "EHS Officer", de: "EHS-Beauftragte/r" },
  "u-gate": { en: "Gate Officer", de: "Pfortenmitarbeiter/in" },
  "u-carrier": { en: "Carrier Admin", de: "Speditionsadmin" },
  "u-d1": { en: "New driver · Wang Qiang", de: "Neuer Fahrer · Wang Qiang" },
  "u-d2": { en: "Veteran · Li Ming", de: "Routinier · Li Ming" },
  "u-pickup": { en: "Pickup customer · Ms. Chen", de: "Abholkunde · Frau Chen" },
  "driver-new": { en: "New driver · Wang Qiang", de: "Neuer Fahrer · Wang Qiang" },
  "driver-ok": { en: "Veteran · Li Ming", de: "Routinier · Li Ming" },
  "driver-pickup": { en: "Self-pickup (generic)", de: "Selbstabholung (allgemein)" },
  "carrier-1": { en: "Sample Logistics Co.", de: "Beispiel-Logistik GmbH" },
  "carrier-self": { en: "Self-pickup lane", de: "Selbstabholspur" },
  "site-1": { en: "East China Hub 1", de: "Ostchina Hub 1" },
};

export const DEMO_VEHICLE_TYPES = {
  重型厢式货车: { en: "Heavy box truck", de: "Schwerer Koffer-LKW" },
  "小型客车/自提": { en: "Light vehicle / pickup", de: "Pkw / Selbstabholung" },
};

export function demoVehicleType(lang, type) {
  if (!type || lang === "zh") return type;
  return DEMO_VEHICLE_TYPES[type]?.[lang] || type;
}

export function localizeTraining(lang, course, questions) {
  const pack = TRAINING[lang] || TRAINING.zh;
  return {
    course: course ? { ...course, title: pack.title } : course,
    questions: (questions || []).map((q, i) => {
      const loc = pack.questions[i];
      if (!loc) return q;
      return { ...q, stem: loc.stem, options: loc.options };
    }),
  };
}

export function translateApiError(lang, message) {
  if (!message || lang === "zh") return message;
  const hit = API_ERRORS[message];
  if (hit?.[lang]) return hit[lang];
  // parameterized Chinese errors
  let m = /^当前状态不可签退: (.+)$/.exec(message);
  if (m) {
    return lang === "de"
      ? `Checkout in Status nicht möglich: ${m[1]}`
      : `Cannot checkout in status: ${m[1]}`;
  }
  m = /^当前状态不可确认离场: (.+)$/.exec(message);
  if (m) {
    return lang === "de"
      ? `Abfahrt in Status nicht bestätigbar: ${m[1]}`
      : `Cannot confirm departure in status: ${m[1]}`;
  }
  m = /^当前状态不可批准: (.+)$/.exec(message);
  if (m) {
    return lang === "de"
      ? `Genehmigung in Status nicht möglich: ${m[1]}`
      : `Cannot approve in status: ${m[1]}`;
  }
  m = /^当前状态不可驳回: (.+)$/.exec(message);
  if (m) {
    return lang === "de"
      ? `Ablehnung in Status nicht möglich: ${m[1]}`
      : `Cannot reject in status: ${m[1]}`;
  }
  m = /^未实现的演示接口: (.+)$/.exec(message);
  if (m) {
    return lang === "de"
      ? `Demo-API nicht implementiert: ${m[1]}`
      : `Demo API not implemented: ${m[1]}`;
  }
  return message;
}

export function demoName(lang, id, fallback) {
  if (!id || lang === "zh") return fallback;
  return DEMO_NAMES[id]?.[lang] || fallback;
}

export function listJoin(lang) {
  return lang === "zh" ? "、" : ", ";
}
