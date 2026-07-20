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
      <div className="portal-hero">
        <p className="muted" style={{ marginBottom: 8 }}>
          Carrier Gate Safety{pagesDemo ? " · GitHub Pages 演示" : ""}
        </p>
        <h1>承运商到离场 · 安全准入</h1>
        <p className="muted" style={{ maxWidth: 560, lineHeight: 1.6 }}>
          三端分工：司机办事、门岗放行、后台治理。道闸 / LPR / 地磅已预留设备层。
          {pagesDemo ? " 当前为浏览器内演示数据。" : ""}
        </p>
      </div>

      <div className="portal-cards">
        <Link className="card" to="/login?role=driver">
          <strong>司机 / 自提</strong>
          <p className="muted">培训答题、证件 OCR、预约报到与离场</p>
        </Link>
        <Link className="card" to="/login?role=gate">
          <strong>门岗作业台</strong>
          <p className="muted">待办队列、安检清单、开闸放行、在场盯梢</p>
        </Link>
        <Link className="card" to="/login?role=admin">
          <strong>管理后台</strong>
          <p className="muted">运营看板、台账、证件到期、主数据、审计</p>
        </Link>
      </div>

      {user && (
        <p className="muted" style={{ marginTop: 20 }}>
          当前已登录：{user.name}（{user.role}） ·{" "}
          <Link to={homeFor(user)}>进入工作台</Link>
        </p>
      )}
    </div>
  );
}
