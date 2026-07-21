import { useEffect, useState } from "react";
import { api } from "../../api";
import { useI18n } from "../../i18n/I18nContext";

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

function formatAt(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso).slice(0, 16);
  }
}

function subjectOf(v) {
  if (v.visit_type === "self_pickup") {
    return { title: v.customer_name || "-", sub: v.pickup_ref || "-" };
  }
  return { title: v.plate_no || "-", sub: v.driver_name || "-" };
}

export default function Visits() {
  const { t } = useI18n();
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
    <div className="page-block">
      <header className="page-head">
        <h2>{t("pageVisits")}</h2>
        <p className="muted">YYYYMMDD_plate · type / plate / DN / archive</p>
      </header>

      <div className="card filters-card">
        <div className="filters-grid">
          <div className="field">
            <label>业务类型</label>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {TYPE_OPTIONS.map((t) => (
                <option key={t.id || "all"} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>状态</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">全部状态</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>车牌</label>
            <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="沪A…" />
          </div>
          <div className="field">
            <label>DN / 提货单</label>
            <input value={pickupRef} onChange={(e) => setPickupRef(e.target.value)} placeholder="DN-" />
          </div>
          <div className="field">
            <label>归档号</label>
            <input
              value={archiveKey}
              onChange={(e) => setArchiveKey(e.target.value)}
              placeholder="20260721_沪A12345"
            />
          </div>
          <div className="filters-actions">
            <button className="btn primary btn-block" type="button" onClick={() => load().catch(console.error)}>
              检索
            </button>
          </div>
        </div>
      </div>

      {/* 手机 / 窄屏：卡片列表 */}
      <ul className="record-list mobile-only">
        {!items.length && (
          <li className="card muted" style={{ textAlign: "center" }}>
            暂无台账记录
          </li>
        )}
        {items.map((v) => {
          const subj = subjectOf(v);
          const reasons = (v.block_reasons || []).map((r) => r.message).join("；");
          return (
            <li key={v.id} className="card record-card">
              <div className="record-card-top">
                <span className="pill">{v.visit_type_label || v.visit_type || "承运"}</span>
                <span className="pill">{STATUS_LABEL[v.status] || v.status}</span>
              </div>
              <strong className="record-title">{subj.title}</strong>
              <p className="record-sub muted">{subj.sub}</p>
              <dl className="record-meta">
                <div>
                  <dt>承运商/客户</dt>
                  <dd>{v.visit_type === "self_pickup" ? v.customer_phone || "-" : v.carrier_name || "-"}</dd>
                </div>
                <div>
                  <dt>归档</dt>
                  <dd>{v.archive_key || "-"}</dd>
                </div>
                <div>
                  <dt>更新</dt>
                  <dd>{formatAt(v.updated_at)}</dd>
                </div>
                {reasons ? (
                  <div className="record-meta-full">
                    <dt>拦截</dt>
                    <dd>{reasons}</dd>
                  </div>
                ) : null}
              </dl>
            </li>
          );
        })}
      </ul>

      {/* 平板 / 电脑：表格 */}
      <div className="card desk-only table-panel">
        <div className="table-scroll">
          <table className="table table-comfortable">
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
              {!items.length && (
                <tr>
                  <td colSpan={7} className="muted">
                    暂无台账记录
                  </td>
                </tr>
              )}
              {items.map((v) => {
                const subj = subjectOf(v);
                return (
                  <tr key={v.id}>
                    <td>
                      <span className="pill">{v.visit_type_label || v.visit_type || "承运"}</span>
                    </td>
                    <td>
                      <span className="pill">{STATUS_LABEL[v.status] || v.status}</span>
                    </td>
                    <td>
                      <div className="cell-stack">
                        <span>{subj.title}</span>
                        <span className="muted">{subj.sub}</span>
                      </div>
                    </td>
                    <td className="cell-wrap">
                      {v.visit_type === "self_pickup" ? v.customer_phone || "-" : v.carrier_name || "-"}
                    </td>
                    <td className="muted cell-wrap">{v.archive_key || "-"}</td>
                    <td className="nowrap">{formatAt(v.updated_at)}</td>
                    <td className="muted cell-wrap">
                      {(v.block_reasons || []).map((r) => r.message).join("；") || "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
