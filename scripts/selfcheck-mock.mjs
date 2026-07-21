/**
 * Full-flow self-check for Pages mock API (no browser).
 * Run: node --input-type=module scripts/selfcheck-mock.mjs
 */
import { createRequire } from "module";
import { pathToFileURL } from "url";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Minimal localStorage for mockApi
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
globalThis.location = { hostname: "jushuolot.github.io" };

const { mockApi } = await import(
  pathToFileURL(path.join(root, "web/src/mockApi.js")).href
);

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

async function asUser(phone, password) {
  const data = await mockApi("/auth/login", {
    method: "POST",
    body: { phone, password },
  });
  const headers = { Authorization: `Bearer ${data.token}` };
  const api = (p, opts = {}) =>
    mockApi(p, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  return { user: data.user, api };
}

async function main() {
  console.log("=== carrier-gate-safety mock full-flow self-check ===\n");

  // 1. Health / meta
  try {
    const h = await mockApi("/health");
    assert("健康检查", h.ok === true, JSON.stringify(h));
  } catch (e) {
    fail("健康检查", e.message);
  }

  // 2. All role logins
  const logins = [
    ["admin", "13800000000", "admin123", "admin"],
    ["ehs", "13800000001", "ehs123", "ehs"],
    ["gate", "13800000002", "gate123", "gate"],
    ["carrier", "13800000003", "carrier123", "carrier_admin"],
    ["driver-new", "13900000001", "driver123", "driver"],
    ["driver-ok", "13900000002", "driver123", "driver"],
    ["pickup", "13700000001", "pickup123", "driver"],
  ];
  for (const [label, phone, password, role] of logins) {
    try {
      const { user } = await asUser(phone, password);
      assert(`登录 ${label}`, user.role === role, user.name);
    } catch (e) {
      fail(`登录 ${label}`, e.message);
    }
  }

  // 3. New driver: training → docs → visit → checkin (expect block) → complete training path
  store.clear(); // fresh seed
  {
    const { user, api } = await asUser("13900000001", "driver123");
    try {
      const course = await api("/training/course?siteId=site-1");
      assert("新司机拉课程", !!course.course?.id && course.questions?.length >= 5);

      const min = course.course.min_watch_seconds;
      let watched = 0;
      while (watched < min) {
        watched = Math.min(watched + 5, min);
        const p = await api("/training/progress", {
          method: "POST",
          body: { watchedSeconds: watched, driverId: user.driver_id },
        });
        if (watched >= min) {
          assert("培训视频看完", !!p.record.video_completed, `${watched}s`);
        }
      }

      const answers = {};
      for (const q of course.questions) {
        // mock questions don't expose answer_index to client — use known seed answers
        answers[q.id] = 1; // all seed answers are index 1
      }
      const quiz = await api("/training/quiz", {
        method: "POST",
        body: { answers, driverId: user.driver_id },
      });
      assert("培训答题通过", quiz.passed === true, `score=${quiz.score}`);

      for (const docType of ["driver_license", "qualification"]) {
        const ocr = await api("/documents/ocr", {
          method: "POST",
          body: {
            subjectType: "driver",
            subjectId: user.driver_id,
            docType,
            forceExpireDays: 200,
            hint: { name: user.name },
            confirm: true,
          },
        });
        assert(`OCR 上传 ${docType}`, !!ocr.id, ocr.ocr?.expireAt);
      }

      const vehicles = await api(`/vehicles?carrierId=${user.carrier_id}`);
      const vehicleId = vehicles.items[0]?.id;
      assert("车辆列表", !!vehicleId);

      const access = await api("/access/evaluate", {
        method: "POST",
        body: {
          driverId: user.driver_id,
          vehicleId,
          carrierId: user.carrier_id,
        },
      });
      assert("准入评估可入场", access.allowed === true, JSON.stringify(access.lights));

      const slots = await api("/meta/slots");
      const slot = (slots.items || []).find((s) => s.available) || slots.items[0];
      const visit = await api("/visits", {
        method: "POST",
        body: {
          visitType: "carrier",
          carrierId: user.carrier_id,
          driverId: user.driver_id,
          vehicleId,
          slotStart: slot.slotStart,
          slotEnd: slot.slotEnd,
        },
      });
      assert("创建预约", visit.visit?.status === "appointed", visit.visit?.id);

      const checkin = await api(`/visits/${visit.visit.id}/checkin`, {
        method: "POST",
        body: {},
      });
      assert(
        "报到进入安检",
        checkin.ok === true && checkin.visit.status === "inspecting",
        checkin.visit?.status
      );

      // Gate inspect
      const gate = await asUser("13800000002", "gate123");
      const detail = await gate.api(`/visits/${visit.visit.id}`);
      const checklist = Object.fromEntries(
        (detail.inspectChecklist || []).map((c) => [c.key, true])
      );
      const inspect = await gate.api(`/visits/${visit.visit.id}/inspect`, {
        method: "POST",
        body: { pass: true, checklist },
      });
      assert(
        "门岗安检开闸",
        inspect.ok === true && inspect.visit.status === "onsite",
        inspect.deviceResult?.txnId
      );

      // Driver depart prepare + dual checkout
      const after = await gate.api(`/visits/${visit.visit.id}`);
      const departBody = {};
      for (const s of after.departSteps || []) departBody[s.key] = true;
      const depart = await api(`/visits/${visit.visit.id}/depart`, {
        method: "POST",
        body: departBody,
      });
      assert(
        "作业离场检查完成",
        depart.ok === true && depart.visit.status === "departing" && depart.pendingCheckout,
        depart.visit?.status
      );
      const dSign = await api(`/visits/${visit.visit.id}/checkout/sign`, {
        method: "POST",
        body: { role: "driver" },
      });
      assert("司机签退", !!dSign.visit?.checkout_signs?.driver);
      const gSign = await gate.api(`/visits/${visit.visit.id}/checkout/sign`, {
        method: "POST",
        body: { role: "gate" },
      });
      assert("门岗签退", gSign.bothSigned === true);
      const confirm = await gate.api(`/visits/${visit.visit.id}/checkout/confirm`, {
        method: "POST",
        body: { passCode: visit.visit.pass_code || checkin.visit.pass_code },
      });
      assert(
        "双签离场闭环",
        confirm.ok === true && confirm.visit.status === "completed" && !!confirm.archiveKey,
        confirm.archiveKey || confirm.visit?.status
      );
    } catch (e) {
      fail("新司机全流程", e.stack || e.message);
    }
  }

  // 4. Seeded demo queue + exception path
  store.clear();
  {
    try {
      const gate = await asUser("13800000002", "gate123");
      const pending = await gate.api("/visits?status=access_pending");
      const inspecting = await gate.api("/visits?status=inspecting");
      assert(
        "种子待办-安检中",
        inspecting.items.some((v) => v.id === "visit-demo-inspect"),
        `n=${inspecting.items.length}`
      );
      assert(
        "种子待办-待准入",
        pending.items.some((v) => v.id === "visit-demo-pending"),
        `n=${pending.items.length}`
      );

      const demo = await gate.api("/visits/visit-demo-inspect");
      const checklist = Object.fromEntries(
        (demo.inspectChecklist || []).map((c) => [c.key, true])
      );
      const r = await gate.api("/visits/visit-demo-inspect/inspect", {
        method: "POST",
        body: { pass: true, checklist },
      });
      assert("种子单据放行", r.ok && r.visit.status === "onsite");

      const ex = await gate.api("/visits/visit-demo-pending/exception", {
        method: "POST",
        body: { reason: "紧急保供", approverNote: "自检" },
      });
      assert("例外申请双签", ex.pendingApproval && ex.visit.status === "exception_requested");
      const ehs = await asUser("13800000001", "ehs123");
      const appr = await ehs.api("/visits/visit-demo-pending/exception/approve", {
        method: "POST",
        body: { approverNote: "自检批准" },
      });
      assert("例外放行", appr.ok && appr.visit.status === "onsite", appr.deviceResult?.ok);

      const lpr = await gate.api("/devices/lpr/simulate", {
        method: "POST",
        body: { plateNo: "沪A12345" },
      });
      assert("LPR 抓拍", lpr.captured?.plateNo === "沪A12345" && !!lpr.vehicle);
    } catch (e) {
      fail("门岗种子/例外/LPR", e.stack || e.message);
    }
  }

  // 5. Self-pickup flow
  store.clear();
  {
    try {
      const { user, api } = await asUser("13700000001", "pickup123");
      const slots = await api("/meta/slots");
      const slot = (slots.items || []).find((s) => s.available) || slots.items[0];
      const created = await api("/visits", {
        method: "POST",
        body: {
          visitType: "self_pickup",
          customerName: user.name,
          customerPhone: user.phone,
          pickupRef: "PO-SELFCHECK-001",
          selectedOptions: ["invoicePrint"],
          slotStart: slot.slotStart,
          slotEnd: slot.slotEnd,
        },
      });
      assert("自提预约", created.visit?.visit_type === "self_pickup");

      const checkin = await api(`/visits/${created.visit.id}/checkin`, {
        method: "POST",
        body: {},
      });
      // pickup may have lighter access rules
      assert(
        "自提报到",
        ["inspecting", "access_pending"].includes(checkin.visit?.status),
        checkin.visit?.status + (checkin.message ? ` (${checkin.message})` : "")
      );

      if (checkin.visit?.status === "inspecting") {
        const gate = await asUser("13800000002", "gate123");
        const detail = await gate.api(`/visits/${created.visit.id}`);
        const checklist = Object.fromEntries(
          (detail.inspectChecklist || []).map((c) => [c.key, true])
        );
        const insp = await gate.api(`/visits/${created.visit.id}/inspect`, {
          method: "POST",
          body: { pass: true, checklist },
        });
        assert("自提安检放行", insp.ok && insp.visit.status === "onsite");
      } else {
        ok("自提报到(准入拦截可接受)", checkin.message || checkin.visit?.status);
      }
    } catch (e) {
      fail("自提流程", e.stack || e.message);
    }
  }

  // 6. Admin dashboard / documents / audit
  store.clear();
  {
    try {
      const admin = await asUser("13800000000", "admin123");
      const dash = await admin.api("/dashboard");
      assert("运营看板", typeof dash.onsite === "number");

      const docs = await admin.api("/documents/expiring?days=14");
      assert("证件到期列表", Array.isArray(docs.items));

      const visits = await admin.api("/visits");
      assert("到离场台账", Array.isArray(visits.items) && visits.items.length >= 2);

      const devices = await admin.api("/devices");
      assert("设备列表", Array.isArray(devices.items) && devices.items.length > 0);

      const audit = await admin.api("/audit");
      assert("审计日志", Array.isArray(audit.items));

      const masters = await admin.api("/carriers");
      assert("承运商主数据", Array.isArray(masters.items));
    } catch (e) {
      fail("管理后台接口", e.stack || e.message);
    }
  }


  // 7. Slots / risk / passCode / dual-approve
  store.clear();
  {
    try {
      const driver = await asUser("13900000002", "driver123");
      const slots = await driver.api("/meta/slots");
      assert("时段列表", Array.isArray(slots.items) && slots.items.length > 0, `n=${slots.items.length}`);
      const slot = slots.items.find((s) => s.available) || slots.items[0];
      const created = await driver.api("/visits", {
        method: "POST",
        body: {
          visitType: "carrier",
          carrierId: "carrier-1",
          driverId: "driver-ok",
          vehicleId: "veh-1",
          slotStart: slot.slotStart,
          slotEnd: slot.slotEnd,
        },
      });
      assert("带时段预约", !!created.visit?.slot_start && created.access?.riskScore != null, `risk=${created.access?.riskScore}`);

      // fill capacity
      let blocked = false;
      for (let i = 0; i < 8; i++) {
        try {
          await driver.api("/visits", {
            method: "POST",
            body: {
              visitType: "carrier",
              carrierId: "carrier-1",
              driverId: "driver-ok",
              vehicleId: "veh-1",
              slotStart: slot.slotStart,
              slotEnd: slot.slotEnd,
            },
          });
        } catch (e) {
          if (/已满/.test(e.message)) {
            blocked = true;
            break;
          }
        }
      }
      assert("时段满员拦截", blocked);

      const checkin = await driver.api(`/visits/${created.visit.id}/checkin`, { method: "POST", body: {} });
      assert("报到生成通行码", !!checkin.visit?.pass_code, checkin.visit?.pass_code);

      const gate = await asUser("13800000002", "gate123");
      const byCode = await gate.api(`/visits?passCode=${checkin.visit.pass_code}`);
      assert("通行码查询", byCode.visit?.id === created.visit.id);

      const lpr = await gate.api("/devices/lpr/simulate", {
        method: "POST",
        body: { plateNo: "沪A12345" },
      });
      assert("LPR匹配单据", !!lpr.matchedVisit, lpr.matchedVisit?.pass_code);

      // dual approve on pending seed after clear+relogin uses fresh seed — use demo pending
      store.clear();
      const gate2 = await asUser("13800000002", "gate123");
      const req = await gate2.api("/visits/visit-demo-pending/exception", {
        method: "POST",
        body: { reason: "自检双签" },
      });
      assert("门岗提交双签", req.pendingApproval === true && req.visit.status === "exception_requested");
      const ehs = await asUser("13800000001", "ehs123");
      const appr = await ehs.api("/visits/visit-demo-pending/exception/approve", {
        method: "POST",
        body: { approverNote: "同意" },
      });
      assert("EHS批准双签", appr.ok && appr.visit.status === "onsite");

      const notes = await driver.api("/notifications");
      assert("通知接口", Array.isArray(notes.items));
      const kpi = await gate2.api("/gate/kpi");
      assert("门岗KPI", typeof kpi.inspecting === "number");

      const archived = await (await asUser("13800000000", "admin123")).api(
        "/visits?plate=沪A&status=completed"
      );
      assert("台账按车牌检索", Array.isArray(archived.items));
    } catch (e) {
      fail("智能编排自检", e.stack || e.message);
    }
  }

  // 8. Bad login
  // 8. Bad login
  try {
    await mockApi("/auth/login", {
      method: "POST",
      body: { phone: "13900000001", password: "wrong" },
    });
    fail("错误密码应失败", "未抛错");
  } catch (e) {
    assert("错误密码应失败", /密码|错误|401/i.test(e.message), e.message);
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
