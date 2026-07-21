import { useEffect, useState } from "react";
import { api } from "../../api";

function formatAt(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(iso).slice(0, 19);
  }
}

export default function AuditPage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/audit")
      .then((d) => setItems(d.items))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="page-block">
      <header className="page-head">
        <h2>审计日志</h2>
        <p className="muted">关键操作留痕，可按时间追溯。</p>
      </header>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}

      <ul className="record-list mobile-only">
        {!items.length && !err && <li className="card muted">暂无日志</li>}
        {items.map((a) => (
          <li key={a.id} className="card record-card">
            <div className="record-card-top">
              <strong>{a.action}</strong>
              <span className="muted">{formatAt(a.created_at)}</span>
            </div>
            <dl className="record-meta">
              <div>
                <dt>操作者</dt>
                <dd>{a.actor_name || "-"}</dd>
              </div>
              <div>
                <dt>对象</dt>
                <dd className="cell-wrap">
                  {a.entity_type}/{a.entity_id}
                </dd>
              </div>
              <div className="record-meta-full">
                <dt>详情</dt>
                <dd className="mono-soft">{JSON.stringify(a.detail)}</dd>
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
                <th>时间</th>
                <th>操作者</th>
                <th>动作</th>
                <th>对象</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="nowrap">{formatAt(a.created_at)}</td>
                  <td>{a.actor_name}</td>
                  <td>{a.action}</td>
                  <td className="cell-wrap">
                    {a.entity_type}/{a.entity_id}
                  </td>
                  <td className="muted mono-soft cell-wrap">{JSON.stringify(a.detail)}</td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    暂无日志
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
