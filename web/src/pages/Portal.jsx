import { Link } from "react-router-dom";
import { getUser } from "../api";
import { isPagesDemo } from "../mockApi";

function homeFor(user) {
  if (!user) return "/login";
  if (user.role === "driver") return "/driver";
  if (user.role === "gate") return "/gate";
  return "/admin";
}

export default function Portal() {
  const user = getUser();
  const pagesDemo = isPagesDemo();
  return (
    <div className="portal">
      <div className="portal-kicker">
        <span className="mark" aria-hidden />
        Gate Safety
        {pagesDemo ? " · Demo" : ""}
      </div>

      <div className="portal-hero">
        <h1>承运商安全准入管理系统</h1>
      </div>

      <div className="portal-cards">
        <Link className="card" to="/login?role=driver">
          <div className="tag">Driver</div>
          <strong>司机 / 自提</strong>
          <p className="muted">培训答题、证件识别、预约报到</p>
        </Link>
        <Link className="card" to="/login?role=gate">
          <div className="tag">Gate</div>
          <strong>门岗作业台</strong>
          <p className="muted">待办队列、安检清单、当班放行</p>
        </Link>
        <Link className="card" to="/login?role=admin">
          <div className="tag">Admin</div>
          <strong>管理后台</strong>
          <p className="muted">看板、台账、资质风险、审计</p>
        </Link>
      </div>

      {user && (
        <p className="portal-foot">
          {user.name} · {user.role} · <Link to={homeFor(user)}>继续工作台</Link>
        </p>
      )}
    </div>
  );
}
