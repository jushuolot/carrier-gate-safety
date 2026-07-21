import { useEffect, useState } from "react";
import { api } from "../../api";
import { RiskPill } from "../../components/PassCode";
import { useI18n } from "../../i18n/I18nContext";
import {
  checkLabel,
  reasonLabel,
  riskFactorLabel,
  statusLabel,
  visitTypeLabel,
} from "../../i18n/labels";

export default function GateConsole() {
  const { t } = useI18n();
  const [queue, setQueue] = useState([]);
  const [kpi, setKpi] = useState(null);
  const [selected, setSelected] = useState(null);
  const [access, setAccess] = useState(null);
  const [checklistDef, setChecklistDef] = useState([]);
  const [checks, setChecks] = useState({});
  const [msg, setMsg] = useState("");
  const [msgBad, setMsgBad] = useState(false);
  const [plate, setPlate] = useState("沪A12345");
  const [passCode, setPassCode] = useState("");
  const [busy, setBusy] = useState(false);

  function showMsg(text, bad = false) {
    setMsg(text);
    setMsgBad(bad);
  }

  async function reload() {
    const [pending, inspecting, exception, k] = await Promise.all([
      api("/visits?status=access_pending"),
      api("/visits?status=inspecting"),
      api("/visits?status=exception_requested"),
      api("/gate/kpi"),
    ]);
    const items = [...inspecting.items, ...pending.items, ...exception.items];
    items.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
    setQueue(items);
    setKpi(k);
  }

  useEffect(() => {
    reload().catch((e) => showMsg(e.message, true));
  }, []);

  async function openVisit(id) {
    setBusy(true);
    showMsg("");
    try {
      const data = await api(`/visits/${id}`);
      setSelected(data.visit);
      setAccess(data.access);
      const list = data.inspectChecklist || [];
      setChecklistDef(list);
      setChecks(Object.fromEntries(list.map((c) => [c.key, true])));
    } catch (e) {
      showMsg(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function lookupPass() {
    if (!passCode.trim()) return;
    setBusy(true);
    showMsg("");
    try {
      const r = await api(`/visits?passCode=${encodeURIComponent(passCode.trim())}`);
      const v = r.visit || r.items?.[0];
      if (!v) throw new Error(t("notFound"));
      showMsg(
        t("passCodeHit", { target: v.plate_no || v.customer_name || v.id })
      );
      await openVisit(v.id);
    } catch (e) {
      showMsg(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function inspect(pass) {
    if (!selected || busy) return;
    setBusy(true);
    showMsg("");
    try {
      const r = await api(`/visits/${selected.id}/inspect`, {
        method: "POST",
        body: { pass, checklist: checks },
      });
      showMsg(
        r.ok
          ? t("releaseSuccess", {
              extra: r.deviceResult?.txnId
                ? t("releaseExtraGate", { txn: r.deviceResult.txnId })
                : "",
            })
          : t("inspectFailed"),
        !r.ok
      );
      setSelected(r.visit);
      await reload();
    } catch (e) {
      showMsg(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function exceptionPass() {
    if (!selected || busy) return;
    setBusy(true);
    showMsg("");
    try {
      const r = await api(`/visits/${selected.id}/exception`, {
        method: "POST",
        body: { reason: "exception", approverNote: "gate" },
      });
      showMsg(r.pendingApproval ? t("exceptionSubmitted") : t("exceptionDone"));
      setSelected(r.visit);
      await reload();
    } catch (e) {
      showMsg(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function simulateLpr() {
    if (busy) return;
    setBusy(true);
    showMsg("");
    try {
      const r = await api("/devices/lpr/simulate", {
        method: "POST",
        body: { plateNo: plate },
      });
      let text = t("lprResult", {
        plate: r.captured.plateNo,
        pct: Math.round(r.captured.confidence * 100),
      });
      if (r.matchedVisit) {
        text += t("lprMatched", {
          code: r.matchedVisit.pass_code || r.matchedVisit.id,
        });
        showMsg(text);
        await openVisit(r.matchedVisit.id);
      } else {
        showMsg(text + (r.vehicle ? t("lprRegistered") : t("lprNotRegistered")));
      }
    } catch (e) {
      showMsg(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function addDemoJob() {
    if (busy) return;
    setBusy(true);
    showMsg("");
    try {
      const slots = await api("/meta/slots");
      const slot = (slots.items || []).find((s) => s.available) || slots.items?.[0];
      const created = await api("/visits", {
        method: "POST",
        body: {
          visitType: "carrier",
          carrierId: "carrier-1",
          driverId: "driver-ok",
          vehicleId: "veh-1",
          slotStart: slot.slotStart,
          slotEnd: slot.slotEnd,
        },
      });
      const checked = await api(`/visits/${created.visit.id}/checkin`, {
        method: "POST",
        body: {},
      });
      await reload();
      showMsg(
        checked.ok
          ? t("demoJobAdded", { code: checked.visit.pass_code })
          : t("demoJobPending")
      );
      if (checked.visit) await openVisit(checked.visit.id);
    } catch (e) {
      showMsg(e.message, true);
    } finally {
      setBusy(false);
    }
  }

  function subjectText(v) {
    if (v.visit_type === "self_pickup") {
      return `${v.customer_name || "-"} · ${v.pickup_ref || "-"}`;
    }
    return `${v.plate_no || "-"} · ${v.driver_name || "-"}`;
  }

  const riskText = (factors) =>
    (factors || []).map((f) => riskFactorLabel(t, f)).join("、");

  return (
    <div className="gate-page">
      <header className="gate-head page-head">
        <h2>{t("gateConsole")}</h2>
        <p className="muted">{t("gateConsoleSub")}</p>
      </header>

      {kpi && (
        <div className="gate-kpi">
          <div className="gate-kpi-item">
            <span className="l">{t("kpiInspecting")}</span>
            <span className="v">{kpi.inspecting}</span>
          </div>
          <div className="gate-kpi-item">
            <span className="l">{t("kpiAccessPending")}</span>
            <span className="v">{kpi.accessPending}</span>
          </div>
          <div className="gate-kpi-item">
            <span className="l">{t("kpiDualSign")}</span>
            <span className="v">{kpi.exceptionRequested}</span>
          </div>
          <div className="gate-kpi-item">
            <span className="l">{t("kpiDwellOver")}</span>
            <span className="v">{kpi.dwellOver}</span>
          </div>
          <div className="gate-kpi-item">
            <span className="l">{t("kpiReleasedToday")}</span>
            <span className="v">{kpi.releasedToday}</span>
          </div>
        </div>
      )}

      {msg && <div className={`gate-toast ${msgBad ? "bad" : "ok"}`}>{msg}</div>}

      <section className="card gate-tools">
        <strong>{t("shiftTools")}</strong>
        <div className="filters-grid" style={{ marginTop: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>{t("passCodeLabel")}</label>
            <div className="gate-lpr">
              <input
                value={passCode}
                onChange={(e) => setPassCode(e.target.value.toUpperCase())}
                placeholder={t("placeholderPassCodeGate")}
                aria-label={t("passCodeLabel")}
              />
              <button className="btn primary" type="button" onClick={lookupPass} disabled={busy}>
                {t("openBtn")}
              </button>
            </div>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>{t("plateLpr")}</label>
            <div className="gate-lpr">
              <input value={plate} onChange={(e) => setPlate(e.target.value)} aria-label={t("plateLpr")} />
              <button className="btn" type="button" onClick={simulateLpr} disabled={busy}>
                {t("matchBtn")}
              </button>
            </div>
          </div>
        </div>
        <button className="btn btn-block" type="button" onClick={addDemoJob} disabled={busy} style={{ marginTop: 4 }}>
          {busy ? t("processing") : t("addDemoJob")}
        </button>
      </section>

      <div className="gate-split">
        <section className="gate-queue">
          <div className="gate-section-title">
            <strong>{t("pendingQueue")}</strong>
            <span className="muted">{t("queueCount", { n: queue.length })}</span>
          </div>

          {!queue.length && (
            <div className="card gate-empty">
              <p className="muted">{t("noQueue")}</p>
            </div>
          )}

          <ul className="gate-list">
            {queue.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className={`gate-item risk-${v.risk_level || "low"} ${selected?.id === v.id ? "on" : ""}`}
                  onClick={() => openVisit(v.id)}
                  disabled={busy}
                >
                  <span className="gate-item-top">
                    <span className="pill">{visitTypeLabel(t, v.visit_type)}</span>
                    <span className="pill">{statusLabel(t, v.status)}</span>
                    <RiskPill level={v.risk_level} score={v.risk_score} />
                  </span>
                  <strong>{subjectText(v)}</strong>
                  <span className="muted">
                    {v.pass_code ? t("passCodeShort", { code: v.pass_code }) : ""}
                    {v.slot_start ? ` · ${String(v.slot_start).slice(11, 16)}` : ""}
                    {v.fast_lane ? ` · ${t("fastLane")}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card gate-detail">
          <strong>{t("verificationDetail")}</strong>
          {!selected && <p className="muted" style={{ marginTop: 12 }}>{t("selectOrPassCode")}</p>}

          {selected && (
            <div className="gate-detail-body">
              <p className="gate-subject">
                <RiskPill level={selected.risk_level} score={selected.risk_score} />
                <span>{subjectText(selected)}</span>
              </p>
              {selected.pass_code && (
                <p className="muted">{t("passCodeShort", { code: selected.pass_code })}</p>
              )}
              <p>
                {t("statusWord")}{" "}
                <span className="pill">{statusLabel(t, selected.status)}</span>
                {selected.fast_lane || selected.risk_level === "low" ? (
                  <span className="pill ok" style={{ marginLeft: 6 }}>
                    {t("fastLane")}
                  </span>
                ) : null}
              </p>

              {access && (
                <div className="gate-lights">
                  <span className={`pill ${access.lights.training ? "ok" : "bad"}`}>
                    {t("trainingLight")} {access.lights.training ? t("trainingValid") : t("trainingFail")}
                  </span>
                  <span className={`pill ${access.lights.documents ? "ok" : "bad"}`}>
                    {t("docsLight")} {access.lights.documents ? t("docsComplete") : t("docsMissing")}
                  </span>
                </div>
              )}
              {access?.riskFactors?.length > 0 && (
                <p className="muted">{t("riskFactorsPrefix", { factors: riskText(access.riskFactors) })}</p>
              )}
              {access && !access.allowed && (
                <ul className="gate-reasons">
                  {access.reasons.map((r, i) => (
                    <li key={i}>{reasonLabel(t, r)}</li>
                  ))}
                </ul>
              )}

              {selected.status === "inspecting" && (
                <div className="gate-actions">
                  {checklistDef.map((c) => (
                    <label key={c.key} className="gate-check">
                      <input
                        type="checkbox"
                        checked={!!checks[c.key]}
                        onChange={(e) =>
                          setChecks((x) => ({ ...x, [c.key]: e.target.checked }))
                        }
                      />
                      <span>{checkLabel(t, c.key)}</span>
                    </label>
                  ))}
                  <button
                    className="btn primary btn-block"
                    type="button"
                    onClick={() => inspect(true)}
                    disabled={busy}
                  >
                    {t("inspectPass")}
                  </button>
                  <button
                    className="btn danger btn-block"
                    type="button"
                    onClick={() => inspect(false)}
                    disabled={busy}
                  >
                    {t("inspectReject")}
                  </button>
                </div>
              )}

              {selected.status === "access_pending" && (
                <div className="gate-actions">
                  <button
                    className="btn primary btn-block"
                    type="button"
                    onClick={exceptionPass}
                    disabled={busy}
                  >
                    {t("exceptionPass")}
                  </button>
                </div>
              )}

              {selected.status === "exception_requested" && (
                <p className="muted">{t("waitingDualApproval")}</p>
              )}

              {selected.inspection?.snapshot && (
                <p className="muted" style={{ marginTop: 10 }}>
                  {t("evidenceRecorded", {
                    url: selected.inspection.snapshot.url || "mock",
                  })}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
