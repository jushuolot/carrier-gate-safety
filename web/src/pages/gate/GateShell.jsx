import { Outlet, Navigate } from "react-router-dom";
import { getUser } from "../../api";
import { LogoutButton, NavLink } from "../../components";

export default function GateShell() {
  const user = getUser();
  if (!user) return <Navigate to="/login?role=gate" replace />;

  return (
    <div className="layout">
      <aside className="side side-gate">
        <div className="brand">
          <div className="brand-mark" aria-hidden />
          <div className="brand-text">
            <strong>Gate Safety</strong>
            <span>门岗作业</span>
          </div>
        </div>
        <p className="side-caption">当班</p>
        <NavLink to="/gate">待办队列</NavLink>
        <NavLink to="/gate/onsite">当前在场</NavLink>
        <div className="side-meta">
          {user.name}
          <br />
          门岗班次
        </div>
        {(user.role === "admin" || user.role === "ehs") && (
          <div style={{ padding: "0 4px" }}>
            <NavLink to="/admin">返回管理后台</NavLink>
          </div>
        )}
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <strong>一号门</strong>
            <span className="muted"> · 当班放行</span>
          </div>
          <LogoutButton />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
