import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";

/** 后台看板：看风险与合规，不代替门岗放行 */
export default function Dashboard() {
  const user = getUser();
  const [dash, setDash] = useState(null);
  const [expiring, setExpiring] = useState([]);

  useEffect(() => {
    (async () => {
      setDash(await api("/dashboard"));
      const d = await api("/documents/expiring?days=14");
      setExpiring((d.items || []).slice(0, 8));
    })().catch(console.error);
  }, []);

  if (!dash) return <p className="muted">加载中…</p>;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>运营看板</h2>
      <p className="muted">
        关注资质风险与本日吞吐。
        {user?.role === "admin" || user?.role === "ehs" ? (
          <>
            {" "}
            当班安检/开闸请到 <Link to="/gate">门岗作业台</Link>。
          </>
        ) : (
          " 现场放行由门岗处理。"
        )}
      </p>

      <div className="grid stats">
        <div className="card stat">
          <div className="l">当前在场</div>
          <div className="v">{dash.onsite}</div>
        </div>
        <div className="card stat">
          <div className="l">今日到访</div>
          <div className="v">{dash.todayAppointed}</div>
        </div>
        <div className="card stat">
          <div className="l">今日拦截</div>
          <div className="v">{dash.blocked}</div>
        </div>
        <div className="card stat">
          <div className="l">30 天内到期</div>
          <div className="v">{dash.expiring30d}</div>
        </div>
        <div className="card stat">
          <div className="l">已过期证件</div>
          <div className="v">{dash.expired}</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
        <div className="card">
          <strong>近期证件风险</strong>
          <p className="muted">后台催办承运商补证；门岗只在放行时看拦截结果。</p>
          <table className="table">
            <thead>
              <tr>
                <th>证件</th>
                <th>主体</th>
                <th>到期</th>
              </tr>
            </thead>
            <tbody>
              {expiring.map((d) => (
                <tr key={d.id}>
                  <td>{d.label}</td>
                  <td className="muted">
                    {d.subject_type}/{d.subject_id}
                  </td>
                  <td>
                    <span className={`pill ${d.expired ? "bad" : "warn"}`}>{d.expire_at}</span>
                  </td>
                </tr>
              ))}
              {!expiring.length && (
                <tr>
                  <td colSpan={3} className="muted">
                    近 14 天无到期预警
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Link to="/admin/documents">查看全部到期 →</Link>
        </div>

        <div className="card">
          <strong>后台职责边界</strong>
          <ul style={{ marginTop: 10, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>配置与查看主数据、证件到期、审计证据</li>
            <li>查阅到离场台账（历史与筛选），不在此点开闸</li>
            <li>设备对接状态与厂商适配联调</li>
            <li>门岗负责：待办队列、安检清单、放行/拒绝</li>
          </ul>
          <div className="row" style={{ marginTop: 12 }}>
            <Link className="btn" to="/admin/visits">
              打开台账
            </Link>
            {(user?.role === "admin" || user?.role === "ehs") && (
              <Link className="btn" to="/admin/audit">
                审计日志
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
