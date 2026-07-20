import { useEffect, useState } from "react";
import { api } from "../../api";

/** 门岗只看在场清单，方便催离场；不做后台分析 */
export default function GateOnsite() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api("/visits?status=onsite")
      .then((d) => setItems(d.items))
      .catch(console.error);
    const t = setInterval(() => {
      api("/visits?status=onsite")
        .then((d) => setItems(d.items))
        .catch(() => {});
    }, 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>当前在场</h2>
      <p className="muted">用于班次盯梢：超时停留可口头催促；规则配置与证件到期不在此页。</p>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>类型</th>
              <th>对象</th>
              <th>入场时间</th>
              <th>停留</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.id}>
                <td>
                  <span className="pill">{v.visit_type_label || v.visit_type}</span>
                </td>
                <td>
                  {v.visit_type === "self_pickup"
                    ? `${v.customer_name || "-"} / ${v.pickup_ref || "-"}`
                    : `${v.plate_no} · ${v.driver_name}`}
                </td>
                <td>{v.onsite_at || "-"}</td>
                <td>{stayText(v.onsite_at)}</td>
              </tr>
            ))}
            {!items.length && (
              <tr>
                <td colSpan={4} className="muted">
                  当前无在场车辆/自提
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function stayText(onsiteAt) {
  if (!onsiteAt) return "-";
  const mins = Math.max(0, Math.round((Date.now() - new Date(onsiteAt).getTime()) / 60000));
  if (mins < 60) return `${mins} 分钟`;
  return `${Math.floor(mins / 60)} 小时 ${mins % 60} 分`;
}
