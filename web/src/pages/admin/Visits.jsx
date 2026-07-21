import { useEffect, useState } from "react";
import { api } from "../../api";

const STATUS_LABEL = {
  appointed: "已预约",
  access_pending: "待准入",
  inspecting: "安检中",
  exception_requested: "待双签",
  onsite: "在场",
  departing: "离场中",
  completed: "已完成",
  rejected: "已拒绝",
};

const TYPE_OPTIONS = [
  { id: "", label: "全部类型" },
  { id: "carrier_inbound", label: "运输入场" },
  { id: "carrier_outbound", label: "运输出场" },
  { id: "self_pickup", label: "客户自提" },
  { id: "temporary", label: "临时车辆" },
];

export default function Visits() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [plate, setPlate] = useState("");
  const [pickupRef, setPickupRef] = useState("");
  const [archiveKey, setArchiveKey] = useState("");

  async function load() {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (type) q.set("type", type);
    if (plate.trim()) q.set("plate", plate.trim());
    if (pickupRef.trim()) q.set("pickupRef", pickupRef.trim());
    if (archiveKey.trim()) q.set("archiveKey", archiveKey.trim());
    const qs = q.toString();
    const data = await api(`/visits${qs ? `?${qs}` : ""}`);
    setItems(data.items);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [status, type]);

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>到离场台账</h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            按业务类型 / 车牌 / DN / 归档号检索 · 归档格式 YYYYMMDD_车牌
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.id || "all"} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部状态</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 120 }}>
            <label>车牌</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="沪A…" />
          </div>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 120 }}>
            <label>DN / 提货单</label>
            <input value={pickupRef} onChange={(e) => setPickupRef(e.target.value)} placeholder="DN-" />
          </div>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 140 }}>
            <label>归档号</label>
            <input
              value={archiveKey}
              onChange={(e) => setArchiveKey(e.target.value)}
              placeholder="20260721_沪A12345"
            />
          </div>
          <button className="btn primary" type="button" onClick={() => load().catch(console.error)}>
            检索
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th>类型</th>
              <th>状态</th>
              <th>对象</th>
              <th>承运商/客户</th>
              <th>归档</th>
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
                <td className="muted">{v.archive_key || "-"}</td>
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
