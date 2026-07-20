import { Link } from "react-router-dom";
import { getUser } from "../api";

export default function Portal() {
  const user = getUser();
  return (
    <div className="portal">
      <div className="portal-hero">
        <p className="muted" style={{ marginBottom: 8 }}>
          Carrier Gate Safety
        </p>
        <h1>承运商到离场 · 安全准入</h1>
        <p className="muted" style={{ maxWidth: 560, lineHeight: 1.6 }}>
          培训过关 → 资质有效 → 安检放行 → 离场收口。道闸 / 车牌识别 / 地磅已预留设备适配层。
        </p>
      </div>

      <div className="portal-cards">
        <Link className="card" to="/login?role=driver">
          <strong>司机端</strong>
          <p className="muted">培训答题、证件 OCR、报到与离场</p>
        </Link>
        <Link className="card" to="/login?role=gate">
          <strong>门岗 / 安检</strong>
          <p className="muted">核验放行、检查清单、例外申请</p>
        </Link>
        <Link className="card" to="/login?role=admin">
          <strong>管理后台</strong>
          <p className="muted">看板、证件到期、设备、审计</p>
        </Link>
      </div>

      {user && (
        <p className="muted" style={{ marginTop: 20 }}>
          当前已登录：{user.name}（{user.role}） ·{" "}
          <Link to={user.role === "driver" ? "/driver" : "/admin"}>进入工作台</Link>
        </p>
      )}
    </div>
  );
}
