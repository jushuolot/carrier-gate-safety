import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";
import { LogoutButton } from "../../components";
import { RiskPill } from "../../components/PassCode";
import { demoName, listJoin, translateApiError } from "../../i18n/content";
import { LangSwitch, useI18n } from "../../i18n/I18nContext";
import { reasonLabel, riskFactorLabel } from "../../i18n/labels";

function translateNotification(t, n) {
  const vars = n.vars || {};
  const map = {
    "train-required": { title: "notifyTrainRequired", body: "notifyTrainRequiredBody" },
    "train-expiring": { title: "notifyTrainExpiring", body: "notifyTrainExpiringBody" },
    "dual-pending": { title: "notifyDualPending", body: "notifyDualPendingBody" },
  };
  if (n.id?.startsWith("block-")) {
    return { title: t("notifyBlocked"), body: t("notifyBlockedBody") };
  }
  if (n.id?.startsWith("ready-")) {
    return {
      title: t("notifyReady"),
      body: vars.code ? t("notifyReadyBody", { code: vars.code }) : t("notifyReadyBodyGate"),
    };
  }
  if (n.id?.startsWith("dwell-")) {
    return {
      title: t("notifyDwell"),
      body: t("notifyDwellBody", { mins: vars.mins ?? "?" }),
    };
  }
  const preset = map[n.id];
  if (preset) {
    return { title: t(preset.title), body: t(preset.body, vars) };
  }
  return { title: n.title, body: n.body };
}

export default function DriverHome() {
  const user = getUser();
  const { t, lang } = useI18n();
  const driverId = user?.driver_id;
  const carrierId = user?.carrier_id;
  const [status, setStatus] = useState(null);
  const [access, setAccess] = useState(null);
  const [notes, setNotes] = useState([]);
  const [err, setErr] = useState("");

  const ACTIONS = [
    { to: "/driver/training", title: t("driverTraining"), desc: t("driverTrainingDesc") },
    { to: "/driver/docs", title: t("driverDocs"), desc: t("driverDocsDesc") },
    { to: "/driver/visit", title: t("driverVisit"), desc: t("driverVisitDesc") },
  ];

  useEffect(() => {
    if (!driverId) return;
    let cancelled = false;
    (async () => {
      try {
        const [st, vehicles, n] = await Promise.all([
          api(`/training/status?driverId=${driverId}`),
          api(`/vehicles?carrierId=${carrierId}`),
          api("/notifications"),
        ]);
        if (cancelled) return;
        setStatus(st);
        setNotes(n.items || []);
        const vehicleId = vehicles.items[0]?.id;
        if (vehicleId) {
          const ev = await api("/access/evaluate", {
            method: "POST",
            body: { driverId, vehicleId, carrierId },
          });
          if (!cancelled) setAccess(ev);
        }
      } catch (e) {
        if (!cancelled) setErr(translateApiError(lang, e.message));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driverId, carrierId]);

  const lights = [
    {
      key: "training",
      label: t("lightTraining"),
      ok: !!access?.lights?.training,
      okText: t("okValid"),
      badText: t("badTodo"),
    },
    {
      key: "documents",
      label: t("lightDocs"),
      ok: !!access?.lights?.documents,
      okText: t("okReady"),
      badText: t("badNeed"),
    },
    {
      key: "subject",
      label: t("lightSubject"),
      ok: access?.lights?.subject !== false,
      okText: t("okNormal"),
      badText: t("badAbnormal"),
    },
  ];
  if (access?.lights && Object.prototype.hasOwnProperty.call(access.lights, "hazmat")) {
    lights.push({
      key: "hazmat",
      label: t("lightHazmat"),
      ok: !!access.lights.hazmat,
      okText: t("okHazmat"),
      badText: t("badHazmat"),
    });
  }

  const riskText = (access?.riskFactors || [])
    .map((f) => riskFactorLabel(t, f))
    .join(listJoin(lang));

  return (
    <div className="h5">
      <header className="h5-head">
        <div>
          <p className="h5-kicker">{t("driverKicker")}</p>
          <h1 className="h5-name">{demoName(lang, user.id, user.name)}</h1>
          <p className="h5-brand-line">{t("brand")}</p>
          <p className="h5-brand-en">{t("brandAlt")}</p>
        </div>
        <div className="h5-head-actions">
          <LangSwitch className="lang-switch-light" />
          <LogoutButton />
        </div>
      </header>

      {notes.length > 0 && (
        <ul className="notify-list">
          {notes.map((n) => {
            const tx = translateNotification(t, n);
            return (
              <li key={n.id} className={`notify-item ${n.level}`}>
                <Link to={n.to || "/driver"}>
                  <strong>{tx.title}</strong>
                  <span className="muted">{tx.body}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <section className="status-panel" aria-label={t("accessLights")}>
        <div className="status-panel-top">
          <h2>{t("accessLights")}</h2>
          <div className="row" style={{ gap: 6 }}>
            {access && <RiskPill level={access.riskLevel} score={access.riskScore} />}
            {access && (
              <span className={`status-flag ${access.allowed ? "ok" : "bad"}`}>
                {access.allowed ? t("canEnter") : t("cannotEnter")}
              </span>
            )}
          </div>
        </div>

        <ul className="status-list">
          {lights.map((l) => (
            <li key={l.key} className={l.ok ? "ok" : "bad"}>
              <i className="status-dot" aria-hidden />
              <span className="status-label">{l.label}</span>
              <span className="status-val">{l.ok ? l.okText : l.badText}</span>
            </li>
          ))}
        </ul>

        {access?.riskFactors?.length > 0 && (
          <p className="status-note">{t("riskFactorsLabel", { factors: riskText })}</p>
        )}
        {access && !access.allowed && (
          <ul className="status-reasons">
            {access.reasons.map((r, i) => (
              <li key={i}>{reasonLabel(t, r)}</li>
            ))}
          </ul>
        )}
        {status?.record?.valid_until && (
          <p className="status-note">{t("trainingValidUntil", { date: status.record.valid_until })}</p>
        )}
      </section>

      <nav className="action-list" aria-label={t("nav")}>
        {ACTIONS.map((a) => (
          <Link key={a.to} className="action-row" to={a.to}>
            <span>
              <strong>{a.title}</strong>
              <span className="muted">{a.desc}</span>
            </span>
            <span className="action-go" aria-hidden>
              →
            </span>
          </Link>
        ))}
      </nav>

      {err && <p className="form-err">{err}</p>}
    </div>
  );
}
