import { useEffect, useState } from "react";
import { api } from "../../api";
import { useI18n } from "../../i18n/I18nContext";
import { formatDateTime } from "../../i18n/labels";

export default function AuditPage() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/audit")
      .then((d) => setItems(d.items))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="page-block">
      <header className="page-head">
        <h2>{t("pageAudit")}</h2>
        <p className="muted">{t("auditSubtitle")}</p>
      </header>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

      <ul className="record-list mobile-only">
        {!items.length && !err && <li className="card muted">{t("noLogs")}</li>}
        {items.map((a) => (
          <li key={a.id} className="card record-card">
            <div className="record-card-top">
              <strong>{a.action}</strong>
              <span className="muted">{formatDateTime(lang, a.created_at, { second: "2-digit" })}</span>
            </div>
            <dl className="record-meta">
              <div>
                <dt>{t("actorLabel")}</dt>
                <dd>{a.actor_name || "-"}</dd>
              </div>
              <div>
                <dt>{t("entityLabel")}</dt>
                <dd className="cell-wrap">
                  {a.entity_type}/{a.entity_id}
                </dd>
              </div>
              <div className="record-meta-full">
                <dt>{t("detailLabel")}</dt>
                <dd className="mono-soft">{JSON.stringify(a.detail)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="card desk-only table-panel">
        <div className="table-scroll">
          <table className="table table-comfortable">
            <thead>
              <tr>
                <th>{t("colTime")}</th>
                <th>{t("colActor")}</th>
                <th>{t("colAuditAction")}</th>
                <th>{t("colEntity")}</th>
                <th>{t("colDetail")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">{formatDateTime(lang, a.created_at, { second: "2-digit" })}</td>
                  <td>{a.actor_name}</td>
                  <td>{a.action}</td>
                  <td className="cell-wrap">
                    {a.entity_type}/{a.entity_id}
                  </td>
                  <td className="muted mono-soft cell-wrap">{JSON.stringify(a.detail)}</td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    {t("noLogs")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
