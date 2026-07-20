import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";

export default function DriverVisit() {
  const user = getUser();
  const [vehicles, setVehicles] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [visit, setVisit] = useState(null);
  const [access, setAccess] = useState(null);
  const [msg, setMsg] = useState("");
  const [depart, setDepart] = useState({
    loadDone: false,
    inventoryDone: false,
    safetySigned: false,
    gateCheckout: false,
  });

  useEffect(() => {
    (async () => {
      const v = await api(`/vehicles?carrierId=${user.carrier_id}`);
      setVehicles(v.items);
      setVehicleId(v.items[0]?.id || "");
    })().catch((e) => setMsg(e.message));
  }, [user]);

  async function createVisit() {
    try {
      const r = await api("/visits", {
        method: "POST",
        body: {
          carrierId: user.carrier_id,
          driverId: user.driver_id,
          vehicleId,
        },
      });
      setVisit(r.visit);
      setMsg("预约单已创建");
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
          <label>车辆</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate_no}
              </option>
            ))}
          </select>
        </div>
        <button className="btn primary" type="button" onClick={createVisit} disabled={!vehicleId}>
          创建今日预约
        </button>
      </div>

      {visit && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>到访单</strong>
            <span className="pill">{visit.status}</span>
          </div>
          <p className="muted">车牌 {visit.plate_no}</p>
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
        </div>
      )}

      {visit && ["onsite", "departing"].includes(visit.status) && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>离场收口</strong>
          {Object.keys(depart).map((k) => (
            <label key={k} style={{ display: "block", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={depart[k]}
                onChange={(e) => setDepart((d) => ({ ...d, [k]: e.target.checked }))}
              />{" "}
              {labelDepart(k)}
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

function labelDepart(k) {
  return (
    {
      loadDone: "装卸完成确认",
      inventoryDone: "物资/铅封清点",
      safetySigned: "安全确认签署",
      gateCheckout: "门岗签退",
    }[k] || k
  );
}
