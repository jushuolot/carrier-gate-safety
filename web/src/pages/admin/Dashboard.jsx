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

  if (!dash) return <p className="muted">{t("loading")}</p>;

  return (
    <div className="page-block">
      <header className="page-head">
        <h2>{t("pageDashboard")}</h2>
        <p className="muted">
          {user?.role === "admin" || user?.role === "ehs" ? (
            <>
              {" "}
              <Link to="/gate">{t("navGate")}</Link>
            </>
          ) : null}
        </p>
      </header>

      {msg && <div className="gate-toast ok">{msg}</div>}

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
        </div>

        <div className="card">
          <strong>{t("smartOrchestration")}</strong>
          <ul style={{ marginTop: 10, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>{t("orchSlotCapacity")}</li>
            <li>{t("orchRiskScore")}</li>
            <li>{t("orchPassLpr")}</li>
            <li>{t("orchDualSign")}</li>
          </ul>
          <div className="row" style={{ marginTop: 12 }}>
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
