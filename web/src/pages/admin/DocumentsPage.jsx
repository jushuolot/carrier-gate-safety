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
    <div className="page-block">
      <header className="page-head page-head-row">
        <div>
          <h2>证件到期</h2>
          <p className="muted">后台催办补证。门岗侧只看到放行拦截结果。</p>
        </div>
        <div className="field field-inline">
          <label>窗口</label>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>7 天内</option>
            <option value={14}>14 天内</option>
            <option value={30}>30 天内</option>
            <option value={90}>90 天内</option>
          </select>
        </div>
      </header>

      <ul className="record-list mobile-only">
        {!items.length && <li className="card muted">窗口内无到期证件</li>}
        {items.map((d) => (
          <li key={d.id} className="card record-card">
            <div className="record-card-top">
              <strong>{d.label}</strong>
              <span className={`pill ${d.expired ? "bad" : "warn"}`}>
                {d.expired ? "已过期" : "即将到期"}
              </span>
            </div>
            <dl className="record-meta">
              <div>
                <dt>主体</dt>
                <dd>
                  {d.subject_type}/{d.subject_id}
                </dd>
              </div>
              <div>
                <dt>到期日</dt>
                <dd>{d.expire_at}</dd>
              </div>
              <div>
                <dt>置信度</dt>
                <dd>{d.confidence ?? "-"}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      <div className="card desk-only table-panel">
        <div className="table-scroll">
          <table className="table table-comfortable">
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
                  <td className="muted cell-wrap">
                    {d.subject_type}/{d.subject_id}
                  </td>
                  <td className="nowrap">{d.expire_at}</td>
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
    </div>
  );
}
