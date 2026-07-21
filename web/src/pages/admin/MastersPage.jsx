import { useEffect, useState } from "react";
import { api } from "../../api";
import { demoName, demoVehicleType } from "../../i18n/content";
import { useI18n } from "../../i18n/I18nContext";

function EntityList({ title, items, empty }) {
  const { t } = useI18n();
  return (
    <section className="card panel-card">
      <div className="panel-card-head">
        <strong>{title}</strong>
        <span className="muted">{t("countItems", { n: items.length })}</span>
      </div>
      {!items.length ? (
        <p className="muted" style={{ margin: "12px 0 0" }}>
          {empty || t("noData")}
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
  const { t, lang } = useI18n();
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
        <p className="muted">{t("mastersSubtitle")}</p>
      </header>

      <div className="masters-grid">
        <EntityList
          title={t("carrierTitle")}
          items={carriers.map((c) => ({
            id: c.id,
            primary: demoName(lang, c.id, c.name),
            secondary: c.credit_code || c.id,
            badge: c.status === "active" ? t("badgeActive") : c.status,
            badgeTone: c.status === "active" ? "ok" : "warn",
          }))}
        />
        <EntityList
          title={t("driverTitle")}
          items={drivers.map((d) => ({
            id: d.id,
            primary: demoName(lang, d.id, d.name),
            secondary: d.phone,
            badge: d.status === "active" ? t("badgeRegistered") : d.status,
            badgeTone: d.status === "active" ? "ok" : "warn",
          }))}
        />
        <EntityList
          title={t("vehicleTitle")}
          items={vehicles.map((v) => ({
            id: v.id,
            primary: v.plate_no,
            secondary: demoVehicleType(lang, v.vehicle_type) || "-",
            badge: v.status === "active" ? t("badgeAvailable") : v.status,
            badgeTone: v.status === "active" ? "ok" : "warn",
          }))}
        />
      </div>
    </div>
  );
}
