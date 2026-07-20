import { useEffect, useState } from "react";
import { api } from "../../api";

export default function MastersPage() {
  const [carriers, setCarriers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    (async () => {
      setCarriers((await api("/carriers")).items);
      setDrivers((await api("/drivers")).items);
      setVehicles((await api("/vehicles")).items);
    })().catch(console.error);
  }, []);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>主数据 · 组织 / 人 / 车</h2>
      <p className="muted">档案维护与查询。门岗放行不改主数据，只读拦截结果。</p>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="card">
          <strong>承运商</strong>
          <table className="table">
            <tbody>
              {carriers.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.name}
                    <div className="muted">{c.credit_code}</div>
                  </td>
                  <td>
                    <span className="pill ok">{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <strong>司机</strong>
          <table className="table">
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.name}
                    <div className="muted">{d.phone}</div>
                  </td>
                  <td>{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <strong>车辆</strong>
          <table className="table">
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td>
                    {v.plate_no}
                    <div className="muted">{v.vehicle_type}</div>
                  </td>
                  <td>{v.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
