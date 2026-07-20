import { useEffect, useState } from "react";
import { api } from "../../api";

export default function GateConsole() {
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [access, setAccess] = useState(null);
  const [checklistDef, setChecklistDef] = useState([]);
  const [checks, setChecks] = useState({});
  const [msg, setMsg] = useState("");
  const [plate, setPlate] = useState("沪A12345");

  async function reload() {
    const pending = await api("/visits?status=access_pending");
    const inspecting = await api("/visits?status=inspecting");
    setQueue([...inspecting.items, ...pending.items]);
  }

  useEffect(() => {
    reload().catch(console.error);
  }, []);

  async function openVisit(id) {
    const data = await api(`/visits/${id}`);
    setSelected(data.visit);
    setAccess(data.access);
    const list = data.inspectChecklist || [];
    setChecklistDef(list);
    setChecks(Object.fromEntries(list.map((c) => [c.key, true])));
  }

  async function inspect(pass) {
    if (!selected) return;
    try {
      const r = await api(`/visits/${selected.id}/inspect`, {
        method: "POST",
        body: { pass, checklist: checks },
      });
      setMsg(
        r.ok
          ? `放行成功${r.deviceResult?.txnId ? ` · 道闸事务 ${r.deviceResult.txnId}` : ""}`
          : "安检未通过，已拒绝"
      );
      setSelected(r.visit);
      await reload();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function exceptionPass() {
    if (!selected) return;
    try {
      const r = await api(`/visits/${selected.id}/exception`, {
        method: "POST",
        body: { reason: "紧急保供例外", approverNote: "门岗演示双签占位" },
      });
      setMsg(`例外放行 · 设备 ${r.deviceResult?.ok ? "已开闸" : "指令失败"}`);
      setSelected(r.visit);
      await reload();
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function simulateLpr() {
    try {
      const r = await api("/devices/lpr/simulate", {
        method: "POST",
        body: { plateNo: plate },
      });
      setMsg(
        `LPR 识别 ${r.captured.plateNo}（置信度 ${r.captured.confidence}）${
          r.vehicle ? ` · 匹配车辆 ${r.vehicle.id}` : " · 未建档车牌"
        }`
      );
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>待办队列 · 放行</h2>
      <p className="muted">只处理「待准入 / 安检中」。历史台账、证件催办、主数据请走管理后台。</p>

      <div className="card" style={{ marginBottom: 12 }}>
        <strong>当班设备快操</strong>
        <div className="row" style={{ marginTop: 8 }}>
          <input value={plate} onChange={(e) => setPlate(e.target.value)} />
          <button className="btn" type="button" onClick={simulateLpr}>
            LPR 抓拍匹配
          </button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.2fr" }}>
        <div className="card">
          <strong>待处理队列</strong>
          <table className="table">
            <thead>
              <tr>
                <th>类型</th>
                <th>状态</th>
                <th>对象</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {queue.map((v) => (
                <tr key={v.id}>
                  <td>
                    <span className="pill">{v.visit_type_label || v.visit_type || "承运"}</span>
                  </td>
                  <td>{v.status}</td>
                  <td>
                    {v.visit_type === "self_pickup"
                      ? `${v.customer_name || "-"} / ${v.pickup_ref || "-"}`
                      : `${v.plate_no} · ${v.driver_name}`}
                  </td>
                  <td>
                    <button className="btn" type="button" onClick={() => openVisit(v.id)}>
                      打开
                    </button>
                  </td>
                </tr>
              ))}
              {!queue.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    暂无待安检/待准入单据。请司机端或自提客户先创建预约并报到。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <strong>核验详情</strong>
          {!selected && <p className="muted">从左侧选择单据</p>}
          {selected && (
            <>
              <p>
                <span className="pill">{selected.visit_type_label || selected.visit_type}</span>{" "}
                {selected.visit_type === "self_pickup" ? (
                  <>
                    {selected.customer_name} · 提货单 {selected.pickup_ref}
                  </>
                ) : (
                  <>
                    {selected.plate_no} · {selected.driver_name} · {selected.carrier_name}
                  </>
                )}
              </p>
              <p>
                状态 <span className="pill">{selected.status}</span>
              </p>
              {!!selected.selected_options?.length && (
                <p className="muted">本单可选步骤：{selected.selected_options.join("、")}</p>
              )}
              {access && (
                <div className="light" style={{ marginBottom: 10 }}>
                  <span className="pill">
                    培训 {access.lights.training ? "✓" : "✗"}
                  </span>
                  <span className="pill">
                    证件 {access.lights.documents ? "✓" : "✗"}
                  </span>
                </div>
              )}
              {access?.note && <p className="muted">{access.note}</p>}
              {access && !access.allowed && (
                <ul>
                  {access.reasons.map((r, i) => (
                    <li key={i}>{r.message}</li>
                  ))}
                </ul>
              )}

              {selected.status === "inspecting" && (
                <>
                  {checklistDef.map((c) => (
                    <label key={c.key} style={{ display: "block", marginTop: 6 }}>
                      <input
                        type="checkbox"
                        checked={!!checks[c.key]}
                        onChange={(e) =>
                          setChecks((x) => ({ ...x, [c.key]: e.target.checked }))
                        }
                      />{" "}
                      {c.label}
                    </label>
                  ))}
                  <div className="row" style={{ marginTop: 12 }}>
                    <button className="btn primary" type="button" onClick={() => inspect(true)}>
                      安检通过并开闸
                    </button>
                    <button className="btn danger" type="button" onClick={() => inspect(false)}>
                      拒绝
                    </button>
                  </div>
                </>
              )}

              {selected.status === "access_pending" && (
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn" type="button" onClick={exceptionPass}>
                    例外放行（审计留痕）
                  </button>
                </div>
              )}
            </>
          )}
          {msg && <p className="muted">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
