import { Outlet, Navigate } from "react-router-dom";
import { getUser } from "../../api";
import { LogoutButton, NavLink } from "../../components";

export default function AdminShell() {
  const user = getUser();
  if (!user) return <Navigate to="/login?role=admin" replace />;
  if (user.role === "gate") return <Navigate to="/gate" replace />;

  const isOps = user.role === "admin" || user.role === "ehs";
  const isCarrier = user.role === "carrier_admin";

  return (
    <div className="layout">
      <aside className="side">
        <div className="brand">
          <div className="brand-mark" aria-hidden />
          <div className="brand-text">
            <strong>Gate Safety</strong>
            <span>管理后台</span>
          </div>
        </div>
        <p className="side-caption">导航</p>
        <NavLink to="/admin">运营看板</NavLink>
        <NavLink to="/admin/visits">到离场台账</NavLink>
        {!isCarrier && <NavLink to="/admin/documents">证件到期</NavLink>}
        <NavLink to="/admin/masters">主数据</NavLink>
        {isOps && <NavLink to="/admin/devices">设备与对接</NavLink>}
        {isOps && <NavLink to="/admin/audit">审计日志</NavLink>}
        {isOps && (
          <>
            <p className="side-caption" style={{ marginTop: 16 }}>
              督导
            </p>
            <NavLink to="/gate">门岗作业台</NavLink>
          </>
        )}
        <div className="side-meta">
          {user.name}
          <br />
          {roleLabel(user.role)}
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <strong>华东一号仓</strong>
            <span className="muted"> · 管理域</span>
          </div>
          <LogoutButton />
        </div>
        <Outlet />
      </main>
    </div>
  );
}

function roleLabel(role) {
  return (
    {
      admin: "System Admin",
      ehs: "EHS",
      carrier_admin: "Carrier Admin",
    }[role] || role
  );
}
