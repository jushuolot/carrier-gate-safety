import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "../../data");
const dbPath = path.join(dataDir, "gate.db");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      carrier_id TEXT,
      driver_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS carriers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      credit_code TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      risk_score INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      carrier_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      id_masked TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      FOREIGN KEY (carrier_id) REFERENCES carriers(id)
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      carrier_id TEXT NOT NULL,
      plate_no TEXT NOT NULL UNIQUE,
      vehicle_type TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      FOREIGN KEY (carrier_id) REFERENCES carriers(id)
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      file_name TEXT,
      ocr_json TEXT,
      expire_at TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      confidence REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS training_courses (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      title TEXT NOT NULL,
      video_url TEXT,
      min_watch_seconds INTEGER NOT NULL DEFAULT 60,
      pass_score INTEGER NOT NULL DEFAULT 80,
      valid_days INTEGER NOT NULL DEFAULT 365,
      version INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL,
      stem TEXT NOT NULL,
      options_json TEXT NOT NULL,
      answer_index INTEGER NOT NULL,
      FOREIGN KEY (course_id) REFERENCES training_courses(id)
    );

    CREATE TABLE IF NOT EXISTS training_records (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      course_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      watched_seconds INTEGER NOT NULL DEFAULT 0,
      video_completed INTEGER NOT NULL DEFAULT 0,
      quiz_score INTEGER,
      quiz_passed INTEGER NOT NULL DEFAULT 0,
      valid_until TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (driver_id) REFERENCES drivers(id),
      FOREIGN KEY (course_id) REFERENCES training_courses(id)
    );

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      carrier_id TEXT NOT NULL,
      driver_id TEXT NOT NULL,
      vehicle_id TEXT NOT NULL,
      appointment_at TEXT,
      status TEXT NOT NULL,
      block_reasons TEXT,
      checkin_at TEXT,
      admitted_at TEXT,
      inspection_json TEXT,
      onsite_at TEXT,
      departure_json TEXT,
      checkout_at TEXT,
      exception_note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (carrier_id) REFERENCES carriers(id),
      FOREIGN KEY (driver_id) REFERENCES drivers(id),
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_name TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      detail_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_events (
      id TEXT PRIMARY KEY,
      device_type TEXT NOT NULL,
      device_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 增量列（已有库可重复执行）
  const visitCols = db.prepare(`PRAGMA table_info(visits)`).all().map((c) => c.name);
  const addCol = (name, ddl) => {
    if (!visitCols.includes(name)) {
      db.exec(`ALTER TABLE visits ADD COLUMN ${ddl}`);
    }
  };
  addCol("visit_type", "visit_type TEXT NOT NULL DEFAULT 'carrier'");
  addCol("selected_options", "selected_options TEXT");
  addCol("customer_name", "customer_name TEXT");
  addCol("customer_phone", "customer_phone TEXT");
  addCol("pickup_ref", "pickup_ref TEXT");
  addCol("slot_start", "slot_start TEXT");
  addCol("slot_end", "slot_end TEXT");
  addCol("pass_code", "pass_code TEXT");
  addCol("risk_score", "risk_score INTEGER");
  addCol("risk_level", "risk_level TEXT");
}
