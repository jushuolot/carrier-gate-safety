import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearSession } from "./api";
import { useI18n } from "./i18n/I18nContext";

export function LogoutButton() {
  const nav = useNavigate();
  const { t } = useI18n();
  return (
    <button
      className="btn btn-ghost"
      type="button"
      onClick={() => {
        clearSession();
        nav("/");
      }}
    >
      {t("logout")}
    </button>
  );
}

export function NavLink({ to, children, end }) {
  const loc = useLocation();
  const active = end
    ? loc.pathname === to
    : loc.pathname === to || loc.pathname.startsWith(`${to}/`);
  return (
    <Link to={to} className={active ? "active" : ""}>
      {children}
    </Link>
  );
}
