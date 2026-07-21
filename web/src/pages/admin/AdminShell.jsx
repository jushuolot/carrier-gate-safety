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
            <strong>承运商安全</strong>
            <span>管理后台</span>
          </div>
        </div>
        <p className="side-caption">导航</p>
        <NavLink to="/admin" end>
          运营看板
        </NavLink>
        <NavLink to="/admin/visits">到离场台账</NavLink>
        {!isCarrier && <NavLink to="/admin/documents">证件到期</NavLink>}
        <NavLink to="/admin/masters">主数据</NavLink>
        {isOps && <NavLink to="/admin/devices">设备与对接</NavLink>}
        {isOps && <NavLink to="/admin/audit">审计日志</NavLink>}
        {isOps && (
          <>
            <p className="side-caption">督导</p>
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
            <strong className="brand-inline">承运商安全</strong>
            <span className="muted topbar-site"> · 华东一号仓</span>
          </div>
          <LogoutButton />
        </div>
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="底部导航">
        <NavLink to="/admin" end>
          看板
        </NavLink>
        <NavLink to="/admin/visits">台账</NavLink>
        {!isCarrier && <NavLink to="/admin/documents">证件</NavLink>}
        <NavLink to="/admin/masters">主数据</NavLink>
        {isOps && <NavLink to="/admin/devices">设备</NavLink>}
      </nav>
    </div>
  );
}

function roleLabel(role) {
  return (
    {
      admin: "系统管理员",
      ehs: "EHS 安全员",
      carrier_admin: "承运商管理员",
    }[role] || role
  );
}
