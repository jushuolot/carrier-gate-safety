import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";
import { LogoutButton } from "../../components";

export default function DriverHome() {
  const user = getUser();
  const [status, setStatus] = useState(null);
  const [access, setAccess] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const st = await api(`/training/status?driverId=${user.driver_id}`);
        setStatus(st);
        const vehicles = await api(`/vehicles?carrierId=${user.carrier_id}`);
        const vehicleId = vehicles.items[0]?.id;
        if (vehicleId) {
          const ev = await api("/access/evaluate", {
            method: "POST",
            body: {
              driverId: user.driver_id,
              vehicleId,
              carrierId: user.carrier_id,
            },
          });
          setAccess(ev);
        }
      } catch (e) {
        setErr(e.message);
      }
    })();
  }, [user]);

  return (
    <div className="h5">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="muted">司机端</div>
          <h2 style={{ margin: "4px 0 0" }}>{user.name}</h2>
        </div>
        <LogoutButton />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="muted">准入三灯</div>
        <div className="light" style={{ marginTop: 10 }}>
          <span className="pill">
            <i className={`dot ${access?.lights?.training ? "on" : "off"}`} />
            培训 {access?.lights?.training ? "有效" : "未完成"}
          </span>
          <span className="pill">
            <i className={`dot ${access?.lights?.documents ? "on" : "off"}`} />
            证件 {access?.lights?.documents ? "齐全" : "待补"}
          </span>
          <span className="pill">
            <i className={`dot ${access?.lights?.subject ? "on" : "off"}`} />
            主体正常
          </span>
        </div>
        {access && !access.allowed && (
          <ul style={{ marginTop: 12, paddingLeft: 18 }}>
            {access.reasons.map((r, i) => (
              <li key={i} className="muted">
                {r.message}
              </li>
            ))}
          </ul>
        )}
        {status?.record?.valid_until && (
          <p className="muted" style={{ marginTop: 10 }}>
            培训有效至 {status.record.valid_until}
          </p>
        )}
      </div>

      <div className="grid" style={{ marginTop: 12 }}>
        <Link className="card" to="/driver/training">
          <strong>安全培训 / 答题</strong>
          <p className="muted">首次或复训必做</p>
        </Link>
        <Link className="card" to="/driver/docs">
          <strong>资质上传 · OCR</strong>
          <p className="muted">驾驶证 / 资格证到期日</p>
        </Link>
        <Link className="card" to="/driver/visit">
          <strong>到离场报到</strong>
          <p className="muted">预约、报到、离场收口</p>
        </Link>
      </div>
      {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
