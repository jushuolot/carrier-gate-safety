import { useEffect, useState } from "react";
import { api } from "../../api";

const STATUS_LABEL = {
  appointed: "已预约",
  checked_in: "已报到",
  access_pending: "待准入",
  inspecting: "安检中",
  exception_requested: "待双签",
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
        <div>
          <h2 style={{ margin: 0 }}>到离场台账</h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            事后查询与导出用。当班放行请到门岗作业台，勿在此开闸。
          </p>
        </div>
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
              <th>类型</th>
              <th>状态</th>
              <th>对象</th>
              <th>承运商/客户</th>
              <th>更新时间</th>
              <th>拦截原因</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id}>
                <td>
                  <span className="pill">{v.visit_type_label || v.visit_type || "承运"}</span>
                </td>
                <td>
                  <span className="pill">{STATUS_LABEL[v.status] || v.status}</span>
                </td>
                <td>
                  {v.visit_type === "self_pickup" ? (
                    <>
                      {v.customer_name || "-"}
                      <div className="muted">{v.pickup_ref}</div>
                    </>
                  ) : (
                    <>
                      {v.plate_no}
                      <div className="muted">{v.driver_name}</div>
                    </>
                  )}
                </td>
                <td>{v.visit_type === "self_pickup" ? v.customer_phone || "-" : v.carrier_name}</td>
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
