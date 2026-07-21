import { Outlet, Navigate } from "react-router-dom";
import { getUser } from "../../api";
import { LogoutButton, NavLink } from "../../components";
import { LangSwitch, useI18n } from "../../i18n/I18nContext";

export default function GateShell() {
  const user = getUser();
  const { t } = useI18n();
  if (!user) return <Navigate to="/login?role=gate" replace />;

  return (
    <div className="layout">
      <aside className="side side-gate">
        <div className="brand">
          <div className="brand-mark" aria-hidden />
          <div className="brand-text">
            <strong>{t("brand")}</strong>
            <span>{t("brandEn")}</span>
          </div>
        </div>
        <p className="side-caption">{t("gateOps")}</p>
        <NavLink to="/gate" end>
          {t("tabQueueLong")}
        </NavLink>
        <NavLink to="/gate/onsite">{t("tabOnsiteLong")}</NavLink>
        <div className="side-lang">
          <LangSwitch className="lang-switch-side" />
        </div>
        <div className="side-meta">
          {user.name}
          <br />
          {t("gateShift")}
        </div>
        {(user.role === "admin" || user.role === "ehs") && (
          <div className="side-extra">
            <NavLink to="/admin">{t("backAdmin")}</NavLink>
          </div>
        )}
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="topbar-brand">
            <strong className="brand-inline">{t("brand")}</strong>
            <span className="muted topbar-site"> · {t("gateSite")}</span>
          </div>
          <div className="topbar-actions">
            <LangSwitch className="lang-switch-light desk-lang" />
            <LogoutButton />
          </div>
        </div>
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="tabs">
        <NavLink to="/gate" end>
          {t("tabQueue")}
        </NavLink>
        <NavLink to="/gate/onsite">{t("tabOnsite")}</NavLink>
        {(user.role === "admin" || user.role === "ehs") && (
          <NavLink to="/admin">{t("tabAdmin")}</NavLink>
        )}
      </nav>
    </div>
  );
}
