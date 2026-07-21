import { useEffect, useState } from "react";
import { api } from "../../api";
import { RiskPill } from "../../components/PassCode";
import { useI18n } from "../../i18n/I18nContext";

const STATUS_LABEL = {
  access_pending: "待准入",
  inspecting: "安检中",
  exception_requested: "待双签",
  onsite: "在场",
  rejected: "已拒绝",
};

export default function GateConsole() {
  const { t } = useI18n();
  const [queue, setQueue] = useState([]);
  const [kpi, setKpi] = useState(null);
  const [selected, setSelected] = useState(null);
  const [access, setAccess] = useState(null);
  const [checklistDef, setChecklistDef] = useState([]);
  const [checks, setChecks] = useState({});
  const [msg, setMsg] = useState("");
  const [plate, setPlate] = useState("沪A12345");
  const [passCode, setPassCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [pending, inspecting, exception, k] = await Promise.all([
      api("/visits?status=access_pending"),
      api("/visits?status=inspecting"),
      api("/visits?status=exception_requested"),
      api("/gate/kpi"),
    ]);
    const items = [...inspecting.items, ...pending.items, ...exception.items];
    items.sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));
    setQueue(items);
    setKpi(k);
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

  async function lookupPass() {
    if (!passCode.trim()) return;
    setBusy(true);
    setMsg("");
    try {
      const r = await api(`/visits?passCode=${encodeURIComponent(passCode.trim())}`);
      const v = r.visit || r.items?.[0];
      if (!v) throw new Error("未找到单据");
      setMsg(`通行码命中 ${v.plate_no || v.customer_name || v.id}`);
      await openVisit(v.id);
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
          ? `放行成功 · 证据已归档${r.deviceResult?.txnId ? ` · 道闸 ${r.deviceResult.txnId}` : ""}`
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
        body: { reason: "紧急保供例外", approverNote: "门岗申请双签" },
      });
      setMsg(r.message || (r.pendingApproval ? "已提交双签" : "例外放行完成"));
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
      let text = `LPR ${r.captured.plateNo}（${Math.round(r.captured.confidence * 100)}%）`;
      if (r.matchedVisit) {
        text += ` · 自动匹配队列 ${r.matchedVisit.pass_code || r.matchedVisit.id}`;
        setMsg(text);
        await openVisit(r.matchedVisit.id);
      } else {
        setMsg(text + (r.vehicle ? " · 车辆已建档" : " · 未建档"));
      }
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function addDemoJob() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const slots = await api("/meta/slots");
      const slot = (slots.items || []).find((s) => s.available) || slots.items?.[0];
      const created = await api("/visits", {
        method: "POST",
        body: {
          visitType: "carrier",
          carrierId: "carrier-1",
          driverId: "driver-ok",
          vehicleId: "veh-1",
          slotStart: slot.slotStart,
          slotEnd: slot.slotEnd,
        },
      });
      const checked = await api(`/visits/${created.visit.id}/checkin`, {
        method: "POST",
        body: {},
      });
      await reload();
      setMsg(
        checked.ok
          ? `演示待办已加入 · 通行码 ${checked.visit.pass_code}`
          : checked.message || "已进入待准入"
      );
      if (checked.visit) await openVisit(checked.visit.id);
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
      <header className="gate-head page-head">
        <h2>{t("gateConsole")}</h2>
        <p className="muted">{t("gateConsoleSub")}</p>
      </header>

      {kpi && (
        <div className="gate-kpi">
          <div className="gate-kpi-item">
            <span className="l">待安检</span>
            <span className="v">{kpi.inspecting}</span>
          </div>
          <div className="gate-kpi-item">
            <span className="l">待准入</span>
            <span className="v">{kpi.accessPending}</span>
          </div>
          <div className="gate-kpi-item">
            <span className="l">待双签</span>
            <span className="v">{kpi.exceptionRequested}</span>
          </div>
          <div className="gate-kpi-item">
            <span className="l">超时在场</span>
            <span className="v">{kpi.dwellOver}</span>
          </div>
          <div className="gate-kpi-item">
            <span className="l">今日放行</span>
            <span className="v">{kpi.releasedToday}</span>
          </div>
        </div>
      )}

      {msg && (
        <div className={`gate-toast ${msg.includes("失败") || msg.includes("错误") ? "bad" : "ok"}`}>
          {msg}
        </div>
      )}

      <section className="card gate-tools">
        <strong>当班快操</strong>
        <div className="filters-grid" style={{ marginTop: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>通行码</label>
            <div className="gate-lpr">
              <input
                value={passCode}
                onChange={(e) => setPassCode(e.target.value.toUpperCase())}
                placeholder="如 GATE01"
                aria-label="通行码"
              />
              <button className="btn primary" type="button" onClick={lookupPass} disabled={busy}>
                打开
              </button>
            </div>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>车牌 LPR</label>
            <div className="gate-lpr">
              <input value={plate} onChange={(e) => setPlate(e.target.value)} aria-label="车牌" />
              <button className="btn" type="button" onClick={simulateLpr} disabled={busy}>
                匹配
              </button>
            </div>
          </div>
        </div>
        <button className="btn btn-block" type="button" onClick={addDemoJob} disabled={busy} style={{ marginTop: 4 }}>
          {busy ? "处理中…" : "加入演示待办"}
        </button>
      </section>

      <div className="gate-split">
        <section className="gate-queue">
          <div className="gate-section-title">
            <strong>待处理</strong>
            <span className="muted">{queue.length} 单 · 按风险</span>
          </div>

          {!queue.length && (
            <div className="card gate-empty">
              <p className="muted">暂无待办。可用通行码或「加入演示待办」。</p>
            </div>
          )}

          <ul className="gate-list">
            {queue.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className={`gate-item risk-${v.risk_level || "low"} ${selected?.id === v.id ? "on" : ""}`}
                  onClick={() => openVisit(v.id)}
                  disabled={busy}
                >
                  <span className="gate-item-top">
                    <span className="pill">{v.visit_type_label || "承运"}</span>
                    <span className="pill">{STATUS_LABEL[v.status] || v.status}</span>
                    <RiskPill level={v.risk_level} score={v.risk_score} />
                  </span>
                  <strong>{subjectText(v)}</strong>
                  <span className="muted">
                    {v.pass_code ? `码 ${v.pass_code}` : ""}
                    {v.slot_start ? ` · ${String(v.slot_start).slice(11, 16)}` : ""}
                    {v.fast_lane ? " · 快速通道" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card gate-detail">
          <strong>核验详情</strong>
          {!selected && <p className="muted" style={{ marginTop: 12 }}>选择单据或输入通行码</p>}

          {selected && (
            <div className="gate-detail-body">
              <p className="gate-subject">
                <RiskPill level={selected.risk_level} score={selected.risk_score} />
                <span>{subjectText(selected)}</span>
              </p>
              {selected.pass_code && (
                <p className="muted">通行码 {selected.pass_code}</p>
              )}
              <p>
                状态 <span className="pill">{STATUS_LABEL[selected.status] || selected.status}</span>
                {selected.fast_lane || selected.risk_level === "low" ? (
                  <span className="pill ok" style={{ marginLeft: 6 }}>
                    快速通道
                  </span>
                ) : null}
              </p>

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
              {access?.riskFactors?.length > 0 && (
                <p className="muted">风险：{access.riskFactors.join("、")}</p>
              )}
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
                    安检通过并开闸（证据归档）
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
                    申请例外放行（双签）
                  </button>
                </div>
              )}

              {selected.status === "exception_requested" && (
                <p className="muted">等待 EHS/管理员双签批准。可在管理后台处理。</p>
              )}

              {selected.inspection?.snapshot && (
                <p className="muted" style={{ marginTop: 10 }}>
                  证据包已记录 · 抓拍 {selected.inspection.snapshot.url || "已模拟"}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
