import { useEffect, useState } from "react";
import { api } from "../../api";
import { useI18n } from "../../i18n/I18nContext";
import { formatDateTime } from "../../i18n/labels";

export default function DevicesPage() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const d = await api("/devices");
    setItems(d.items);
    try {
      const e = await api("/device-events");
      setEvents(e.items);
    } catch {
      setEvents([]);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function exec(id, cmd) {
    try {
      const r = await api(`/devices/${id}/execute`, {
        method: "POST",
        body: { cmd, params: {} },
      });
      setMsg(JSON.stringify(r.result));
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  function actions(d) {
    if (!d.online) return null;
    if (d.type === "barrier") {
      return (
        <>
          <button className="btn" type="button" onClick={() => exec(d.id, "open")}>
            {t("openGate")}
          </button>
          <button className="btn" type="button" onClick={() => exec(d.id, "close")}>
            {t("closeGate")}
          </button>
        </>
      );
    }
    if (d.type === "lpr") {
      return (
        <button className="btn" type="button" onClick={() => exec(d.id, "capture")}>
          {t("capturePlate")}
        </button>
      );
    }
    if (d.type === "weighbridge") {
      return (
        <button className="btn" type="button" onClick={() => exec(d.id, "read")}>
          {t("readScale")}
        </button>
      );
    }
    if (d.type === "camera") {
      return (
        <button className="btn" type="button" onClick={() => exec(d.id, "snapshot")}>
          {t("snapshot")}
        </button>
      );
    }
    return null;
  }

  return (
    <div className="page-block">
      <header className="page-head">
        <h2>{t("pageDevices")}</h2>
        <p className="muted">{t("devicesSubtitle")}</p>
      </header>

      <ul className="record-list mobile-only">
        {items.map((d) => (
          <li key={d.id} className="card record-card">
            <div className="record-card-top">
              <strong>{d.name}</strong>
              <span className={`pill ${d.online ? "ok" : "bad"}`}>
                {d.online ? t("online") : t("offlinePending")}
              </span>
            </div>
            <p className="record-sub muted">
              {d.type} · {d.id}
            </p>
            <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
              {actions(d)}
            </div>
          </li>
        ))}
      </ul>

      <div className="card desk-only table-panel">
        <div className="table-scroll">
          <table className="table table-comfortable">
            <thead>
              <tr>
                <th>{t("colDevice")}</th>
                <th>{t("colDevType")}</th>
                <th>{t("colDevStatus")}</th>
                <th>{t("colAction")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="cell-stack">
                      <strong>{d.name}</strong>
                      <span className="muted">{d.id}</span>
                    </div>
                  </td>
                  <td>{d.type}</td>
                  <td>
                    <span className={`pill ${d.online ? "ok" : "bad"}`}>
                      {d.online ? t("online") : t("offlinePending")}
                    </span>
                  </td>
                  <td>
                    <div className="row" style={{ flexWrap: "wrap" }}>
                      {actions(d)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {msg && <pre className="result-pre">{msg}</pre>}
      </div>

      {msg && <pre className="result-pre mobile-only">{msg}</pre>}

      <section className="card panel-card" style={{ marginTop: 12 }}>
        <div className="panel-card-head">
          <strong>{t("eventStream")}</strong>
          <span className="muted">{t("countItems", { n: events.length })}</span>
        </div>

        <ul className="entity-list mobile-only">
          {!events.length && <li className="muted">{t("noEvents")}</li>}
          {events.map((e) => (
            <li key={e.id} className="entity-row entity-row-stack">
              <div className="entity-main">
                <div className="entity-primary">{e.event_type}</div>
                <div className="entity-secondary">
                  {e.device_type}/{e.device_id} · {formatDateTime(lang, e.created_at, { second: "2-digit" })}
                </div>
                <div className="mono-soft muted" style={{ marginTop: 4, fontSize: 12 }}>
                  {JSON.stringify(e.payload)}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="table-scroll desk-only">
          <table className="table table-comfortable">
            <thead>
              <tr>
                <th>{t("colTime")}</th>
                <th>{t("colDevice")}</th>
                <th>{t("colEvent")}</th>
                <th>{t("colPayload")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">{formatDateTime(lang, e.created_at, { second: "2-digit" })}</td>
                  <td className="cell-wrap">
                    {e.device_type}/{e.device_id}
                  </td>
                  <td>{e.event_type}</td>
                  <td className="muted mono-soft cell-wrap">{JSON.stringify(e.payload)}</td>
                </tr>
              ))}
              {!events.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    {t("noEvents")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
