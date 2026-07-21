import { useEffect, useState } from "react";
import { api } from "../../api";
import { useI18n } from "../../i18n/I18nContext";
import { formatDateTime, reasonLabel, statusLabel, visitTypeLabel } from "../../i18n/labels";

const STATUS_KEYS = [
  "appointed",
  "access_pending",
  "inspecting",
  "exception_requested",
  "onsite",
  "departing",
  "completed",
  "rejected",
];

const TYPE_IDS = ["", "carrier_inbound", "carrier_outbound", "self_pickup", "temporary"];

function subjectOf(v) {
  if (v.visit_type === "self_pickup") {
    return { title: v.customer_name || "-", sub: v.pickup_ref || "-" };
  }
  return { title: v.plate_no || "-", sub: v.driver_name || "-" };
}

export default function Visits() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [plate, setPlate] = useState("");
  const [pickupRef, setPickupRef] = useState("");
  const [archiveKey, setArchiveKey] = useState("");

  async function load() {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (type) q.set("type", type);
    if (plate.trim()) q.set("plate", plate.trim());
    if (pickupRef.trim()) q.set("pickupRef", pickupRef.trim());
    if (archiveKey.trim()) q.set("archiveKey", archiveKey.trim());
    const qs = q.toString();
    const data = await api(`/visits${qs ? `?${qs}` : ""}`);
    setItems(data.items);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [status, type]);

  return (
    <div className="page-block">
      <header className="page-head">
        <h2>{t("pageVisits")}</h2>
        <p className="muted">{t("visitsFilterHint")}</p>
      </header>

      <div className="card filters-card">
        <div className="filters-grid">
          <div className="field">
            <label>{t("filterType")}</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {TYPE_IDS.map((id) => (
                <option key={id || "all"} value={id}>
                  {id ? visitTypeLabel(t, id) : t("filterAllTypes")}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t("filterStatus")}</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t("filterAllStatus")}</option>
              {STATUS_KEYS.map((k) => (
                <option key={k} value={k}>
                  {statusLabel(t, k)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t("filterPlate")}</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder={t("placeholderPlate")} />
          </div>
          <div className="field">
            <label>{t("filterDn")}</label>
            <input value={pickupRef} onChange={(e) => setPickupRef(e.target.value)} placeholder={t("placeholderDn")} />
          </div>
          <div className="field">
            <label>{t("filterArchive")}</label>
            <input
              value={archiveKey}
              onChange={(e) => setArchiveKey(e.target.value)}
              placeholder={t("placeholderArchive")}
            />
          </div>
          <div className="filters-actions">
            <button className="btn primary btn-block" type="button" onClick={() => load().catch(console.error)}>
              {t("search")}
            </button>
          </div>
        </div>
      </div>

      <ul className="record-list mobile-only">
        {!items.length && (
          <li className="card muted" style={{ textAlign: "center" }}>
            {t("noRecords")}
          </li>
        )}
        {items.map((v) => {
          const subj = subjectOf(v);
          const reasons = (v.block_reasons || []).map((r) => reasonLabel(t, r)).join("；");
          return (
            <li key={v.id} className="card record-card">
              <div className="record-card-top">
                <span className="pill">{visitTypeLabel(t, v.visit_type)}</span>
                <span className="pill">{statusLabel(t, v.status)}</span>
              </div>
              <strong className="record-title">{subj.title}</strong>
              <p className="record-sub muted">{subj.sub}</p>
              <dl className="record-meta">
                <div>
                  <dt>{t("metaCarrier")}</dt>
                  <dd>{v.visit_type === "self_pickup" ? v.customer_phone || "-" : v.carrier_name || "-"}</dd>
                </div>
                <div>
                  <dt>{t("metaArchive")}</dt>
                  <dd>{v.archive_key || "-"}</dd>
                </div>
                <div>
                  <dt>{t("metaUpdated")}</dt>
                  <dd>{formatDateTime(lang, v.updated_at)}</dd>
                </div>
                {reasons ? (
                  <div className="record-meta-full">
                    <dt>{t("metaBlock")}</dt>
                    <dd>{reasons}</dd>
                  </div>
                ) : null}
              </dl>
            </li>
          );
        })}
      </ul>

      <div className="card desk-only table-panel">
        <div className="table-scroll">
          <table className="table table-comfortable">
            <thead>
              <tr>
                <th>{t("colType")}</th>
                <th>{t("colStatus")}</th>
                <th>{t("colSubject")}</th>
                <th>{t("colCarrier")}</th>
                <th>{t("colArchive")}</th>
                <th>{t("colUpdated")}</th>
                <th>{t("colBlockReason")}</th>
              </tr>
            </thead>
            <tbody>
              {!items.length && (
                <tr>
                  <td colSpan={7} className="muted">
                    {t("noRecords")}
                  </td>
                </tr>
              )}
              {items.map((v) => {
                const subj = subjectOf(v);
                return (
                  <tr key={v.id}>
                    <td>
                      <span className="pill">{visitTypeLabel(t, v.visit_type)}</span>
                    </td>
                    <td>
                      <span className="pill">{statusLabel(t, v.status)}</span>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <span>{subj.title}</span>
                        <span className="muted">{subj.sub}</span>
                      </div>
                    </td>
                    <td className="cell-wrap">
                      {v.visit_type === "self_pickup" ? v.customer_phone || "-" : v.carrier_name || "-"}
                    </td>
                    <td className="muted cell-wrap">{v.archive_key || "-"}</td>
                    <td className="nowrap">{formatDateTime(lang, v.updated_at)}</td>
                    <td className="muted cell-wrap">
                      {(v.block_reasons || []).map((r) => reasonLabel(t, r)).join("；") || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
