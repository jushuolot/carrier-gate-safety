import { useEffect, useState } from "react";
import { api } from "../../api";

const STATUS_LABEL = {
  access_pending: "待准入",
  inspecting: "安检中",
  onsite: "在场",
  rejected: "已拒绝",
};

export default function GateConsole() {
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [access, setAccess] = useState(null);
  const [checklistDef, setChecklistDef] = useState([]);
  const [checks, setChecks] = useState({});
  const [msg, setMsg] = useState("");
  const [plate, setPlate] = useState("沪A12345");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const pending = await api("/visits?status=access_pending");
    const inspecting = await api("/visits?status=inspecting");
    setQueue([...inspecting.items, ...pending.items]);
  }

  useEffect(() => {
    reload().catch((e) => setMsg(e.message));
  }, []);

  async function openVisit(id) {
    setBusy(true);
    setMsg("");
    try {
      const data = await api(`/visits/${id}`);
      setSelected(data.visit);
      setAccess(data.access);
      const list = data.inspectChecklist || [];
      setChecklistDef(list);
      setChecks(Object.fromEntries(list.map((c) => [c.key, true])));
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function inspect(pass) {
    if (!selected || busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api(`/visits/${selected.id}/inspect`, {
        method: "POST",
        body: { pass, checklist: checks },
      });
      setMsg(
        r.ok
          ? `放行成功${r.deviceResult?.txnId ? ` · 道闸 ${r.deviceResult.txnId}` : ""}`
          : "安检未通过，已拒绝"
      );
      setSelected(r.visit);
      await reload();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function exceptionPass() {
    if (!selected || busy) return;
    setBusy(true);
    setMsg("");
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
    } finally {
      setBusy(false);
    }
  }

  async function simulateLpr() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api("/devices/lpr/simulate", {
        method: "POST",
        body: { plateNo: plate },
      });
      setMsg(
        `LPR 识别 ${r.captured.plateNo}（${Math.round(r.captured.confidence * 100)}%）` +
          (r.vehicle ? ` · 匹配 ${r.vehicle.plate_no || r.vehicle.id}` : " · 未建档车牌")
      );
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  /** 演示：用已准入司机生成一条安检中单据 */
  async function addDemoJob() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const created = await api("/visits", {
        method: "POST",
        body: {
          visitType: "carrier",
          carrierId: "carrier-1",
          driverId: "driver-ok",
          vehicleId: "veh-1",
        },
      });
      const checked = await api(`/visits/${created.visit.id}/checkin`, {
        method: "POST",
        body: {},
      });
      await reload();
      if (checked.ok || checked.visit?.status === "inspecting") {
        setMsg("已加入安检队列，可直接放行");
        await openVisit(checked.visit.id);
      } else {
        setMsg(checked.message || "报到未通过准入，已进入待准入");
        if (checked.visit) await openVisit(checked.visit.id);
      }
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  function subjectText(v) {
    if (v.visit_type === "self_pickup") {
      return `${v.customer_name || "-"} · ${v.pickup_ref || "-"}`;
    }
    return `${v.plate_no || "-"} · ${v.driver_name || "-"}`;
  }

  return (
    <div className="gate-page">
      <header className="gate-head">
        <h2>待办 · 放行</h2>
        <p className="muted">处理待准入与安检中单据</p>
      </header>

      {msg && (
        <div className={`gate-toast ${msg.includes("失败") || msg.includes("错误") ? "bad" : "ok"}`}>
          {msg}
        </div>
      )}

      <section className="card gate-tools">
        <strong>当班设备</strong>
        <div className="gate-lpr">
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            aria-label="车牌"
            placeholder="车牌号"
          />
          <button className="btn primary" type="button" onClick={simulateLpr} disabled={busy}>
            LPR 抓拍
          </button>
        </div>
        <button className="btn btn-block" type="button" onClick={addDemoJob} disabled={busy}>
          {busy ? "处理中…" : "加入演示待办"}
        </button>
      </section>

      <div className="gate-split">
        <section className="gate-queue">
          <div className="gate-section-title">
            <strong>待处理</strong>
            <span className="muted">{queue.length} 单</span>
          </div>

          {!queue.length && (
            <div className="card gate-empty">
              <p className="muted">暂无待办。点上方「加入演示待办」，或让司机端先预约报到。</p>
            </div>
          )}

          <ul className="gate-list">
            {queue.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className={`gate-item ${selected?.id === v.id ? "on" : ""}`}
                  onClick={() => openVisit(v.id)}
                  disabled={busy}
                >
                  <span className="gate-item-top">
                    <span className="pill">{v.visit_type_label || "承运"}</span>
                    <span className="pill">{STATUS_LABEL[v.status] || v.status}</span>
                  </span>
                  <strong>{subjectText(v)}</strong>
                  <span className="muted gate-item-go">打开 ›</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card gate-detail">
          <strong>核验详情</strong>
          {!selected && <p className="muted" style={{ marginTop: 12 }}>从上方选择单据</p>}

          {selected && (
            <div className="gate-detail-body">
              <p className="gate-subject">
                <span className="pill">{selected.visit_type_label || selected.visit_type}</span>
                <span>{subjectText(selected)}</span>
              </p>
              {selected.carrier_name && (
                <p className="muted">{selected.carrier_name}</p>
              )}
              <p>
                状态 <span className="pill">{STATUS_LABEL[selected.status] || selected.status}</span>
              </p>

              {!!selected.selected_options?.length && (
                <p className="muted">可选步骤：{selected.selected_options.join("、")}</p>
              )}

              {access && (
                <div className="gate-lights">
                  <span className={`pill ${access.lights.training ? "ok" : "bad"}`}>
                    培训 {access.lights.training ? "有效" : "未过"}
                  </span>
                  <span className={`pill ${access.lights.documents ? "ok" : "bad"}`}>
                    证件 {access.lights.documents ? "齐全" : "待补"}
                  </span>
                </div>
              )}
              {access?.note && <p className="muted">{access.note}</p>}
              {access && !access.allowed && (
                <ul className="gate-reasons">
                  {access.reasons.map((r, i) => (
                    <li key={i}>{r.message}</li>
                  ))}
                </ul>
              )}

              {selected.status === "inspecting" && (
                <div className="gate-actions">
                  {checklistDef.map((c) => (
                    <label key={c.key} className="gate-check">
                      <input
                        type="checkbox"
                        checked={!!checks[c.key]}
                        onChange={(e) =>
                          setChecks((x) => ({ ...x, [c.key]: e.target.checked }))
                        }
                      />
                      <span>{c.label}</span>
                    </label>
                  ))}
                  <button
                    className="btn primary btn-block"
                    type="button"
                    onClick={() => inspect(true)}
                    disabled={busy}
                  >
                    安检通过并开闸
                  </button>
                  <button
                    className="btn danger btn-block"
                    type="button"
                    onClick={() => inspect(false)}
                    disabled={busy}
                  >
                    拒绝入场
                  </button>
                </div>
              )}

              {selected.status === "access_pending" && (
                <div className="gate-actions">
                  <button
                    className="btn primary btn-block"
                    type="button"
                    onClick={exceptionPass}
                    disabled={busy}
                  >
                    例外放行（审计留痕）
                  </button>
                </div>
              )}

              {selected.status === "onsite" && (
                <p className="muted">已在场。可到「在场」页查看。</p>
              )}
              {selected.status === "rejected" && (
                <p className="muted">本单已拒绝。</p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
