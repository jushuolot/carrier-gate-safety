import { useEffect, useState } from "react";
import { api } from "../../api";
import { RiskPill } from "../../components/PassCode";
import { useI18n } from "../../i18n/I18nContext";

export default function GateOnsite() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [warn, setWarn] = useState(90);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [passCodes, setPassCodes] = useState({});

  async function load() {
    const [d, cfg] = await Promise.all([
      api("/visits?status=onsite,departing"),
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

  async function gateSign(id) {
    try {
      const r = await api(`/visits/${id}/checkout/sign`, {
        method: "POST",
        body: { role: "gate" },
      });
      setMsg(r.message);
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function confirmCheckout(id) {
    try {
      const r = await api(`/visits/${id}/checkout/confirm`, {
        method: "POST",
        body: { passCode: passCodes[id] || undefined },
      });
      setMsg(r.message || `归档 ${r.archiveKey}`);
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="gate-page">
      <header className="gate-head page-head">
        <h2>{t("gateOnsite")}</h2>
        <p className="muted">{t("gateOnsiteSub").replace("{n}", String(warn))}</p>
      </header>

      {err && <div className="gate-toast bad">{err}</div>}
      {msg && <div className="gate-toast">{msg}</div>}

      {!items.length && (
        <div className="card gate-empty">
          <p className="muted">当前无在场 / 待签退车辆</p>
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
              <span className={`pill ${v.status === "departing" ? "warn" : v.dwell_over ? "warn" : "ok"}`}>
                {v.status === "departing" ? "离场中" : v.dwell_over ? "超时" : "在场"}
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
              {v.pass_code ? ` · 码 ${v.pass_code}` : ""}
            </p>

            {v.status === "departing" && v.ready_for_sign && (
              <div style={{ marginTop: 10 }}>
                <p className="muted">
                  双签：司机 {v.checkout_signs?.driver ? "✓" : "○"} · 门岗{" "}
                  {v.checkout_signs?.gate ? "✓" : "○"}
                </p>
                {!v.checkout_signs?.gate && (
                  <button className="btn primary btn-block" type="button" onClick={() => gateSign(v.id)}>
                    门岗签退
                  </button>
                )}
                {v.both_signed && (
                  <>
                    <div className="field" style={{ marginTop: 8 }}>
                      <label>通行码确认（可选）</label>
                      <input
                        value={passCodes[v.id] || ""}
                        onChange={(e) =>
                          setPassCodes((m) => ({ ...m, [v.id]: e.target.value.toUpperCase() }))
                        }
                        placeholder={v.pass_code || "输入通行码"}
                      />
                    </div>
                    <button
                      className="btn primary btn-block"
                      type="button"
                      onClick={() => confirmCheckout(v.id)}
                    >
                      扫码确认离场开闸
                    </button>
                  </>
                )}
              </div>
            )}
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
