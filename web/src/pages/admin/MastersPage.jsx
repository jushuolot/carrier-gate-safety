import { useEffect, useState } from "react";
import { api } from "../../api";
import { useI18n } from "../../i18n/I18nContext";

function EntityList({ title, items, empty = "暂无数据" }) {
  return (
    <section className="card panel-card">
      <div className="panel-card-head">
        <strong>{title}</strong>
        <span className="muted">{items.length} 条</span>
      </div>
      {!items.length ? (
        <p className="muted" style={{ margin: "12px 0 0" }}>
          {empty}
        </p>
      ) : (
        <ul className="entity-list">
          {items.map((it) => (
            <li key={it.id} className="entity-row">
              <div className="entity-main">
                <div className="entity-primary">{it.primary}</div>
                {it.secondary ? <div className="entity-secondary">{it.secondary}</div> : null}
              </div>
              {it.badge ? (
                <span className={`pill ${it.badgeTone || ""}`}>{it.badge}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function MastersPage() {
  const { t } = useI18n();
  const [carriers, setCarriers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    (async () => {
      setCarriers((await api("/carriers")).items);
      setDrivers((await api("/drivers")).items);
      setVehicles((await api("/vehicles")).items);
    })().catch(console.error);
  }, []);

  return (
    <div className="page-block">
      <header className="page-head">
        <h2>{t("pageMasters")}</h2>
        <p className="muted">Org / driver / vehicle</p>
      </header>

      <div className="masters-grid">
        <EntityList
          title="承运商"
          items={carriers.map((c) => ({
            id: c.id,
            primary: c.name,
            secondary: c.credit_code || c.id,
            badge: c.status === "active" ? "正常" : c.status,
            badgeTone: c.status === "active" ? "ok" : "warn",
          }))}
        />
        <EntityList
          title="司机"
          items={drivers.map((d) => ({
            id: d.id,
            primary: d.name,
            secondary: d.phone,
            badge: d.status === "active" ? "在册" : d.status,
            badgeTone: d.status === "active" ? "ok" : "warn",
          }))}
        />
        <EntityList
          title="车辆"
          items={vehicles.map((v) => ({
            id: v.id,
            primary: v.plate_no,
            secondary: v.vehicle_type || "-",
            badge: v.status === "active" ? "可用" : v.status,
            badgeTone: v.status === "active" ? "ok" : "warn",
          }))}
        />
      </div>
    </div>
  );
}
