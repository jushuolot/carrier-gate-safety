/**
 * 将 shared/generateDemoOps 灌入 SQLite（与 Pages mock 对称）
 */
import { buildDemoOpsBundle } from "../../shared/generateDemoOps.js";
import { nanoid } from "nanoid";

export function applyDemoOps(db) {
  const ops = buildDemoOpsBundle({
    nid: () => nanoid(),
    now: () => new Date().toISOString(),
  });

  const insDoc = db.prepare(
    `INSERT OR REPLACE INTO documents
     (id, subject_type, subject_id, doc_type, file_name, ocr_json, expire_at, status, confidence, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const d of ops.documents) {
    insDoc.run(
      d.id,
      d.subject_type,
      d.subject_id,
      d.doc_type,
      `${d.doc_type}.jpg`,
      JSON.stringify(d.ocr_json || {}),
      d.expire_at,
      d.status,
      d.confidence ?? 0.9,
      d.created_at,
      d.updated_at
    );
  }

  const insTr = db.prepare(
    `INSERT OR REPLACE INTO training_records
     (id, driver_id, course_id, site_id, watched_seconds, video_completed, quiz_score, quiz_passed, valid_until, completed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const t of ops.training) {
    insTr.run(
      t.id,
      t.driver_id,
      t.course_id,
      t.site_id,
      t.watched_seconds,
      t.video_completed,
      t.quiz_score,
      t.quiz_passed,
      t.valid_until,
      t.completed_at,
      t.created_at
    );
  }

  const insVisit = db.prepare(
    `INSERT OR REPLACE INTO visits
     (id, site_id, carrier_id, driver_id, vehicle_id, appointment_at, status, block_reasons,
      checkin_at, admitted_at, inspection_json, onsite_at, departure_json, checkout_at, exception_note,
      visit_type, selected_options, customer_name, customer_phone, pickup_ref,
      slot_start, slot_end, pass_code, risk_score, risk_level, archive_key, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const v of ops.visits) {
    insVisit.run(
      v.id,
      v.site_id,
      v.carrier_id,
      v.driver_id,
      v.vehicle_id,
      v.appointment_at,
      v.status,
      v.block_reasons ? JSON.stringify(v.block_reasons) : null,
      v.checkin_at,
      v.admitted_at,
      v.inspection_json ? JSON.stringify(v.inspection_json) : null,
      v.onsite_at,
      v.departure_json ? JSON.stringify(v.departure_json) : null,
      v.checkout_at,
      v.exception_note ? JSON.stringify(v.exception_note) : null,
      v.visit_type,
      JSON.stringify(v.selected_options || []),
      v.customer_name,
      v.customer_phone,
      v.pickup_ref,
      v.slot_start,
      v.slot_end,
      v.pass_code,
      v.risk_score,
      v.risk_level,
      v.archive_key,
      v.created_at,
      v.updated_at
    );
  }

  const insAudit = db.prepare(
    `INSERT OR REPLACE INTO audit_logs
     (id, actor_id, actor_name, action, entity_type, entity_id, detail_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const a of ops.audit) {
    insAudit.run(
      a.id,
      a.actor_id,
      a.actor_name,
      a.action,
      a.entity_type,
      a.entity_id,
      JSON.stringify(a.detail || {}),
      a.created_at
    );
  }

  console.log(
    "Demo ops seed:",
    ops.summary.visits,
    "visits,",
    ops.summary.completed,
    "completed,",
    ops.summary.exceptions,
    "exceptions"
  );
  return ops.summary;
}
