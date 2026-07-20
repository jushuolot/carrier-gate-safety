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
        Gate Safety · Merck LS visual language
        {pagesDemo ? " · Pages demo" : ""}
      </div>

      <div className="portal-hero">
        <h1>承运商到离场 · 安全准入</h1>
        <p className="lede">
          以科学运营的精度管理厂区准入：培训过关、资质有效、安检放行、离场收口。
          三端分工清晰——司机办事、门岗放行、后台治理。
        </p>
      </div>

      <div className="portal-cards">
        <Link className="card" to="/login?role=driver">
          <div className="tag">Field · Driver</div>
          <strong>司机 / 自提</strong>
          <p className="muted">培训答题、证件 OCR、预约报到与离场</p>
        </Link>
        <Link className="card" to="/login?role=gate">
          <div className="tag">Ops · Gate</div>
          <strong>门岗作业台</strong>
          <p className="muted">待办队列、安检清单、开闸放行、在场盯梢</p>
        </Link>
        <Link className="card" to="/login?role=admin">
          <div className="tag">Control · Admin</div>
          <strong>管理后台</strong>
          <p className="muted">运营看板、台账、证件到期、主数据、审计</p>
        </Link>
      </div>

      {user && (
        <p className="portal-foot muted">
          当前会话：{user.name}（{user.role}） · <Link to={homeFor(user)}>进入工作台</Link>
        </p>
      )}
    </div>
  );
}
