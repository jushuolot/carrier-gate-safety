import { useEffect, useState } from "react";
import { api } from "../../api";

/** 门岗只看在场清单，方便催离场；不做后台分析 */
export default function GateOnsite() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  async function load() {
    const d = await api("/visits?status=onsite");
    setItems(d.items);
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
        <p className="muted">班次盯梢：超时停留可口头催促</p>
      </header>

      {err && <div className="gate-toast bad">{err}</div>}

      {!items.length && (
        <div className="card gate-empty">
          <p className="muted">当前无在场车辆/自提</p>
        </div>
      )}

      <ul className="gate-list">
        {items.map((v) => (
          <li key={v.id} className="card gate-onsite-card">
            <span className="gate-item-top">
              <span className="pill">{v.visit_type_label || v.visit_type}</span>
              <span className="pill ok">在场</span>
            </span>
            <strong>
              {v.visit_type === "self_pickup"
                ? `${v.customer_name || "-"} / ${v.pickup_ref || "-"}`
                : `${v.plate_no} · ${v.driver_name}`}
            </strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              入场 {formatTime(v.onsite_at)} · 已停留 {stayText(v.onsite_at)}
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
