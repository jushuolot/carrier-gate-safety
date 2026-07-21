/**
 * Full-flow self-check against live Express API (localhost:7080).
 * Run after: npm run seed && npm run start -w server
 */
const BASE = process.env.API_BASE || "http://127.0.0.1:7080/api";
const results = [];

function ok(name, detail = "") {
  results.push({ name, pass: true, detail });
  console.log(`PASS  ${name}${detail ? " — " + detail : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, pass: false, detail });
  console.error(`FAIL  ${name}${detail ? " — " + detail : ""}`);
}
function assert(name, cond, detail = "") {
  if (cond) ok(name, detail);
  else fail(name, detail);
}

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function login(phone, password) {
  const data = await api("/auth/login", { method: "POST", body: { phone, password } });
  return data;
}

async function main() {
  console.log(`=== carrier-gate-safety server self-check (${BASE}) ===\n`);

  try {
    const h = await api("/health");
    assert("健康检查", h.ok === true || h.status === "ok" || h.service, JSON.stringify(h));
  } catch (e) {
    fail("健康检查", e.message);
    console.error("\nServer not reachable. Start with: npm run seed && npm run start -w server");
    process.exit(1);
  }

  const roles = [
    ["admin", "13800000000", "admin123"],
    ["gate", "13800000002", "gate123"],
    ["driver-new", "13900000001", "driver123"],
    ["driver-ok", "13900000002", "driver123"],
  ];
  const tokens = {};
  for (const [label, phone, password] of roles) {
    try {
      const data = await login(phone, password);
      tokens[label] = data.token;
      assert(`登录 ${label}`, !!data.token, data.user?.name);
    } catch (e) {
      fail(`登录 ${label}`, e.message);
    }
  }

  // Gate seed queue
  try {
    const pending = await api("/visits?status=access_pending", { token: tokens.gate });
    const inspecting = await api("/visits?status=inspecting", { token: tokens.gate });
    assert(
      "种子待办存在",
      inspecting.items?.length >= 1 || pending.items?.length >= 1,
      `inspecting=${inspecting.items?.length} pending=${pending.items?.length}`
    );

    const job = inspecting.items?.[0] || pending.items?.[0];
    if (job?.status === "inspecting") {
      const detail = await api(`/visits/${job.id}`, { token: tokens.gate });
      const checklist = Object.fromEntries(
        (detail.inspectChecklist || []).map((c) => [c.key, true])
      );
      const r = await api(`/visits/${job.id}/inspect`, {
        method: "POST",
        token: tokens.gate,
        body: { pass: true, checklist },
      });
      assert("门岗放行种子单", r.ok && r.visit.status === "onsite", r.deviceResult?.txnId);
    } else if (job?.status === "access_pending") {
      const r = await api(`/visits/${job.id}/exception`, {
        method: "POST",
        token: tokens.gate,
        body: { reason: "自检例外", approverNote: "ok" },
      });
      assert("门岗例外放行", r.ok && r.visit.status === "onsite");
    }
  } catch (e) {
    fail("门岗种子操作", e.message);
  }

  // Ready driver full mini flow
  try {
    const me = await login("13900000002", "driver123");
    const token = me.token;
    const vehicles = await api(`/vehicles?carrierId=${me.user.carrier_id}`, { token });
    const vehicleId = vehicles.items[0]?.id;
    const slots = await api("/meta/slots", { token });
    const slot = (slots.items || []).find((s) => s.available) || slots.items?.[0];
    assert("时段接口", !!slot?.slotStart);
    const created = await api("/visits", {
      method: "POST",
      token,
      body: {
        visitType: "carrier",
        carrierId: me.user.carrier_id,
        driverId: me.user.driver_id,
        vehicleId,
        slotStart: slot.slotStart,
        slotEnd: slot.slotEnd,
      },
    });
    assert("熟手创建预约", !!created.visit?.id);

    const checkin = await api(`/visits/${created.visit.id}/checkin`, {
      method: "POST",
      token,
      body: {},
    });
    assert(
      "熟手报到",
      checkin.ok === true && checkin.visit.status === "inspecting",
      checkin.message || checkin.visit?.status
    );

    if (checkin.ok) {
      const detail = await api(`/visits/${created.visit.id}`, { token: tokens.gate });
      const checklist = Object.fromEntries(
        (detail.inspectChecklist || []).map((c) => [c.key, true])
      );
      const insp = await api(`/visits/${created.visit.id}/inspect`, {
        method: "POST",
        token: tokens.gate,
        body: { pass: true, checklist },
      });
      assert("熟手放行", insp.ok && insp.visit.status === "onsite");

      const departBody = {};
      for (const s of detail.departSteps || []) departBody[s.key] = true;
      // refresh depart steps after inspect (same profile)
      const after = await api(`/visits/${created.visit.id}`, { token: tokens.gate });
      for (const s of after.departSteps || []) departBody[s.key] = true;
      const depart = await api(`/visits/${created.visit.id}/depart`, {
        method: "POST",
        token,
        body: departBody,
      });
      assert(
        "熟手离场检查",
        depart.ok && depart.visit.status === "departing",
        depart.visit?.status
      );
      await api(`/visits/${created.visit.id}/checkout/sign`, {
        method: "POST",
        token,
        body: { role: "driver" },
      });
      await api(`/visits/${created.visit.id}/checkout/sign`, {
        method: "POST",
        token: tokens.gate,
        body: { role: "gate" },
      });
      const confirm = await api(`/visits/${created.visit.id}/checkout/confirm`, {
        method: "POST",
        token: tokens.gate,
        body: { passCode: checkin.visit.pass_code },
      });
      assert(
        "熟手离场",
        confirm.ok && confirm.visit.status === "completed" && !!confirm.archiveKey,
        confirm.archiveKey || confirm.visit?.status
      );
    }
  } catch (e) {
    fail("熟手闭环", e.message);
  }

  // New driver training progress
  try {
    const me = await login("13900000001", "driver123");
    const token = me.token;
    const course = await api("/training/course?siteId=site-1", { token });
    const min = course.course.min_watch_seconds;
    const p = await api("/training/progress", {
      method: "POST",
      token,
      body: { watchedSeconds: min, driverId: me.user.driver_id },
    });
    assert("新司机视频进度", !!p.record?.video_completed);

    const answers = {};
    // Need real answer indices from DB — fetch via quiz wrong first or use all 1
    // Server questions include answer_index only server-side; client list may omit it
    for (const q of course.questions) answers[q.id] = 1;
    const quiz = await api("/training/quiz", {
      method: "POST",
      token,
      body: { answers, driverId: me.user.driver_id },
    });
    assert("新司机答题", typeof quiz.score === "number", `passed=${quiz.passed} score=${quiz.score}`);
  } catch (e) {
    fail("新司机培训", e.message);
  }

  // Admin
  try {
    const dash = await api("/dashboard", { token: tokens.admin });
    assert("看板", typeof dash.onsite === "number" || typeof dash.todayAppointed === "number");
    const docs = await api("/documents/expiring?days=30", { token: tokens.admin });
    assert("证件到期", Array.isArray(docs.items));
    const lpr = await api("/devices/lpr/simulate", {
      method: "POST",
      token: tokens.gate,
      body: { plateNo: "沪A12345" },
    });
    assert("LPR", !!lpr.captured?.plateNo);
  } catch (e) {
    fail("管理/设备", e.message);
  }

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n=== summary: ${passed} passed, ${failed} failed / ${results.length} ===`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
