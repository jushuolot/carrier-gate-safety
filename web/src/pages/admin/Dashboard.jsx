import { useEffect, useState } from "react";
import { api } from "../../api";

export default function Dashboard() {
  const [dash, setDash] = useState(null);
  const [onsite, setOnsite] = useState([]);

  useEffect(() => {
    (async () => {
      setDash(await api("/dashboard"));
      const v = await api("/visits?status=onsite");
      setOnsite(v.items);
    })().catch(console.error);
  }, []);

  if (!dash) return <p className="muted">加载中…</p>;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>运行总览</h2>
      <div className="grid stats">
        <div className="card stat">
          <div className="l">在场车辆</div>
          <div className="v">{dash.onsite}</div>
        </div>
        <div className="card stat">
          <div className="l">今日到访单</div>
          <div className="v">{dash.todayAppointed}</div>
        </div>
        <div className="card stat">
          <div className="l">今日拦截/待准入</div>
          <div className="v">{dash.blocked}</div>
        </div>
        <div className="card stat">
          <div className="l">30 天内到期证件</div>
          <div className="v">{dash.expiring30d}</div>
        </div>
        <div className="card stat">
          <div className="l">已过期证件</div>
          <div className="v">{dash.expired}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <strong>当前在场</strong>
        <table className="table">
          <thead>
            <tr>
              <th>车牌</th>
              <th>司机</th>
              <th>承运商</th>
              <th>入场时间</th>
            </tr>
          </thead>
          <tbody>
            {onsite.map((v) => (
              <tr key={v.id}>
                <td>{v.plate_no}</td>
                <td>{v.driver_name}</td>
                <td>{v.carrier_name}</td>
                <td>{v.onsite_at || "-"}</td>
              </tr>
            ))}
            {!onsite.length && (
              <tr>
                <td colSpan={4} className="muted">
                  暂无在场车辆
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
