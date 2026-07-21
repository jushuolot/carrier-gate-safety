import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";
import { PassCodeCard, RiskPill } from "../../components/PassCode";

export default function DriverVisit() {
  const user = getUser();
  const [types, setTypes] = useState([]);
  const [visitType, setVisitType] = useState("carrier");
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [customerName, setCustomerName] = useState(user?.name || "");
  const [customerPhone, setCustomerPhone] = useState(user?.phone || "");
  const [pickupRef, setPickupRef] = useState("");
  const [slots, setSlots] = useState([]);
  const [slotStart, setSlotStart] = useState("");
  const [visit, setVisit] = useState(null);
  const [access, setAccess] = useState(null);
  const [departSteps, setDepartSteps] = useState([]);
  const [depart, setDepart] = useState({});
  const [msg, setMsg] = useState("");

  const typeMeta = useMemo(
    () => types.find((t) => t.id === visitType) || null,
    [types, visitType]
  );

  const selectedSlot = slots.find((s) => s.slotStart === slotStart);

  useEffect(() => {
    if (!user?.carrier_id) return;
    let cancelled = false;
    (async () => {
      const meta = await api("/meta/visit-types");
      if (cancelled) return;
      setTypes(meta.items || []);
      const v = await api(`/vehicles?carrierId=${user.carrier_id}`);
      if (cancelled) return;
      setVehicles(v.items);
      setVehicleId(v.items[0]?.id || "");
      const sl = await api("/meta/slots");
      if (cancelled) return;
      setSlots(sl.items || []);
      const first = (sl.items || []).find((x) => x.available);
      if (first) setSlotStart(first.slotStart);
    })().catch((e) => {
      if (!cancelled) setMsg(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.carrier_id]);

  useEffect(() => {
    setSelectedOptions([]);
  }, [visitType]);

  useEffect(() => {
    if (!visit?.depart_steps) return;
    setDepartSteps(visit.depart_steps);
    setDepart(Object.fromEntries(visit.depart_steps.map((s) => [s.key, false])));
  }, [visit?.id, visit?.depart_steps]);

  function toggleOption(key) {
    setSelectedOptions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function createVisit() {
    try {
      const body =
        visitType === "self_pickup"
          ? {
              visitType: "self_pickup",
              selectedOptions,
              customerName,
              customerPhone,
              pickupRef,
              vehicleId: vehicleId || undefined,
              carrierId: user.carrier_id || "carrier-self",
              driverId: user.driver_id || "driver-pickup",
              slotStart,
              slotEnd: selectedSlot?.slotEnd,
            }
          : {
              visitType: "carrier",
              selectedOptions,
              carrierId: user.carrier_id,
              driverId: user.driver_id,
              vehicleId,
              slotStart,
              slotEnd: selectedSlot?.slotEnd,
            };
      const r = await api("/visits", { method: "POST", body });
      setVisit(r.visit);
      setAccess(r.access || null);
      setMsg(
        visitType === "self_pickup"
          ? `自提预约已创建 · 时段 ${selectedSlot?.label || ""}`
          : `承运预约已创建 · 时段 ${selectedSlot?.label || ""}`
      );
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function checkin() {
    try {
      const r = await api(`/visits/${visit.id}/checkin`, { method: "POST", body: {} });
      setVisit(r.visit);
      setAccess(r.access);
      setMsg(
        r.message ||
          (r.ok
            ? `报到成功 · 通行码 ${r.visit.pass_code}`
            : "准入未通过")
      );
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function doDepart() {
    try {
      const r = await api(`/visits/${visit.id}/depart`, {
        method: "POST",
        body: depart,
      });
      setVisit(r.visit);
      if (r.required) setDepartSteps(r.required);
      setMsg(r.message || (r.ok ? "离场完成，出口道闸已指令放行" : "请完成全部离场步骤"));
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="h5">
      <Link to="/driver" className="h5-back">
        ← 返回
      </Link>
      <h1 className="h5-title">到离场报到</h1>
      <p className="h5-sub">约时段 · 通行码 · 离场收口</p>

      <div className="card">
        <div className="field">
          <label>业务类型</label>
          <select value={visitType} onChange={(e) => setVisitType(e.target.value)}>
            {(types.length
              ? types
              : [
                  { id: "carrier", label: "承运到场" },
                  { id: "self_pickup", label: "客户自提" },
                ]
            ).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>到场时段</label>
          <select value={slotStart} onChange={(e) => setSlotStart(e.target.value)}>
            {slots.map((s) => (
              <option key={s.slotStart} value={s.slotStart} disabled={!s.available}>
                {s.label} · 余 {s.remaining}/{s.capacity}
              </option>
            ))}
          </select>
        </div>

        {visitType === "carrier" && (
          <div className="field">
            <label>车辆</label>
            <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate_no}
                </option>
              ))}
            </select>
          </div>
        )}

        {visitType === "self_pickup" && (
          <>
            <div className="field">
              <label>提货人姓名</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="field">
              <label>联系电话</label>
              <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            </div>
            <div className="field">
              <label>提货单号</label>
              <input
                value={pickupRef}
                onChange={(e) => setPickupRef(e.target.value)}
                placeholder="例如 PO-2026-001"
              />
            </div>
          </>
        )}

        {typeMeta?.departOptional?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              可选步骤（勾选后本单强制执行）
            </div>
            {typeMeta.departOptional.map((s) => (
              <label key={s.key} className="gate-check" style={{ marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(s.key)}
                  onChange={() => toggleOption(s.key)}
                />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
        )}

        <button
          className="btn primary btn-block"
          type="button"
          style={{ marginTop: 12 }}
          onClick={createVisit}
          disabled={
            !slotStart ||
            (visitType === "carrier" ? !vehicleId : !customerName || !pickupRef)
          }
        >
          创建预约
        </button>
      </div>

      {visit && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>到访单</strong>
            <RiskPill level={visit.risk_level} score={visit.risk_score} />
          </div>
          <p className="muted">
            状态 {visit.status}
            {visit.slot_start ? ` · 时段 ${String(visit.slot_start).slice(11, 16)}` : ""}
            {visit.plate_no ? ` · ${visit.plate_no}` : ""}
          </p>
          {access?.riskFactors?.length > 0 && (
            <p className="muted">风险因子：{access.riskFactors.join("、")}</p>
          )}
          {visit.pass_code && (
            <PassCodeCard code={visit.pass_code} hint="门岗扫码/输码即可打开本单" />
          )}
          {["appointed", "access_pending"].includes(visit.status) && (
            <button className="btn primary btn-block" type="button" onClick={checkin}>
              报到入场
            </button>
          )}
          {access && !access.allowed && (
            <ul className="gate-reasons">
              {access.reasons.map((r, i) => (
                <li key={i}>{r.message}</li>
              ))}
            </ul>
          )}
          {access?.fastLane && visit.status === "inspecting" && (
            <p className="muted">快速通道提示：低风险，门岗可加速核验（仍须确认开闸）</p>
          )}
        </div>
      )}

      {visit && ["onsite", "departing"].includes(visit.status) && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>离场收口</strong>
          {(departSteps.length ? departSteps : visit.depart_steps || []).map((s) => (
            <label key={s.key} className="gate-check" style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={!!depart[s.key]}
                onChange={(e) => setDepart((d) => ({ ...d, [s.key]: e.target.checked }))}
              />
              <span>
                {s.label}
                {s.source === "optional" ? "（可选·已启用）" : ""}
              </span>
            </label>
          ))}
          <button className="btn primary btn-block" type="button" style={{ marginTop: 12 }} onClick={doDepart}>
            提交离场
          </button>
        </div>
      )}

      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
