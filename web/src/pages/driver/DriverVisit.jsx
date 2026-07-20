import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";

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
  const [visit, setVisit] = useState(null);
  const [access, setAccess] = useState(null);
  const [departSteps, setDepartSteps] = useState([]);
  const [depart, setDepart] = useState({});
  const [msg, setMsg] = useState("");

  const typeMeta = useMemo(
    () => types.find((t) => t.id === visitType) || null,
    [types, visitType]
  );

  useEffect(() => {
    (async () => {
      const meta = await api("/meta/visit-types");
      setTypes(meta.items || []);
      const v = await api(`/vehicles?carrierId=${user.carrier_id}`);
      setVehicles(v.items);
      setVehicleId(v.items[0]?.id || "");
    })().catch((e) => setMsg(e.message));
  }, [user]);

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
            }
          : {
              visitType: "carrier",
              selectedOptions,
              carrierId: user.carrier_id,
              driverId: user.driver_id,
              vehicleId,
            };
      const r = await api("/visits", { method: "POST", body });
      setVisit(r.visit);
      setMsg(
        visitType === "self_pickup"
          ? `自提预约已创建 · 可选步骤 ${selectedOptions.length} 项已锁定为本单必做`
          : "承运预约单已创建"
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
      setMsg(r.message || (r.ok ? "报到成功，等待安检" : "准入未通过"));
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
      <Link to="/driver" className="muted">
        ← 返回
      </Link>
      <h2>到离场报到</h2>

      <div className="card">
        <div className="field">
          <label>业务类型</label>
          <select value={visitType} onChange={(e) => setVisitType(e.target.value)}>
            {(types.length ? types : [
              { id: "carrier", label: "承运到场" },
              { id: "self_pickup", label: "客户自提" },
            ]).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
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
            <div className="field">
              <label>自提车辆（可选）</label>
              <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">默认自提通道车辆</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate_no}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {typeMeta?.departOptional?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              可选步骤（勾选后本单强制执行）
            </div>
            {typeMeta.departOptional.map((s) => (
              <label key={s.key} style={{ display: "block", marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={selectedOptions.includes(s.key)}
                  onChange={() => toggleOption(s.key)}
                />{" "}
                {s.label}
              </label>
            ))}
          </div>
        )}

        <button
          className="btn primary"
          type="button"
          style={{ marginTop: 12 }}
          onClick={createVisit}
          disabled={visitType === "carrier" ? !vehicleId : !customerName || !pickupRef}
        >
          创建今日预约
        </button>
      </div>

      {visit && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>到访单</strong>
            <span className="pill">{visit.visit_type_label || visit.visit_type}</span>
          </div>
          <p className="muted">
            状态 {visit.status}
            {visit.plate_no ? ` · 车牌 ${visit.plate_no}` : ""}
            {visit.pickup_ref ? ` · 提货单 ${visit.pickup_ref}` : ""}
          </p>
          {!!visit.selected_options?.length && (
            <p className="muted">已选可选步骤：{visit.selected_options.join("、")}</p>
          )}
          <div className="row">
            <button className="btn primary" type="button" onClick={checkin}>
              报到入场
            </button>
          </div>
          {access && !access.allowed && (
            <ul>
              {access.reasons.map((r, i) => (
                <li key={i}>{r.message}</li>
              ))}
            </ul>
          )}
          {access?.note && <p className="muted">{access.note}</p>}
        </div>
      )}

      {visit && ["onsite", "departing"].includes(visit.status) && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>离场收口</strong>
          <p className="muted">必做 = 固定步骤 + 创建时勾选的可选步骤</p>
          {(departSteps.length ? departSteps : visit.depart_steps || []).map((s) => (
            <label key={s.key} style={{ display: "block", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={!!depart[s.key]}
                onChange={(e) => setDepart((d) => ({ ...d, [s.key]: e.target.checked }))}
              />{" "}
              {s.label}
              {s.source === "optional" ? (
                <span className="pill warn" style={{ marginLeft: 6 }}>
                  可选·已启用
                </span>
              ) : (
                <span className="pill" style={{ marginLeft: 6 }}>
                  必做
                </span>
              )}
            </label>
          ))}
          <button className="btn primary" type="button" style={{ marginTop: 12 }} onClick={doDepart}>
            提交离场
          </button>
        </div>
      )}

      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
