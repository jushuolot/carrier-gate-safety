import { Outlet } from "react-router-dom";
import { getUser } from "../../api";
import { LogoutButton, NavLink } from "../../components";

export default function AdminShell() {
  const user = getUser();
  return (
    <div className="layout">
      <aside className="side">
        <h1>安全准入控制台</h1>
        <NavLink to="/admin">总览</NavLink>
        <NavLink to="/admin/gate">门岗核验</NavLink>
        <NavLink to="/admin/visits">到离场单</NavLink>
        <NavLink to="/admin/documents">证件到期</NavLink>
        <NavLink to="/admin/masters">主数据</NavLink>
        <NavLink to="/admin/devices">设备对接</NavLink>
        <NavLink to="/admin/audit">审计日志</NavLink>
        <div style={{ marginTop: 24, fontSize: 12, color: "#829ab1" }}>
          {user?.name} · {user?.role}
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <strong>华东一号仓</strong>
            <span className="muted"> · 正式运行（设备 mock）</span>
          </div>
          <LogoutButton />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
