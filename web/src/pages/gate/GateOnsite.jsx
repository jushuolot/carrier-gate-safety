import { useEffect, useState } from "react";
import { api } from "../../api";
import { RiskPill } from "../../components/PassCode";

export default function GateOnsite() {
  const [items, setItems] = useState([]);
  const [warn, setWarn] = useState(90);
  const [err, setErr] = useState("");

  async function load() {
    const [d, cfg] = await Promise.all([
      api("/visits?status=onsite"),
      api("/meta/yard-config").catch(() => ({ dwellWarnMinutes: 90 })),
    ]);
    setItems(d.items);
    setWarn(cfg.dwellWarnMinutes || 90);
  }

  useEffect(() => {
    load().catch((e) => setErr(e.message));
    const t = setInterval(() => {
      load().catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="gate-page">
      <header className="gate-head">
        <h2>当前在场</h2>
        <p className="muted">SLA {warn} 分钟超时高亮催离</p>
      </header>

      {err && <div className="gate-toast bad">{err}</div>}

      {!items.length && (
        <div className="card gate-empty">
          <p className="muted">当前无在场车辆/自提</p>
        </div>
      )}

      <ul className="gate-list">
        {items.map((v) => (
          <li
            key={v.id}
            className={`card gate-onsite-card ${v.dwell_over ? "dwell-over" : ""}`}
          >
            <span className="gate-item-top">
              <span className="pill">{v.visit_type_label || v.visit_type}</span>
              <span className={`pill ${v.dwell_over ? "warn" : "ok"}`}>
                {v.dwell_over ? "超时" : "在场"}
              </span>
              <RiskPill level={v.risk_level} score={v.risk_score} />
            </span>
            <strong>
              {v.visit_type === "self_pickup"
                ? `${v.customer_name || "-"} / ${v.pickup_ref || "-"}`
                : `${v.plate_no} · ${v.driver_name}`}
            </strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              入场 {formatTime(v.onsite_at)} · 已停留 {v.dwell_minutes ?? stayText(v.onsite_at)}
              {v.dwell_over ? " · 请催促离场" : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatTime(onsiteAt) {
  if (!onsiteAt) return "-";
  try {
    return new Date(onsiteAt).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return onsiteAt;
  }
}

function stayText(onsiteAt) {
  if (!onsiteAt) return "-";
  const mins = Math.max(0, Math.round((Date.now() - new Date(onsiteAt).getTime()) / 60000));
  if (mins < 60) return `${mins} 分钟`;
  return `${Math.floor(mins / 60)} 小时 ${mins % 60} 分`;
}
