import { useEffect, useState } from "react";
import { api } from "../../api";

export default function AuditPage() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/audit")
      .then((d) => setItems(d.items))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>审计日志</h2>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
      <div className="card">
        <table className="table">
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
                <td>{a.created_at}</td>
                <td>{a.actor_name}</td>
                <td>{a.action}</td>
                <td>
                  {a.entity_type}/{a.entity_id}
                </td>
                <td className="muted" style={{ fontSize: 12, maxWidth: 360 }}>
                  {JSON.stringify(a.detail)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
