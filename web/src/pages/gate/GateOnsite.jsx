import { useEffect, useState } from "react";
import { api } from "../../api";
import { RiskPill } from "../../components/PassCode";
import { useI18n } from "../../i18n/I18nContext";
import { formatDateTime, statusLabel, visitTypeLabel } from "../../i18n/labels";

export default function GateOnsite() {
  const { t, lang } = useI18n();
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
    const timer = setInterval(() => {
      load().catch(() => {});
    }, 8000);
    return () => clearInterval(timer);
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
      setMsg(r.message || t("archiveNo", { key: r.archiveKey }));
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  function stayText(onsiteAt) {
    if (!onsiteAt) return "-";
    const mins = Math.max(0, Math.round((Date.now() - new Date(onsiteAt).getTime()) / 60000));
    if (mins < 60) return t("stayedMins", { mins });
    return t("stayHours", { h: Math.floor(mins / 60), m: mins % 60 });
  }

  function onsiteStatus(v) {
    if (v.status === "departing") return statusLabel(t, "departing");
    if (v.dwell_over) return t("dwellOverStatus");
    return statusLabel(t, "onsite");
  }

  return (
    <div className="gate-page">
      <header className="gate-head page-head">
        <h2>{t("gateOnsite")}</h2>
        <p className="muted">{t("gateOnsiteSub", { n: warn })}</p>
      </header>

      {err && <div className="gate-toast bad">{err}</div>}
      {msg && <div className="gate-toast">{msg}</div>}

      {!items.length && (
        <div className="card gate-empty">
          <p className="muted">{t("noOnsite")}</p>
        </div>
      )}

      <ul className="gate-list">
        {items.map((v) => (
          <li
            key={v.id}
            className={`card gate-onsite-card ${v.dwell_over ? "dwell-over" : ""}`}
          >
            <span className="gate-item-top">
              <span className="pill">{visitTypeLabel(t, v.visit_type)}</span>
              <span className={`pill ${v.status === "departing" ? "warn" : v.dwell_over ? "warn" : "ok"}`}>
                {onsiteStatus(v)}
              </span>
              <RiskPill level={v.risk_level} score={v.risk_score} />
            </span>
            <strong>
              {v.visit_type === "self_pickup"
                ? `${v.customer_name || "-"} / ${v.pickup_ref || "-"}`
                : `${v.plate_no} · ${v.driver_name}`}
            </strong>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {t("enteredAt", { time: formatDateTime(lang, v.onsite_at) })}
              {" · "}
              {v.dwell_minutes != null
                ? t("stayedMins", { mins: v.dwell_minutes })
                : stayText(v.onsite_at)}
              {v.dwell_over ? t("urgeDepart") : ""}
              {v.pass_code ? ` · ${t("passCodeShort", { code: v.pass_code })}` : ""}
            </p>

            {v.status === "departing" && v.ready_for_sign && (
              <div style={{ marginTop: 10 }}>
                <p className="muted">
                  {t("dualSignDriver")} {v.checkout_signs?.driver ? "✓" : "○"} · {t("dualSignGate")}{" "}
                  {v.checkout_signs?.gate ? "✓" : "○"}
                </p>
                {!v.checkout_signs?.gate && (
                  <button className="btn primary btn-block" type="button" onClick={() => gateSign(v.id)}>
                    {t("gateCheckout")}
                  </button>
                )}
                {v.both_signed && (
                  <>
                    <div className="field" style={{ marginTop: 8 }}>
                      <label>{t("passCodeConfirmOptional")}</label>
                      <input
                        value={passCodes[v.id] || ""}
                        onChange={(e) =>
                          setPassCodes((m) => ({ ...m, [v.id]: e.target.value.toUpperCase() }))
                        }
                        placeholder={v.pass_code || t("placeholderPassCode")}
                      />
                    </div>
                    <button
                      className="btn primary btn-block"
                      type="button"
                      onClick={() => confirmCheckout(v.id)}
                    >
                      {t("confirmCheckout")}
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
