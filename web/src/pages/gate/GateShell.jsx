import { Outlet, Navigate } from "react-router-dom";
import { getUser } from "../../api";
import { LogoutButton, NavLink } from "../../components";

/** 门岗作业台：只做现场放行，不做后台治理 */
export default function GateShell() {
  const user = getUser();
  if (!user) return <Navigate to="/login?role=gate" replace />;

  return (
    <div className="layout">
      <aside className="side" style={{ background: "#1b4332" }}>
        <h1>门岗作业台</h1>
        <p style={{ fontSize: 12, color: "#95d5b2", margin: "0 0 14px", padding: "0 12px" }}>
          现场核验 · 放行拒入 · 道闸联调
        </p>
        <NavLink to="/gate">待办队列</NavLink>
        <NavLink to="/gate/onsite">当前在场</NavLink>
        <div style={{ marginTop: 24, fontSize: 12, color: "#95d5b2", padding: "0 12px" }}>
          {user.name} · 门岗班次
        </div>
        {(user.role === "admin" || user.role === "ehs") && (
          <div style={{ marginTop: 16, padding: "0 12px" }}>
            <NavLink to="/admin">返回管理后台</NavLink>
          </div>
        )}
      </aside>
      <main className="main">
        <div className="topbar">
          <div>
            <strong>华东一号仓 · 一号门</strong>
            <span className="muted"> · 仅处理当班放行，台账与规则请走后台</span>
          </div>
          <LogoutButton />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
