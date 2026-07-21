import { Outlet, Navigate } from "react-router-dom";
import { getUser } from "../../api";
import { LogoutButton, NavLink } from "../../components";
import BrandMark from "../../components/BrandMark";
import { demoName } from "../../i18n/content";
import { LangSwitch, useI18n } from "../../i18n/I18nContext";

export default function AdminShell() {
  const user = getUser();
  const { t, lang } = useI18n();
  if (!user) return <Navigate to="/login?role=admin" replace />;
  if (user.role === "gate") return <Navigate to="/gate" replace />;

  const isOps = user.role === "admin" || user.role === "ehs";
  const isCarrier = user.role === "carrier_admin";

  return (
    <div className="layout">
      <aside className="side">
        <div className="brand">
          <BrandMark className="brand-mark" />
          <div className="brand-text">
            <strong>{t("brand")}</strong>
            <span>{t("brandAlt")}</span>
          </div>
        </div>
        <p className="side-caption">{t("nav")}</p>
        <NavLink to="/admin" end>
          {t("navDashboard")}
        </NavLink>
        <NavLink to="/admin/visits">{t("navVisits")}</NavLink>
        {!isCarrier && <NavLink to="/admin/documents">{t("navDocuments")}</NavLink>}
        <NavLink to="/admin/masters">{t("navMasters")}</NavLink>
        {isOps && <NavLink to="/admin/devices">{t("navDevices")}</NavLink>}
        {isOps && <NavLink to="/admin/audit">{t("navAudit")}</NavLink>}
        {isOps && (
          <>
            <p className="side-caption">{t("navSupervise")}</p>
            <NavLink to="/gate">{t("navGate")}</NavLink>
          </>
        )}
        <div className="side-lang">
          <LangSwitch className="lang-switch-side" />
        </div>
        <div className="side-meta">
          {demoName(lang, user.id, user.name)}
          <br />
          {roleLabel(user.role, t)}
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="topbar-brand">
            <strong className="brand-inline">{t("brand")}</strong>
            <span className="muted topbar-site"> · {t("siteLabel")}</span>
          </div>
          <div className="topbar-actions">
            <LangSwitch className="lang-switch-light desk-lang" />
            <LogoutButton />
          </div>
        </div>
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="tabs">
        <NavLink to="/admin" end>
          {t("tabDash")}
        </NavLink>
        <NavLink to="/admin/visits">{t("tabVisits")}</NavLink>
        {!isCarrier && <NavLink to="/admin/documents">{t("tabDocs")}</NavLink>}
        <NavLink to="/admin/masters">{t("tabMasters")}</NavLink>
        {isOps && <NavLink to="/admin/devices">{t("tabDevices")}</NavLink>}
      </nav>
    </div>
  );
}

function roleLabel(role, t) {
  return (
    {
      admin: t("roleAdmin"),
      ehs: t("roleEhs"),
      carrier_admin: t("roleCarrier"),
    }[role] || role
  );
}
