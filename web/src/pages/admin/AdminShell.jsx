import { Outlet, Navigate } from "react-router-dom";
import { getUser } from "../../api";
import { LogoutButton, NavLink } from "../../components";

/**
 * 管理后台：规则、台账、资质、设备与审计
 * 不做当班放行（放行在 /gate）
 */
export default function AdminShell() {
  const user = getUser();
  if (!user) return <Navigate to="/login?role=admin" replace />;
  if (user.role === "gate") return <Navigate to="/gate" replace />;

  const isOps = user.role === "admin" || user.role === "ehs";
  const isCarrier = user.role === "carrier_admin";

  return (
    <div className="layout">
      <aside className="side">
        <h1>管理后台</h1>
        <p style={{ fontSize: 12, color: "#829ab1", margin: "0 0 14px", padding: "0 12px" }}>
          治理 · 台账 · 资质 · 审计
        </p>
        <NavLink to="/admin">运营看板</NavLink>
        <NavLink to="/admin/visits">到离场台账</NavLink>
        {!isCarrier && <NavLink to="/admin/documents">证件到期</NavLink>}
        <NavLink to="/admin/masters">主数据</NavLink>
        {isOps && <NavLink to="/admin/devices">设备与对接</NavLink>}
        {isOps && <NavLink to="/admin/audit">审计日志</NavLink>}
        {isOps && (
          <>
            <div style={{ height: 12 }} />
            <NavLink to="/gate">督导 · 门岗作业台</NavLink>
          </>
        )}
        <div style={{ marginTop: 24, fontSize: 12, color: "#829ab1", padding: "0 12px" }}>
          {user.name} · {roleLabel(user.role)}
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <strong>华东一号仓 · 管理域</strong>
            <span className="muted"> · 现场放行请使用门岗作业台</span>
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
      admin: "系统管理员",
      ehs: "EHS",
      carrier_admin: "承运商管理员",
    }[role] || role
  );
}
