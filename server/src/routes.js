import express from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "./db.js";
import { evaluateAccess } from "./services/access.js";
import { extractDocument, DOC_TYPE_LABELS } from "./services/ocr.js";
import { audit } from "./services/audit.js";
import {
  getVisitProfile,
  listVisitTypeMeta,
  missingDepartSteps,
  needsWeighOnDepart,
  normalizeSelectedOptions,
  resolveDepartSteps,
} from "./services/visitProfiles.js";

export function createApiRouter({ deviceHub }) {
  const router = express.Router();

  // ---- auth (demo token = user id) ----
  router.post("/auth/login", (req, res) => {
    const { phone, password } = req.body || {};
    const user = db.prepare(`SELECT * FROM users WHERE phone = ?`).get(phone);
    if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
      return res.status(401).json({ error: "手机号或密码错误" });
    }
    const { password_hash, ...safe } = user;
    audit(safe, "login", "user", safe.id, {});
    res.json({ token: safe.id, user: safe });
  });

  router.get("/me", auth, (req, res) => {
    res.json({ user: req.user });
  });

  // ---- meta ----
  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "carrier-gate-safety", ts: new Date().toISOString() });
  });

  router.get("/sites", (_req, res) => {
    res.json({ items: db.prepare(`SELECT * FROM sites`).all() });
  });

  router.get("/meta/doc-types", (_req, res) => {
    res.json({ labels: DOC_TYPE_LABELS });
  });

  router.get("/meta/visit-types", (_req, res) => {
    res.json({ items: listVisitTypeMeta() });
  });

  // ---- dashboard ----
  router.get("/dashboard", auth, (_req, res) => {
    const onsite = db
      .prepare(`SELECT COUNT(*) AS c FROM visits WHERE status = 'onsite'`)
      .get().c;
    const todayAppointed = db
      .prepare(
        `SELECT COUNT(*) AS c FROM visits WHERE date(created_at) = date('now')`
      )
      .get().c;
    const blocked = db
      .prepare(
        `SELECT COUNT(*) AS c FROM visits WHERE status IN ('access_pending','rejected') AND date(created_at) = date('now')`
      )
      .get().c;
    const expiring = db
      .prepare(
        `SELECT COUNT(*) AS c FROM documents
         WHERE status = 'valid' AND expire_at IS NOT NULL
           AND expire_at <= date('now', '+30 days')`
      )
      .get().c;
    const expired = db
      .prepare(
        `SELECT COUNT(*) AS c FROM documents
         WHERE status = 'valid' AND expire_at IS NOT NULL AND expire_at < date('now')`
      )
      .get().c;

    res.json({
      onsite,
      todayAppointed,
      blocked,
      expiring30d: expiring,
      expired,
    });
  });

  // ---- carriers / drivers / vehicles ----
  router.get("/carriers", auth, (_req, res) => {
    res.json({ items: db.prepare(`SELECT * FROM carriers ORDER BY name`).all() });
  });

  router.get("/drivers", auth, (req, res) => {
    const { carrierId } = req.query;
    const items = carrierId
      ? db.prepare(`SELECT * FROM drivers WHERE carrier_id = ?`).all(carrierId)
      : db.prepare(`SELECT * FROM drivers`).all();
    res.json({ items });
  });

  router.get("/vehicles", auth, (req, res) => {
    const { carrierId } = req.query;
    const items = carrierId
      ? db.prepare(`SELECT * FROM vehicles WHERE carrier_id = ?`).all(carrierId)
      : db.prepare(`SELECT * FROM vehicles`).all();
    res.json({ items });
  });

  // ---- documents + OCR ----
  router.get("/documents", auth, (req, res) => {
    const { subjectType, subjectId } = req.query;
    let items;
    if (subjectType && subjectId) {
      items = db
        .prepare(
          `SELECT * FROM documents WHERE subject_type = ? AND subject_id = ? ORDER BY created_at DESC`
        )
        .all(subjectType, subjectId);
    } else {
      items = db
        .prepare(`SELECT * FROM documents ORDER BY expire_at ASC LIMIT 200`)
        .all();
    }
    res.json({
      items: items.map((d) => ({
        ...d,
        ocr: safeJson(d.ocr_json),
        label: DOC_TYPE_LABELS[d.doc_type] || d.doc_type,
      })),
    });
  });

  router.get("/documents/expiring", auth, (req, res) => {
    const days = Number(req.query.days || 30);
    const items = db
      .prepare(
        `SELECT * FROM documents
         WHERE expire_at IS NOT NULL AND expire_at <= date('now', ?)
         ORDER BY expire_at ASC`
      )
      .all(`+${days} days`)
      .map((d) => ({
        ...d,
        ocr: safeJson(d.ocr_json),
        label: DOC_TYPE_LABELS[d.doc_type] || d.doc_type,
        expired: d.expire_at < new Date().toISOString().slice(0, 10),
      }));
    res.json({ items });
  });

  router.post("/documents/ocr", auth, (req, res) => {
    const {
      subjectType,
      subjectId,
      docType,
      hint,
      forceExpireDays,
      confirm = true,
    } = req.body || {};

    if (!subjectType || !subjectId || !docType) {
      return res.status(400).json({ error: "缺少 subjectType/subjectId/docType" });
    }

    const ocr = extractDocument({ docType, hint, forceExpireDays });
    if (!ocr.ok) return res.status(400).json(ocr);

    const now = new Date().toISOString();
    const id = nanoid();
    const status =
      ocr.needsManualReview || !confirm
        ? "pending"
        : ocr.expireAt < now.slice(0, 10)
          ? "expired"
          : "valid";

    db.prepare(
      `INSERT INTO documents
       (id, subject_type, subject_id, doc_type, file_name, ocr_json, expire_at, status, confidence, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      subjectType,
      subjectId,
      docType,
      `${docType}-${id.slice(0, 6)}.jpg`,
      JSON.stringify(ocr),
      ocr.expireAt,
      status,
      ocr.confidence,
      now,
      now
    );

    audit(req.user, "document.ocr", "document", id, { docType, status, expireAt: ocr.expireAt });
    res.json({
      id,
      status,
      ocr,
      label: DOC_TYPE_LABELS[docType] || docType,
    });
  });

  router.post("/documents/:id/confirm", auth, (req, res) => {
    const doc = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(req.params.id);
    if (!doc) return res.status(404).json({ error: "证件不存在" });
    const expireAt = req.body?.expireAt || doc.expire_at;
    const status = expireAt < new Date().toISOString().slice(0, 10) ? "expired" : "valid";
    const ocr = { ...safeJson(doc.ocr_json), fields: { ...(safeJson(doc.ocr_json).fields || {}), ...(req.body?.fields || {}), expireAt }, expireAt };
    db.prepare(
      `UPDATE documents SET expire_at = ?, status = ?, ocr_json = ?, updated_at = ? WHERE id = ?`
    ).run(expireAt, status, JSON.stringify(ocr), new Date().toISOString(), doc.id);
    audit(req.user, "document.confirm", "document", doc.id, { expireAt, status, fields: req.body?.fields });
    res.json({ ok: true, status, expireAt });
  });

  // ---- training ----
  router.get("/training/course", auth, (req, res) => {
    const siteId = req.query.siteId || "site-1";
    const course = db
      .prepare(
        `SELECT * FROM training_courses WHERE site_id = ? AND active = 1 ORDER BY version DESC LIMIT 1`
      )
      .get(siteId);
    if (!course) return res.status(404).json({ error: "无课程" });
    const questions = db
      .prepare(`SELECT id, stem, options_json FROM quiz_questions WHERE course_id = ?`)
      .all(course.id)
      .map((q) => ({ id: q.id, stem: q.stem, options: JSON.parse(q.options_json) }));
    res.json({ course, questions });
  });

  router.get("/training/status", auth, (req, res) => {
    const driverId = req.query.driverId || req.user.driver_id;
    const siteId = req.query.siteId || "site-1";
    if (!driverId) return res.status(400).json({ error: "缺少 driverId" });
    const course = db
      .prepare(
        `SELECT * FROM training_courses WHERE site_id = ? AND active = 1 ORDER BY version DESC LIMIT 1`
      )
      .get(siteId);
    if (!course) return res.json({ passed: false, record: null });
    const record = db
      .prepare(
        `SELECT * FROM training_records WHERE driver_id = ? AND course_id = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(driverId, course.id);
    const today = new Date().toISOString().slice(0, 10);
    const passed = !!(
      record &&
      record.quiz_passed &&
      record.valid_until &&
      record.valid_until >= today
    );
    res.json({ passed, record, course });
  });

  router.post("/training/progress", auth, (req, res) => {
    const driverId = req.body.driverId || req.user.driver_id;
    const siteId = req.body.siteId || "site-1";
    const watchedSeconds = Number(req.body.watchedSeconds || 0);
    const course = db
      .prepare(
        `SELECT * FROM training_courses WHERE site_id = ? AND active = 1 ORDER BY version DESC LIMIT 1`
      )
      .get(siteId);
    if (!course || !driverId) return res.status(400).json({ error: "参数错误" });

    let record = db
      .prepare(
        `SELECT * FROM training_records WHERE driver_id = ? AND course_id = ? AND quiz_passed = 0 ORDER BY created_at DESC LIMIT 1`
      )
      .get(driverId, course.id);

    const now = new Date().toISOString();
    const completed = watchedSeconds >= course.min_watch_seconds ? 1 : 0;

    if (!record) {
      const id = nanoid();
      db.prepare(
        `INSERT INTO training_records
         (id, driver_id, course_id, site_id, watched_seconds, video_completed, quiz_score, quiz_passed, valid_until, completed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, 0, NULL, NULL, ?)`
      ).run(id, driverId, course.id, siteId, watchedSeconds, completed, now);
      record = db.prepare(`SELECT * FROM training_records WHERE id = ?`).get(id);
    } else {
      db.prepare(
        `UPDATE training_records SET watched_seconds = ?, video_completed = ? WHERE id = ?`
      ).run(Math.max(record.watched_seconds, watchedSeconds), completed, record.id);
      record = db.prepare(`SELECT * FROM training_records WHERE id = ?`).get(record.id);
    }

    res.json({ record, minWatchSeconds: course.min_watch_seconds });
  });

  router.post("/training/quiz", auth, (req, res) => {
    const driverId = req.body.driverId || req.user.driver_id;
    const siteId = req.body.siteId || "site-1";
    const answers = req.body.answers || {};
    const course = db
      .prepare(
        `SELECT * FROM training_courses WHERE site_id = ? AND active = 1 ORDER BY version DESC LIMIT 1`
      )
      .get(siteId);
    if (!course || !driverId) return res.status(400).json({ error: "参数错误" });

    let record = db
      .prepare(
        `SELECT * FROM training_records WHERE driver_id = ? AND course_id = ? ORDER BY created_at DESC LIMIT 1`
      )
      .get(driverId, course.id);

    if (!record || !record.video_completed) {
      return res.status(400).json({ error: "请先完成安全培训视频观看" });
    }

    const questions = db
      .prepare(`SELECT * FROM quiz_questions WHERE course_id = ?`)
      .all(course.id);
    let correct = 0;
    const detail = [];
    for (const q of questions) {
      const ans = answers[q.id];
      const ok = Number(ans) === q.answer_index;
      if (ok) correct += 1;
      detail.push({ id: q.id, correct: ok });
    }
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= course.pass_score ? 1 : 0;
    const now = new Date().toISOString();
    let validUntil = null;
    if (passed) {
      const d = new Date();
      d.setDate(d.getDate() + course.valid_days);
      validUntil = d.toISOString().slice(0, 10);
    }

    db.prepare(
      `UPDATE training_records SET quiz_score = ?, quiz_passed = ?, valid_until = ?, completed_at = ? WHERE id = ?`
    ).run(score, passed, validUntil, passed ? now : null, record.id);

    audit(req.user, "training.quiz", "training_record", record.id, { score, passed: !!passed });
    res.json({ score, passed: !!passed, passScore: course.pass_score, validUntil, detail });
  });

  // ---- access evaluate ----
  router.post("/access/evaluate", auth, (req, res) => {
    const { siteId = "site-1", driverId, vehicleId, carrierId } = req.body || {};
    if (!driverId || !vehicleId || !carrierId) {
      return res.status(400).json({ error: "缺少 driverId/vehicleId/carrierId" });
    }
    res.json(evaluateAccess({ siteId, driverId, vehicleId, carrierId }));
  });

  // ---- visits state machine ----
  router.get("/visits", auth, (req, res) => {
    const { status } = req.query;
    let items;
    if (status) {
      items = db
        .prepare(
          `SELECT v.*, d.name AS driver_name, d.phone AS driver_phone, vh.plate_no, c.name AS carrier_name
           FROM visits v
           JOIN drivers d ON d.id = v.driver_id
           JOIN vehicles vh ON vh.id = v.vehicle_id
           JOIN carriers c ON c.id = v.carrier_id
           WHERE v.status = ?
           ORDER BY v.updated_at DESC`
        )
        .all(status);
    } else {
      items = db
        .prepare(
          `SELECT v.*, d.name AS driver_name, d.phone AS driver_phone, vh.plate_no, c.name AS carrier_name
           FROM visits v
           JOIN drivers d ON d.id = v.driver_id
           JOIN vehicles vh ON vh.id = v.vehicle_id
           JOIN carriers c ON c.id = v.carrier_id
           ORDER BY v.updated_at DESC LIMIT 100`
        )
        .all();
    }
    res.json({
      items: items.map((v) => enrichVisit(v)),
    });
  });

  router.get("/visits/:id", auth, (req, res) => {
    const v = getVisit(req.params.id);
    if (!v) return res.status(404).json({ error: "到访单不存在" });
    const selectedOptions = safeJson(v.selected_options) || [];
    const access = evaluateAccess({
      siteId: v.site_id,
      driverId: v.driver_id,
      vehicleId: v.vehicle_id,
      carrierId: v.carrier_id,
      visitType: v.visit_type || "carrier",
      selectedOptions,
    });
    res.json({
      visit: enrichVisit(v),
      access,
      departSteps: resolveDepartSteps(v.visit_type || "carrier", selectedOptions),
      inspectChecklist: getVisitProfile(v.visit_type || "carrier").inspectChecklist,
    });
  });

  router.post("/visits", auth, (req, res) => {
    const {
      siteId = "site-1",
      carrierId,
      driverId,
      vehicleId,
      appointmentAt,
      visitType = "carrier",
      selectedOptions = [],
      customerName,
      customerPhone,
      pickupRef,
    } = req.body || {};

    const type = visitType === "self_pickup" ? "self_pickup" : "carrier";
    const options = normalizeSelectedOptions(type, selectedOptions);

    let cid = carrierId;
    let did = driverId;
    let vid = vehicleId;

    if (type === "self_pickup") {
      if (!customerName || !pickupRef) {
        return res.status(400).json({ error: "自提须填写提货人姓名与提货单号" });
      }
      cid = cid || "carrier-self";
      did = did || req.user.driver_id || "driver-pickup";
      vid = vid || "veh-pickup";
    } else if (!cid || !did || !vid) {
      return res.status(400).json({ error: "缺少承运商/司机/车辆" });
    }

    const now = new Date().toISOString();
    const id = nanoid();
    db.prepare(
      `INSERT INTO visits
       (id, site_id, carrier_id, driver_id, vehicle_id, appointment_at, status, block_reasons,
        visit_type, selected_options, customer_name, customer_phone, pickup_ref, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'appointed', NULL, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      siteId,
      cid,
      did,
      vid,
      appointmentAt || now,
      type,
      JSON.stringify(options),
      customerName || null,
      customerPhone || null,
      pickupRef || null,
      now,
      now
    );
    audit(req.user, "visit.create", "visit", id, { visitType: type, options, pickupRef });
    res.json({ visit: enrichVisit(getVisit(id)) });
  });

  router.post("/visits/:id/checkin", auth, (req, res) => {
    const v = getVisit(req.params.id);
    if (!v) return res.status(404).json({ error: "不存在" });
    if (!["appointed", "access_pending"].includes(v.status)) {
      return res.status(400).json({ error: `当前状态不可报到: ${v.status}` });
    }
    const selectedOptions = safeJson(v.selected_options) || [];
    const access = evaluateAccess({
      siteId: v.site_id,
      driverId: v.driver_id,
      vehicleId: v.vehicle_id,
      carrierId: v.carrier_id,
      visitType: v.visit_type || "carrier",
      selectedOptions,
    });
    const now = new Date().toISOString();
    if (!access.allowed) {
      db.prepare(
        `UPDATE visits SET status = 'access_pending', checkin_at = ?, block_reasons = ?, updated_at = ? WHERE id = ?`
      ).run(now, JSON.stringify(access.reasons), now, v.id);
      audit(req.user, "visit.checkin_blocked", "visit", v.id, access.reasons);
      return res.json({
        ok: false,
        visit: enrichVisit(getVisit(v.id)),
        access,
        message: "准入未通过，请先完成培训/证件",
      });
    }
    db.prepare(
      `UPDATE visits SET status = 'inspecting', checkin_at = ?, admitted_at = ?, block_reasons = NULL, updated_at = ? WHERE id = ?`
    ).run(now, now, now, v.id);
    audit(req.user, "visit.checkin_ok", "visit", v.id, { visitType: v.visit_type });
    res.json({ ok: true, visit: enrichVisit(getVisit(v.id)), access });
  });

  router.post("/visits/:id/inspect", auth, role("gate", "ehs", "admin"), async (req, res) => {
    const v = getVisit(req.params.id);
    if (!v) return res.status(404).json({ error: "不存在" });
    if (v.status !== "inspecting") {
      return res.status(400).json({ error: `当前状态不可安检: ${v.status}` });
    }
    const profile = getVisitProfile(v.visit_type || "carrier");
    const checklist = req.body?.checklist || {};
    const requiredKeys = profile.inspectChecklist.map((c) => c.key);
    const pass =
      req.body?.pass !== false &&
      requiredKeys.every((k) => checklist[k] === true);
    const now = new Date().toISOString();
    if (!pass) {
      db.prepare(
        `UPDATE visits SET status = 'rejected', inspection_json = ?, updated_at = ? WHERE id = ?`
      ).run(JSON.stringify({ checklist, pass: false, at: now }), now, v.id);
      audit(req.user, "visit.inspect_fail", "visit", v.id, checklist);
      return res.json({ ok: false, visit: enrichVisit(getVisit(v.id)) });
    }

    db.prepare(
      `UPDATE visits SET status = 'onsite', inspection_json = ?, onsite_at = ?, updated_at = ? WHERE id = ?`
    ).run(JSON.stringify({ checklist, pass: true, at: now }), now, now, v.id);

    let deviceResult = null;
    try {
      deviceResult = await deviceHub.openBarrier("barrier-in-1", {
        visitId: v.id,
        direction: "in",
        reason: "inspect_pass",
      });
      await deviceHub.snapshot("cam-gate-1", { visitId: v.id });
    } catch (e) {
      deviceResult = { ok: false, error: String(e.message || e), note: "设备预留层失败，业务状态已入场" };
    }

    audit(req.user, "visit.admit", "visit", v.id, { deviceResult, visitType: v.visit_type });
    res.json({ ok: true, visit: enrichVisit(getVisit(v.id)), deviceResult });
  });

  router.post("/visits/:id/depart", auth, async (req, res) => {
    const v = getVisit(req.params.id);
    if (!v) return res.status(404).json({ error: "不存在" });
    if (!["onsite", "departing"].includes(v.status)) {
      return res.status(400).json({ error: `当前状态不可离场: ${v.status}` });
    }

    const visitType = v.visit_type || "carrier";
    const selectedOptions = safeJson(v.selected_options) || [];
    const { required, missing, steps } = missingDepartSteps(visitType, selectedOptions, {
      ...(req.body || {}),
      ...(req.body?.steps || {}),
    });
    const now = new Date().toISOString();

    if (missing.length) {
      db.prepare(
        `UPDATE visits SET status = 'departing', departure_json = ?, updated_at = ? WHERE id = ?`
      ).run(JSON.stringify({ steps, missing, required, at: now }), now, v.id);
      return res.json({
        ok: false,
        missing,
        required,
        visit: enrichVisit(getVisit(v.id)),
        message: "离场收口未完成（含已勾选的可选步骤）",
      });
    }

    let weight = null;
    if (needsWeighOnDepart(visitType, selectedOptions)) {
      try {
        weight = await deviceHub.readWeight("scale-1");
      } catch {
        weight = null;
      }
    }

    db.prepare(
      `UPDATE visits SET status = 'completed', departure_json = ?, checkout_at = ?, updated_at = ? WHERE id = ?`
    ).run(JSON.stringify({ steps, weight, selectedOptions, at: now }), now, now, v.id);

    let deviceResult = null;
    try {
      deviceResult = await deviceHub.openBarrier("barrier-out-1", {
        visitId: v.id,
        direction: "out",
        reason: "depart_complete",
      });
    } catch (e) {
      deviceResult = { ok: false, error: String(e.message || e) };
    }

    audit(req.user, "visit.depart", "visit", v.id, { steps, weight, deviceResult, visitType });
    res.json({ ok: true, visit: enrichVisit(getVisit(v.id)), deviceResult, weight });
  });
  router.post("/visits/:id/exception", auth, role("gate", "ehs", "admin"), async (req, res) => {
    const v = getVisit(req.params.id);
    if (!v) return res.status(404).json({ error: "不存在" });
    const { reason, approverNote } = req.body || {};
    if (!reason) return res.status(400).json({ error: "须填写例外原因" });
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE visits SET status = 'onsite', exception_note = ?, onsite_at = ?, updated_at = ? WHERE id = ?`
    ).run(JSON.stringify({ reason, approverNote, by: req.user.name, at: now }), now, now, v.id);
    let deviceResult = null;
    try {
      deviceResult = await deviceHub.openBarrier("barrier-in-1", {
        visitId: v.id,
        direction: "in",
        reason: `exception:${reason}`,
      });
    } catch (e) {
      deviceResult = { ok: false, error: String(e.message || e) };
    }
    audit(req.user, "visit.exception", "visit", v.id, { reason, approverNote, deviceResult });
    res.json({ ok: true, visit: enrichVisit(getVisit(v.id)), deviceResult });
  });

  // ---- devices ----
  router.get("/devices", auth, async (_req, res) => {
    const status = await deviceHub.statusAll();
    res.json({
      mode: "mock",
      items: status,
      note: "生产环境在 server/src/devices/adapters/ 实现厂商适配并 register 到 DeviceHub",
    });
  });

  router.post("/devices/:id/execute", auth, role("gate", "ehs", "admin"), async (req, res) => {
    try {
      const result = await deviceHub.get(req.params.id).execute(req.body?.cmd || "ping", req.body?.params || {});
      audit(req.user, "device.execute", "device", req.params.id, { cmd: req.body?.cmd, result });
      res.json({ result });
    } catch (e) {
      res.status(400).json({ error: String(e.message || e) });
    }
  });

  router.post("/devices/lpr/simulate", auth, role("gate", "admin"), async (req, res) => {
    const plateNo = req.body?.plateNo;
    await deviceHub.get("lpr-gate-1").execute("set_demo_plate", { plateNo });
    const captured = await deviceHub.capturePlate("lpr-gate-1");
    const vehicle = db.prepare(`SELECT * FROM vehicles WHERE plate_no = ?`).get(captured.plateNo);
    res.json({ captured, vehicle: vehicle || null });
  });

  // ---- audit ----
  router.get("/audit", auth, role("admin", "ehs"), (req, res) => {
    const items = db
      .prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200`)
      .all()
      .map((a) => ({ ...a, detail: safeJson(a.detail_json) }));
    res.json({ items });
  });

  router.get("/device-events", auth, role("admin", "ehs", "gate"), (_req, res) => {
    const items = db
      .prepare(`SELECT * FROM device_events ORDER BY created_at DESC LIMIT 100`)
      .all()
      .map((e) => ({ ...e, payload: safeJson(e.payload_json) }));
    res.json({ items });
  });

  return router;
}

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "未登录" });
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(token);
  if (!user) return res.status(401).json({ error: "登录失效" });
  const { password_hash, ...safe } = user;
  req.user = safe;
  next();
}

function role(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "未登录" });
    if (!roles.includes(req.user.role) && req.user.role !== "admin") {
      return res.status(403).json({ error: "无权限" });
    }
    next();
  };
}

function safeJson(s) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getVisit(id) {
  return db
    .prepare(
      `SELECT v.*, d.name AS driver_name, d.phone AS driver_phone, vh.plate_no, c.name AS carrier_name
       FROM visits v
       JOIN drivers d ON d.id = v.driver_id
       JOIN vehicles vh ON vh.id = v.vehicle_id
       JOIN carriers c ON c.id = v.carrier_id
       WHERE v.id = ?`
    )
    .get(id);
}

function enrichVisit(v) {
  if (!v) return null;
  const selectedOptions = safeJson(v.selected_options) || [];
  const visitType = v.visit_type || "carrier";
  return {
    ...v,
    visit_type: visitType,
    visit_type_label: getVisitProfile(visitType).label,
    selected_options: selectedOptions,
    block_reasons: safeJson(v.block_reasons),
    inspection: safeJson(v.inspection_json),
    departure: safeJson(v.departure_json),
    exception: safeJson(v.exception_note),
    depart_steps: resolveDepartSteps(visitType, selectedOptions),
  };
}
