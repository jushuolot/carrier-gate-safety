import { useEffect, useState } from "react";
import { api } from "../../api";
import { useI18n } from "../../i18n/I18nContext";
import { docTypeLabel } from "../../i18n/labels";

export default function DocumentsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    api(`/documents/expiring?days=${days}`)
      .then((d) => setItems(d.items))
      .catch(console.error);
  }, [days]);

  const windowOptions = [
    { value: 7, label: t("window7") },
    { value: 14, label: t("window14") },
    { value: 30, label: t("window30") },
    { value: 90, label: t("window90") },
  ];

  return (
    <div className="page-block">
      <header className="page-head page-head-row">
        <div>
          <h2>{t("pageDocuments")}</h2>
          <p className="muted">{t("docsSubtitle")}</p>
        </div>
        <div className="field field-inline">
          <label>{t("windowLabel")}</label>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {windowOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <ul className="record-list mobile-only">
        {!items.length && <li className="card muted">{t("noDocsInWindow")}</li>}
        {items.map((d) => (
          <li key={d.id} className="card record-card">
            <div className="record-card-top">
              <strong>{docTypeLabel(t, d.doc_type)}</strong>
              <span className={`pill ${d.expired ? "bad" : "warn"}`}>
                {d.expired ? t("expired") : t("expiringSoon")}
              </span>
            </div>
            <dl className="record-meta">
              <div>
                <dt>{t("metaSubject")}</dt>
                <dd>
                  {d.subject_type}/{d.subject_id}
                </dd>
              </div>
              <div>
                <dt>{t("metaExpire")}</dt>
                <dd>{d.expire_at}</dd>
              </div>
              <div>
                <dt>{t("metaConfidence")}</dt>
                <dd>{d.confidence ?? "-"}</dd>
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
                <th>{t("colDoc")}</th>
                <th>{t("colSubject")}</th>
                <th>{t("colExpire")}</th>
                <th>{t("colDocStatus")}</th>
                <th>{t("colConfidence")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td>{docTypeLabel(t, d.doc_type)}</td>
                  <td className="muted cell-wrap">
                    {d.subject_type}/{d.subject_id}
                  </td>
                  <td className="nowrap">{d.expire_at}</td>
                  <td>
                    <span className={`pill ${d.expired ? "bad" : "warn"}`}>
                      {d.expired ? t("expired") : t("expiringSoon")}
                    </span>
                  </td>
                  <td>{d.confidence ?? "-"}</td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    {t("noDocsInWindow")}
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
