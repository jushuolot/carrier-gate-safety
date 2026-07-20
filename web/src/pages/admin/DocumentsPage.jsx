import { useEffect, useState } from "react";
import { api } from "../../api";

export default function DocumentsPage() {
  const [items, setItems] = useState([]);
  const [days, setDays] = useState(30);

  useEffect(() => {
    api(`/documents/expiring?days=${days}`)
      .then((d) => setItems(d.items))
      .catch(console.error);
  }, [days]);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>证件到期</h2>
      <p className="muted">后台催办补证与风险看板。门岗侧只看到放行时的拦截结果，不在此维护。</p>
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 12 }}>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7 天内</option>
          <option value={14}>14 天内</option>
          <option value={30}>30 天内</option>
          <option value={90}>90 天内</option>
        </select>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th>证件</th>
              <th>主体</th>
              <th>到期日</th>
              <th>状态</th>
              <th>置信度</th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr key={d.id}>
                <td>{d.label}</td>
                <td>
                  {d.subject_type}/{d.subject_id}
                </td>
                <td>{d.expire_at}</td>
                <td>
                  <span className={`pill ${d.expired ? "bad" : "warn"}`}>
                    {d.expired ? "已过期" : "即将到期"}
                  </span>
                </td>
                <td>{d.confidence ?? "-"}</td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={5} className="muted">
                  窗口内无到期证件
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
