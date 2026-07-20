import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearSession } from "./api";

export function LogoutButton() {
  const nav = useNavigate();
  return (
    <button
      className="btn"
      type="button"
      onClick={() => {
        clearSession();
        nav("/");
      }}
    >
      退出
    </button>
  );
}

export function NavLink({ to, children }) {
  const loc = useLocation();
  const active = loc.pathname === to || loc.pathname.startsWith(`${to}/`);
  return (
    <Link to={to} className={active ? "active" : ""}>
      {children}
    </Link>
  );
}
