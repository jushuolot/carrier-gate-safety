import { useEffect, useState } from "react";
import { api } from "../../api";

const STATUS_LABEL = {
  appointed: "已预约",
  checked_in: "已报到",
  access_pending: "待准入",
  inspecting: "安检中",
  onsite: "在场",
  departing: "离场中",
  completed: "已完成",
  rejected: "已拒绝",
};

export default function Visits() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");

  async function load() {
    const q = status ? `?status=${status}` : "";
    const data = await api(`/visits${q}`);
    setItems(data.items);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [status]);

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>到离场单</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">全部</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th>状态</th>
              <th>车牌</th>
              <th>司机</th>
              <th>承运商</th>
              <th>更新时间</th>
              <th>拦截原因</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id}>
                <td>
                  <span className="pill">{STATUS_LABEL[v.status] || v.status}</span>
                </td>
                <td>{v.plate_no}</td>
                <td>
                  {v.driver_name}
                  <div className="muted">{v.driver_phone}</div>
                </td>
                <td>{v.carrier_name}</td>
                <td>{v.updated_at}</td>
                <td className="muted" style={{ maxWidth: 240 }}>
                  {(v.block_reasons || []).map((r) => r.message).join("；") || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
