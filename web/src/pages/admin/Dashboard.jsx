import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";
import { RiskPill } from "../../components/PassCode";
import { useI18n } from "../../i18n/I18nContext";
import { docTypeLabel } from "../../i18n/labels";

export default function Dashboard() {
  const user = getUser();
  const { t } = useI18n();
  const [dash, setDash] = useState(null);
  const [expiring, setExpiring] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setDash(await api("/dashboard"));
    const d = await api("/documents/expiring?days=14");
    setExpiring((d.items || []).slice(0, 8));
    if (user?.role === "admin" || user?.role === "ehs") {
      const ex = await api("/visits?status=exception_requested");
      setExceptions(ex.items || []);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, [user?.role]);

  async function approve(id) {
    setBusy(true);
    setMsg("");
    try {
      await api(`/visits/${id}/exception/approve`, {
        method: "POST",
        body: { approverNote: "EHS" },
      });
      setMsg(t("toastApproved"));
      await load();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject(id) {
    setBusy(true);
    setMsg("");
    try {
      await api(`/visits/${id}/exception/reject`, {
        method: "POST",
        body: { reason: "rejected" },
      });
      setMsg(t("toastRejected"));
      await load();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerateOps() {
    if (!window.confirm(t("regenOpsConfirm"))) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api("/demo/regenerate", { method: "POST", body: {} });
      setMsg(t("regenOpsDone", { n: r.visitCount || 0 }));
      await load();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!dash) return <p className="muted">{t("loading")}</p>;

  const byType = dash.byType || {};

  return (
    <div className="page-block">
      <header className="page-head page-head-row">
        <div>
          <h2>{t("pageDashboard")}</h2>
          <p className="muted">
            {t("opsDashboardHint")}
            {user?.role === "admin" || user?.role === "ehs" ? (
              <>
                {" · "}
                <Link to="/gate">{t("navGate")}</Link>
              </>
            ) : null}
          </p>
        </div>
        {(user?.role === "admin" || user?.role === "ehs") && (
          <button className="btn" type="button" disabled={busy} onClick={regenerateOps}>
            {t("regenOpsData")}
          </button>
        )}
      </header>

      {msg && <div className={`gate-toast ${/失败|错误|fail|error/i.test(msg) ? "bad" : "ok"}`}>{msg}</div>}

      <div className="grid stats">
        <div className="card stat">
          <div className="l">{t("statOnsite")}</div>
          <div className="v">{dash.onsite}</div>
        </div>
        <div className="card stat">
          <div className="l">{t("statTodayVisits")}</div>
          <div className="v">{dash.todayAppointed}</div>
        </div>
        <div className="card stat">
          <div className="l">{t("statInspecting")}</div>
          <div className="v">{dash.inspecting ?? 0}</div>
        </div>
        <div className="card stat">
          <div className="l">{t("statDualSign")}</div>
          <div className="v">{dash.exceptionRequested ?? 0}</div>
        </div>
        <div className="card stat">
          <div className="l">{t("statDwellOver")}</div>
          <div className="v">{dash.dwellOver ?? 0}</div>
        </div>
        <div className="card stat">
          <div className="l">{t("statExpiring30d")}</div>
          <div className="v">{dash.expiring30d}</div>
        </div>
        <div className="card stat">
          <div className="l">{t("statCompleted14d")}</div>
          <div className="v">{dash.completed14d ?? 0}</div>
        </div>
        <div className="card stat">
          <div className="l">{t("statHazmatOpen")}</div>
          <div className="v">{dash.hazmatOpen ?? 0}</div>
        </div>
      </div>

      {(user?.role === "admin" || user?.role === "ehs") && (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>{t("pendingExceptions")}</strong>
          <p className="muted">{t("pendingExceptionsDesc")}</p>
          {!exceptions.length && <p className="muted">{t("noPendingApproval")}</p>}
          <ul className="gate-list" style={{ marginTop: 10 }}>
            {exceptions.map((v) => (
              <li key={v.id} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>
                    {v.plate_no || v.customer_name} · {v.driver_name}
                  </strong>
                  <RiskPill level={v.risk_level} score={v.risk_score} />
                </div>
                <p className="muted" style={{ margin: "6px 0 10px" }}>
                  {v.exception?.reason || t("exceptionRequest")}
                  {v.pass_code ? ` · ${t("passCodeShort", { code: v.pass_code })}` : ""}
                </p>
                <div className="row">
                  <button
                    className="btn primary"
                    type="button"
                    disabled={busy}
                    onClick={() => approve(v.id)}
                  >
                    {t("approveGate")}
                  </button>
                  <button className="btn danger" type="button" disabled={busy} onClick={() => reject(v.id)}>
                    {t("reject")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <strong>{t("opsMixTitle")}</strong>
          <p className="muted">{t("opsMixDesc")}</p>
          <ul className="entity-list">
            <li className="entity-row">
              <div className="entity-primary">{t("vt_carrier_inbound")}</div>
              <span className="pill">{byType.carrier_inbound || 0}</span>
            </li>
            <li className="entity-row">
              <div className="entity-primary">{t("vt_carrier_outbound")}</div>
              <span className="pill">{byType.carrier_outbound || 0}</span>
            </li>
            <li className="entity-row">
              <div className="entity-primary">{t("vt_self_pickup")}</div>
              <span className="pill">{byType.self_pickup || 0}</span>
            </li>
            <li className="entity-row">
              <div className="entity-primary">{t("vt_temporary")}</div>
              <span className="pill">{byType.temporary || 0}</span>
            </li>
          </ul>
          <strong style={{ display: "block", marginTop: 14 }}>{t("recentCompletedTitle")}</strong>
          <ul className="entity-list">
            {(dash.recentCompleted || []).map((r) => (
              <li key={r.id} className="entity-row">
                <div className="entity-main">
                  <div className="entity-primary">
                    {r.plate} {r.hazmat ? "· HAZ" : ""}
                  </div>
                  <div className="entity-secondary">{r.archive_key || r.checkout_at?.slice(0, 16)}</div>
                </div>
              </li>
            ))}
            {!(dash.recentCompleted || []).length && <li className="muted">{t("noRecentCompleted")}</li>}
          </ul>
        </div>

        <div className="card">
          <strong>{t("recentDocRisk")}</strong>
          <p className="muted">{t("recentDocRiskDesc")}</p>
          <ul className="entity-list">
            {expiring.map((d) => (
              <li key={d.id} className="entity-row">
                <div className="entity-main">
                  <div className="entity-primary">{docTypeLabel(t, d.doc_type)}</div>
                  <div className="entity-secondary">
                    {d.subject_type}/{d.subject_id}
                  </div>
                </div>
                <span className={`pill ${d.expired ? "bad" : "warn"}`}>{d.expire_at}</span>
              </li>
            ))}
            {!expiring.length && <li className="muted">{t("noExpiring14d")}</li>}
          </ul>
          <Link to="/admin/documents">{t("viewAllExpiring")}</Link>
          <div className="row" style={{ marginTop: 16 }}>
            <Link className="btn" to="/admin/visits">
              {t("openLedger")}
            </Link>
            {(user?.role === "admin" || user?.role === "ehs") && (
              <Link className="btn" to="/gate">
                {t("gateCommandLink")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
