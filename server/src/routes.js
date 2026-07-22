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
  normalizeVisitType,
  resolveDepartSteps,
} from "./services/visitProfiles.js";
import {
  assertSlotAvailable,
  dualApproveEnabled,
  dwellMinutes,
  dwellWarnMinutes,
  isDwellOver,
  listSlotsForDay,
  makeArchiveKey,
  makePassCode,
  notifyWarehouseStub,
  slotCapacity,
} from "./services/yardOps.js";

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

  router.get("/meta/slots", auth, (req, res) => {
    const day = req.query.day || new Date().toISOString().slice(0, 10);
    res.json({
      day,
      capacity: slotCapacity(),
      items: listSlotsForDay(day),
    });
  });

  router.get("/meta/yard-config", auth, (_req, res) => {
    res.json({
      slotCapacity: slotCapacity(),
      dwellWarnMinutes: dwellWarnMinutes(),
      dualApprove: dualApproveEnabled(),
    });
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
    const exceptionRequested = db
      .prepare(`SELECT COUNT(*) AS c FROM visits WHERE status = 'exception_requested'`)
      .get().c;
    const inspecting = db
      .prepare(`SELECT COUNT(*) AS c FROM visits WHERE status = 'inspecting'`)
      .get().c;
    const accessPending = db
      .prepare(`SELECT COUNT(*) AS c FROM visits WHERE status = 'access_pending'`)
      .get().c;
    const releasedToday = db
      .prepare(
        `SELECT COUNT(*) AS c FROM visits
         WHERE status IN ('onsite','departing','completed')
           AND date(onsite_at) = date('now')`
      )
      .get().c;
    const onsiteRows = db
      .prepare(`SELECT onsite_at FROM visits WHERE status = 'onsite'`)
      .all();
    const dwellOver = onsiteRows.filter((r) => isDwellOver(r.onsite_at)).length;

    res.json({
      onsite,
      todayAppointed,
      blocked,
      expiring30d: expiring,
      expired,
      exceptionRequested,
      inspecting,
      accessPending,
      releasedToday,
      dwellOver,
      dwellWarnMinutes: dwellWarnMinutes(),
    });
  });

  router.get("/gate/kpi", auth, role("gate", "ehs", "admin"), (_req, res) => {
    const inspecting = db
      .prepare(`SELECT COUNT(*) AS c FROM visits WHERE status = 'inspecting'`)
      .get().c;
    const accessPending = db
      .prepare(`SELECT COUNT(*) AS c FROM visits WHERE status = 'access_pending'`)
      .get().c;
    const exceptionRequested = db
      .prepare(`SELECT COUNT(*) AS c FROM visits WHERE status = 'exception_requested'`)
      .get().c;
    const onsiteRows = db
      .prepare(`SELECT onsite_at FROM visits WHERE status = 'onsite'`)
      .all();
    const dwellOver = onsiteRows.filter((r) => isDwellOver(r.onsite_at)).length;
    const releasedToday = db
      .prepare(
        `SELECT COUNT(*) AS c FROM visits
         WHERE status IN ('onsite','departing','completed')
           AND date(COALESCE(onsite_at, admitted_at)) = date('now')`
      )
      .get().c;
    res.json({
      inspecting,
      accessPending,
      exceptionRequested,
      dwellOver,
      releasedToday,
      dwellWarnMinutes: dwellWarnMinutes(),
    });
  });

  router.get("/notifications", auth, (req, res) => {
    const items = [];
    const user = req.user;
    if (user.role === "driver" && user.driver_id) {
      const st = db
        .prepare(
          `SELECT tr.*, c.valid_days FROM training_records tr
           JOIN training_courses c ON c.id = tr.course_id
           WHERE tr.driver_id = ? AND tr.quiz_passed = 1
           ORDER BY tr.created_at DESC LIMIT 1`
        )
        .get(user.driver_id);
      if (!st) {
        items.push({
          id: "train-required",
          level: "high",
          title: "须完成安全培训",
          body: "首次到场或培训失效，请先完成视频与答题。",
          to: "/driver/training",
        });
      } else if (st.valid_until) {
        const days = Math.ceil(
          (new Date(st.valid_until).getTime() - Date.now()) / 86400000
        );
        if (days <= 30) {
          items.push({
            id: "train-expiring",
            level: days <= 7 ? "high" : "medium",
            title: "培训即将到期",
            body: `有效至 ${st.valid_until}（剩 ${days} 天）`,
            to: "/driver/training",
          });
        }
      }

      const pending = db
        .prepare(
          `SELECT * FROM visits WHERE driver_id = ? AND status = 'access_pending'
           ORDER BY updated_at DESC LIMIT 1`
        )
        .get(user.driver_id);
      if (pending) {
        const reasons = safeJson(pending.block_reasons) || [];
        items.push({
          id: `block-${pending.id}`,
          level: "high",
          title: "报到被拦截",
          body: reasons[0]?.message || "请补齐培训或证件后重新报到",
          to: "/driver/visit",
        });
      }

      const inspecting = db
        .prepare(
          `SELECT * FROM visits WHERE driver_id = ? AND status = 'inspecting'
           ORDER BY updated_at DESC LIMIT 1`
        )
        .get(user.driver_id);
      if (inspecting) {
        items.push({
          id: `ready-${inspecting.id}`,
          level: "low",
          title: "可入场 · 出示通行码",
          body: inspecting.pass_code
            ? `通行码 ${inspecting.pass_code}，请驶至门岗安检`
            : "请驶至门岗完成安检",
          to: "/driver/visit",
        });
      }

      const onsite = db
        .prepare(
          `SELECT * FROM visits WHERE driver_id = ? AND status IN ('onsite','departing')
           ORDER BY updated_at DESC LIMIT 1`
        )
        .get(user.driver_id);
      if (onsite && isDwellOver(onsite.onsite_at)) {
        items.push({
          id: `dwell-${onsite.id}`,
          level: "medium",
          title: "在场超时催离",
          body: `已停留 ${dwellMinutes(onsite.onsite_at)} 分钟，请尽快完成离场收口`,
          to: "/driver/visit",
        });
      }
    }

    if (user.role === "ehs" || user.role === "admin") {
      const n = db
        .prepare(`SELECT COUNT(*) AS c FROM visits WHERE status = 'exception_requested'`)
        .get().c;
      if (n > 0) {
        items.push({
          id: "dual-pending",
          level: "high",
          title: "待双签例外",
          body: `${n} 单等待 EHS/管理员批准`,
          to: "/admin",
        });
      }
    }

    res.json({ items });
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
    const {
      siteId = "site-1",
      driverId,
      vehicleId,
      carrierId,
      visitType,
      selectedOptions,
    } = req.body || {};
    if (!driverId || !vehicleId || !carrierId) {
      return res.status(400).json({ error: "缺少 driverId/vehicleId/carrierId" });
    }
    res.json(
      evaluateAccess({
        siteId,
        driverId,
        vehicleId,
        carrierId,
        visitType,
        selectedOptions,
      })
    );
  });

  // ---- visits state machine ----
  router.get("/visits", auth, (req, res) => {
    const { status, passCode, type, plate, pickupRef, from, to, archiveKey } = req.query;
    if (passCode) {
      const v = db
        .prepare(
          `SELECT v.*, d.name AS driver_name, d.phone AS driver_phone, vh.plate_no, c.name AS carrier_name
           FROM visits v
           JOIN drivers d ON d.id = v.driver_id
           JOIN vehicles vh ON vh.id = v.vehicle_id
           JOIN carriers c ON c.id = v.carrier_id
           WHERE upper(v.pass_code) = upper(?)`
        )
        .get(String(passCode).trim());
      if (!v) return res.status(404).json({ error: "未找到通行码对应单据" });
      return res.json({ items: [enrichVisit(v)], visit: enrichVisit(v) });
    }

    let sql = `SELECT v.*, d.name AS driver_name, d.phone AS driver_phone, vh.plate_no, c.name AS carrier_name
       FROM visits v
       JOIN drivers d ON d.id = v.driver_id
       JOIN vehicles vh ON vh.id = v.vehicle_id
       JOIN carriers c ON c.id = v.carrier_id
       WHERE 1=1`;
    const params = [];
    if (status) {
      const statuses = String(status)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (statuses.length === 1) {
        sql += ` AND v.status = ?`;
        params.push(statuses[0]);
      } else if (statuses.length > 1) {
        sql += ` AND v.status IN (${statuses.map(() => "?").join(",")})`;
        params.push(...statuses);
      }
    }
    if (type) {
      const t = normalizeVisitType(type);
      if (t === "carrier_inbound") {
        sql += ` AND (v.visit_type = ? OR v.visit_type = 'carrier')`;
        params.push(t);
      } else {
        sql += ` AND v.visit_type = ?`;
        params.push(t);
      }
    }
    if (plate) {
      sql += ` AND vh.plate_no LIKE ?`;
      params.push(`%${String(plate).trim()}%`);
    }
    if (pickupRef) {
      sql += ` AND v.pickup_ref LIKE ?`;
      params.push(`%${String(pickupRef).trim()}%`);
    }
    if (archiveKey) {
      sql += ` AND v.archive_key LIKE ?`;
      params.push(`%${String(archiveKey).trim()}%`);
    }
    if (from) {
      sql += ` AND v.updated_at >= ?`;
      params.push(String(from));
    }
    if (to) {
      sql += ` AND v.updated_at <= ?`;
      params.push(String(to));
    }
    sql += ` ORDER BY COALESCE(v.risk_score, 0) DESC, v.updated_at DESC LIMIT 200`;
    const items = db.prepare(sql).all(...params);
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
      pickupRef: v.pickup_ref || "",
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
      slotStart,
      slotEnd,
    } = req.body || {};

    const type = normalizeVisitType(visitType);
    const options = normalizeSelectedOptions(type, selectedOptions);

    let cid = carrierId;
    let did = driverId;
    let vid = vehicleId;

    if (type === "self_pickup") {
      if (!customerName || !pickupRef) {
        return res.status(400).json({ error: "自提须填写提货人姓名与提货单号(DN)" });
      }
      cid = cid || "carrier-self";
      did = did || req.user.driver_id || "driver-pickup";
      vid = vid || "veh-pickup";
    } else if (!cid || !did || !vid) {
      return res.status(400).json({ error: "缺少承运商/司机/车辆" });
    }

    try {
      assertSlotAvailable(slotStart, slotEnd);
    } catch (e) {
      return res.status(e.status || 400).json({ error: e.message });
    }

    const preAccess = evaluateAccess({
      siteId,
      driverId: did,
      vehicleId: vid,
      carrierId: cid,
      visitType: type,
      selectedOptions: options,
    });

    const now = new Date().toISOString();
    const id = nanoid();
    db.prepare(
      `INSERT INTO visits
       (id, site_id, carrier_id, driver_id, vehicle_id, appointment_at, status, block_reasons,
        visit_type, selected_options, customer_name, customer_phone, pickup_ref,
        slot_start, slot_end, risk_score, risk_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'appointed', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      siteId,
      cid,
      did,
      vid,
      slotStart || appointmentAt || now,
      type,
      JSON.stringify(options),
      customerName || null,
      customerPhone || null,
      pickupRef || null,
      slotStart,
      slotEnd,
      preAccess.riskScore ?? null,
      preAccess.riskLevel ?? null,
      now,
      now
    );
    audit(req.user, "visit.create", "visit", id, {
      visitType: type,
      options,
      pickupRef,
      slotStart,
      riskScore: preAccess.riskScore,
    });
    res.json({ visit: enrichVisit(getVisit(id)), access: preAccess });
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
    const passCode = v.pass_code || makePassCode();
    if (!access.allowed) {
      db.prepare(
        `UPDATE visits SET status = 'access_pending', checkin_at = ?, block_reasons = ?,
         pass_code = ?, risk_score = ?, risk_level = ?, updated_at = ? WHERE id = ?`
      ).run(
        now,
        JSON.stringify(access.reasons),
        passCode,
        access.riskScore ?? null,
        access.riskLevel ?? null,
        now,
        v.id
      );
      audit(req.user, "visit.checkin_blocked", "visit", v.id, access.reasons);
      return res.json({
        ok: false,
        visit: enrichVisit(getVisit(v.id)),
        access,
        message: "准入未通过，请先完成培训/证件",
      });
    }
    db.prepare(
      `UPDATE visits SET status = 'inspecting', checkin_at = ?, admitted_at = ?, block_reasons = NULL,
       pass_code = ?, risk_score = ?, risk_level = ?, updated_at = ? WHERE id = ?`
    ).run(
      now,
      now,
      passCode,
      access.riskScore ?? null,
      access.riskLevel ?? null,
      now,
      v.id
    );
    audit(req.user, "visit.checkin_ok", "visit", v.id, {
      visitType: v.visit_type,
      passCode,
      riskScore: access.riskScore,
    });
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
    const checkedAt = Object.fromEntries(
      Object.keys(checklist).map((k) => [k, checklist[k] ? now : null])
    );

    let snapshot = null;
    try {
      snapshot = await deviceHub.snapshot("cam-gate-1", { visitId: v.id });
    } catch {
      snapshot = { ok: true, mock: true, url: `mock://snap/${v.id}`, at: now };
    }

    const evidence = {
      checklist,
      checkedAt,
      pass,
      at: now,
      by: req.user.name,
      snapshot,
      riskScore: v.risk_score,
      riskLevel: v.risk_level,
    };

    if (!pass) {
      db.prepare(
        `UPDATE visits SET status = 'rejected', inspection_json = ?, updated_at = ? WHERE id = ?`
      ).run(JSON.stringify(evidence), now, v.id);
      audit(req.user, "visit.inspect_fail", "visit", v.id, evidence);
      return res.json({ ok: false, visit: enrichVisit(getVisit(v.id)) });
    }

    db.prepare(
      `UPDATE visits SET status = 'onsite', inspection_json = ?, onsite_at = ?, updated_at = ? WHERE id = ?`
    ).run(JSON.stringify(evidence), now, now, v.id);

    let deviceResult = null;
    try {
      deviceResult = await deviceHub.openBarrier("barrier-in-1", {
        visitId: v.id,
        direction: "in",
        reason: "inspect_pass",
      });
    } catch (e) {
      deviceResult = { ok: false, error: String(e.message || e), note: "设备预留层失败，业务状态已入场" };
    }

    audit(req.user, "visit.admit", "visit", v.id, { deviceResult, visitType: v.visit_type, evidence });
    res.json({ ok: true, visit: enrichVisit(getVisit(v.id)), deviceResult, evidence });
  });

  router.post("/visits/:id/depart", auth, async (req, res) => {
    const v = getVisit(req.params.id);
    if (!v) return res.status(404).json({ error: "不存在" });
    if (!["onsite", "departing"].includes(v.status)) {
      return res.status(400).json({ error: `当前状态不可离场: ${v.status}` });
    }

    const visitType = normalizeVisitType(v.visit_type || "carrier");
    const selectedOptions = safeJson(v.selected_options) || [];
    const { required, missing, steps } = missingDepartSteps(visitType, selectedOptions, {
      ...(req.body || {}),
      ...(req.body?.steps || {}),
    });
    const now = new Date().toISOString();
    const prev = safeJson(v.departure_json) || {};

    if (missing.length) {
      db.prepare(
        `UPDATE visits SET status = 'departing', departure_json = ?, updated_at = ? WHERE id = ?`
      ).run(
        JSON.stringify({
          ...prev,
          steps,
          missing,
          required,
          signs: prev.signs || { driver: null, gate: null },
          at: now,
        }),
        now,
        v.id
      );
      return res.json({
        ok: false,
        missing,
        required,
        visit: enrichVisit(getVisit(v.id)),
        message: "作业完成/离场检查未完成（含已勾选的可选步骤）",
      });
    }

    let weight = prev.weight || null;
    if (needsWeighOnDepart(visitType, selectedOptions) && !weight) {
      try {
        weight = await deviceHub.readWeight("scale-1");
      } catch {
        weight = null;
      }
    }

    const departure = {
      ...prev,
      steps,
      missing: [],
      required,
      weight,
      selectedOptions,
      readyForSign: true,
      signs: prev.signs || { driver: null, gate: null },
      at: now,
      preparedBy: req.user.name,
    };

    db.prepare(
      `UPDATE visits SET status = 'departing', departure_json = ?, updated_at = ? WHERE id = ?`
    ).run(JSON.stringify(departure), now, v.id);

    audit(req.user, "visit.depart_prepare", "visit", v.id, { steps, visitType });
    res.json({
      ok: true,
      pendingCheckout: true,
      visit: enrichVisit(getVisit(v.id)),
      weight,
      message: "作业与离场检查已完成，请司机与门岗双签后扫码放行",
    });
  });

  router.post("/visits/:id/checkout/sign", auth, (req, res) => {
    const v = getVisit(req.params.id);
    if (!v) return res.status(404).json({ error: "不存在" });
    if (v.status !== "departing") {
      return res.status(400).json({ error: `当前状态不可签退: ${v.status}` });
    }
    const dep = safeJson(v.departure_json) || {};
    if (!dep.readyForSign) {
      return res.status(400).json({ error: "请先完成作业/离场检查步骤" });
    }
    const roleName = req.body?.role || (req.user.role === "gate" ? "gate" : "driver");
    if (!["driver", "gate"].includes(roleName)) {
      return res.status(400).json({ error: "role 须为 driver 或 gate" });
    }
    if (roleName === "gate" && !["gate", "ehs", "admin"].includes(req.user.role)) {
      return res.status(403).json({ error: "仅门岗可签退门岗端" });
    }
    const now = new Date().toISOString();
    const signs = { ...(dep.signs || { driver: null, gate: null }) };
    signs[roleName] = {
      name: req.body?.name || req.user.name,
      at: now,
      byId: req.user.id,
      device: req.body?.device || "mobile",
    };
    const departure = { ...dep, signs, at: now };
    db.prepare(`UPDATE visits SET departure_json = ?, updated_at = ? WHERE id = ?`).run(
      JSON.stringify(departure),
      now,
      v.id
    );
    audit(req.user, "visit.checkout_sign", "visit", v.id, { role: roleName });
    res.json({
      ok: true,
      visit: enrichVisit(getVisit(v.id)),
      bothSigned: !!(signs.driver && signs.gate),
      message: signs.driver && signs.gate ? "双签完成，门岗可扫码确认离场" : `${roleName === "driver" ? "司机" : "门岗"}已签退`,
    });
  });

  router.post("/visits/:id/checkout/confirm", auth, role("gate", "ehs", "admin"), async (req, res) => {
    const v = getVisit(req.params.id);
    if (!v) return res.status(404).json({ error: "不存在" });
    if (v.status !== "departing") {
      return res.status(400).json({ error: `当前状态不可确认离场: ${v.status}` });
    }
    const dep = safeJson(v.departure_json) || {};
    if (!dep.readyForSign || !dep.signs?.driver || !dep.signs?.gate) {
      return res.status(400).json({ error: "须司机与门岗双方签退后才能开闸离场" });
    }
    const code = (req.body?.passCode || "").trim();
    if (code && v.pass_code && code.toUpperCase() !== String(v.pass_code).toUpperCase()) {
      return res.status(400).json({ error: "通行码不匹配" });
    }
    const now = new Date().toISOString();
    const archiveKey = makeArchiveKey(v.plate_no, now);
    const notify = notifyWarehouseStub({
      archiveKey,
      visitType: normalizeVisitType(v.visit_type),
      pickupRef: v.pickup_ref,
      plateNo: v.plate_no,
      visitId: v.id,
    });
    const departure = {
      ...dep,
      confirmedBy: req.user.name,
      confirmedAt: now,
      archiveKey,
      notify,
      at: now,
    };
    db.prepare(
      `UPDATE visits SET status = 'completed', departure_json = ?, checkout_at = ?, archive_key = ?, updated_at = ? WHERE id = ?`
    ).run(JSON.stringify(departure), now, archiveKey, now, v.id);

    let deviceResult = null;
    try {
      deviceResult = await deviceHub.openBarrier("barrier-out-1", {
        visitId: v.id,
        direction: "out",
        reason: "checkout_dual_sign",
      });
    } catch (e) {
      deviceResult = { ok: false, error: String(e.message || e) };
    }

    audit(req.user, "visit.checkout_confirm", "visit", v.id, {
      archiveKey,
      notify,
      deviceResult,
    });
    res.json({
      ok: true,
      visit: enrichVisit(getVisit(v.id)),
      deviceResult,
      archiveKey,
      notify,
      message: `离场闭环完成 · 归档 ${archiveKey}`,
    });
  });

  router.post("/visits/:id/exception", auth, role("gate", "ehs", "admin"), async (req, res) => {
    const v = getVisit(req.params.id);
    if (!v) return res.status(404).json({ error: "不存在" });
    if (!["access_pending", "rejected", "inspecting"].includes(v.status)) {
      return res.status(400).json({ error: `当前状态不可申请例外: ${v.status}` });
    }
    const { reason, approverNote } = req.body || {};
    if (!reason) return res.status(400).json({ error: "须填写例外原因" });
    const now = new Date().toISOString();
    const note = {
      reason,
      approverNote: approverNote || null,
      requestedBy: req.user.name,
      requestedById: req.user.id,
      requestedAt: now,
      status: dualApproveEnabled() ? "pending" : "approved",
    };

    if (dualApproveEnabled() && req.user.role === "gate") {
      db.prepare(
        `UPDATE visits SET status = 'exception_requested', exception_note = ?, updated_at = ? WHERE id = ?`
      ).run(JSON.stringify(note), now, v.id);
      audit(req.user, "visit.exception_request", "visit", v.id, note);
      return res.json({
        ok: true,
        pendingApproval: true,
        visit: enrichVisit(getVisit(v.id)),
        message: "已提交双签例外，等待 EHS/管理员批准",
      });
    }

    note.approvedBy = req.user.name;
    note.approvedAt = now;
    note.status = "approved";
    db.prepare(
      `UPDATE visits SET status = 'onsite', exception_note = ?, onsite_at = ?, updated_at = ? WHERE id = ?`
    ).run(JSON.stringify(note), now, now, v.id);
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
    audit(req.user, "visit.exception", "visit", v.id, { ...note, deviceResult });
    res.json({ ok: true, pendingApproval: false, visit: enrichVisit(getVisit(v.id)), deviceResult });
  });

  router.post(
    "/visits/:id/exception/approve",
    auth,
    role("ehs", "admin"),
    async (req, res) => {
      const v = getVisit(req.params.id);
      if (!v) return res.status(404).json({ error: "不存在" });
      if (v.status !== "exception_requested") {
        return res.status(400).json({ error: `当前状态不可批准: ${v.status}` });
      }
      const now = new Date().toISOString();
      const note = {
        ...(safeJson(v.exception_note) || {}),
        approvedBy: req.user.name,
        approvedAt: now,
        status: "approved",
        approverNote: req.body?.approverNote || null,
      };
      db.prepare(
        `UPDATE visits SET status = 'onsite', exception_note = ?, onsite_at = ?, updated_at = ? WHERE id = ?`
      ).run(JSON.stringify(note), now, now, v.id);
      let deviceResult = null;
      try {
        deviceResult = await deviceHub.openBarrier("barrier-in-1", {
          visitId: v.id,
          direction: "in",
          reason: `exception_approved:${note.reason || ""}`,
        });
      } catch (e) {
        deviceResult = { ok: false, error: String(e.message || e) };
      }
      audit(req.user, "visit.exception_approve", "visit", v.id, { ...note, deviceResult });
      res.json({ ok: true, visit: enrichVisit(getVisit(v.id)), deviceResult });
    }
  );

  router.post("/visits/:id/exception/reject", auth, role("ehs", "admin"), (req, res) => {
    const v = getVisit(req.params.id);
    if (!v) return res.status(404).json({ error: "不存在" });
    if (v.status !== "exception_requested") {
      return res.status(400).json({ error: `当前状态不可驳回: ${v.status}` });
    }
    const now = new Date().toISOString();
    const note = {
      ...(safeJson(v.exception_note) || {}),
      rejectedBy: req.user.name,
      rejectedAt: now,
      status: "rejected",
      rejectReason: req.body?.reason || "未批准",
    };
    db.prepare(
      `UPDATE visits SET status = 'access_pending', exception_note = ?, updated_at = ? WHERE id = ?`
    ).run(JSON.stringify(note), now, v.id);
    audit(req.user, "visit.exception_reject", "visit", v.id, note);
    res.json({ ok: true, visit: enrichVisit(getVisit(v.id)) });
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

  router.post("/devices/lpr/simulate", auth, role("gate", "admin", "ehs"), async (req, res) => {
    const plateNo = req.body?.plateNo;
    await deviceHub.get("lpr-gate-1").execute("set_demo_plate", { plateNo });
    const captured = await deviceHub.capturePlate("lpr-gate-1");
    const vehicle = db.prepare(`SELECT * FROM vehicles WHERE plate_no = ?`).get(captured.plateNo);
    let matchedVisit = null;
    if (vehicle) {
      const row = db
        .prepare(
          `SELECT v.*, d.name AS driver_name, d.phone AS driver_phone, vh.plate_no, c.name AS carrier_name
           FROM visits v
           JOIN drivers d ON d.id = v.driver_id
           JOIN vehicles vh ON vh.id = v.vehicle_id
           JOIN carriers c ON c.id = v.carrier_id
           WHERE v.vehicle_id = ?
             AND v.status IN ('inspecting','access_pending','exception_requested','appointed')
           ORDER BY v.updated_at DESC LIMIT 1`
        )
        .get(vehicle.id);
      if (row) matchedVisit = enrichVisit(row);
    }
    res.json({ captured, vehicle: vehicle || null, matchedVisit });
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
  const visitType = normalizeVisitType(v.visit_type || "carrier");
  const mins = dwellMinutes(v.onsite_at);
  const departure = safeJson(v.departure_json);
  const signs = departure?.signs || { driver: null, gate: null };
  return {
    ...v,
    visit_type: visitType,
    visit_type_label: getVisitProfile(visitType).label,
    selected_options: selectedOptions,
    block_reasons: safeJson(v.block_reasons),
    inspection: safeJson(v.inspection_json),
    departure,
    exception: safeJson(v.exception_note),
    depart_steps: resolveDepartSteps(visitType, selectedOptions),
    dwell_minutes: v.status === "onsite" || v.status === "departing" ? mins : null,
    dwell_over: (v.status === "onsite" || v.status === "departing") && isDwellOver(v.onsite_at),
    dwell_warn_minutes: dwellWarnMinutes(),
    fast_lane: v.risk_level === "low",
    checkout_signs: signs,
    ready_for_sign: !!departure?.readyForSign,
    both_signed: !!(signs.driver && signs.gate),
    archive_key: v.archive_key || departure?.archiveKey || null,
  };
}
