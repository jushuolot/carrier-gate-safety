import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";
import { LogoutButton } from "../../components";

const ACTIONS = [
  {
    to: "/driver/training",
    title: "安全培训 / 答题",
    desc: "首次或复训必做",
  },
  {
    to: "/driver/docs",
    title: "资质上传 · OCR",
    desc: "驾驶证 / 资格证到期日",
  },
  {
    to: "/driver/visit",
    title: "到离场报到",
    desc: "预约、报到、离场收口",
  },
];

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

  const lights = [
    {
      key: "training",
      label: "安全培训",
      ok: !!access?.lights?.training,
      okText: "有效",
      badText: "未完成",
    },
    {
      key: "documents",
      label: "资质证件",
      ok: !!access?.lights?.documents,
      okText: "齐全",
      badText: "待补",
    },
    {
      key: "subject",
      label: "主体状态",
      ok: access?.lights?.subject !== false,
      okText: "正常",
      badText: "异常",
    },
  ];

  return (
    <div className="h5">
      <header className="h5-head">
        <div>
          <p className="h5-kicker">司机端</p>
          <h1 className="h5-name">{user.name}</h1>
        </div>
        <LogoutButton />
      </header>

      <section className="status-panel" aria-label="准入状态">
        <div className="status-panel-top">
          <h2>准入三灯</h2>
          {access && (
            <span className={`status-flag ${access.allowed ? "ok" : "bad"}`}>
              {access.allowed ? "可入场" : "暂不可入"}
            </span>
          )}
        </div>

        <ul className="status-list">
          {lights.map((l) => (
            <li key={l.key} className={l.ok ? "ok" : "bad"}>
              <i className="status-dot" aria-hidden />
              <span className="status-label">{l.label}</span>
              <span className="status-val">{l.ok ? l.okText : l.badText}</span>
            </li>
          ))}
        </ul>

        {access && !access.allowed && (
          <ul className="status-reasons">
            {access.reasons.map((r, i) => (
              <li key={i}>{r.message}</li>
            ))}
          </ul>
        )}
        {status?.record?.valid_until && (
          <p className="status-note">培训有效至 {status.record.valid_until}</p>
        )}
      </section>

      <nav className="action-list" aria-label="功能">
        {ACTIONS.map((a) => (
          <Link key={a.to} className="action-row" to={a.to}>
            <span>
              <strong>{a.title}</strong>
              <span className="muted">{a.desc}</span>
            </span>
            <span className="action-go" aria-hidden>
              →
            </span>
          </Link>
        ))}
      </nav>

      {err && <p className="form-err">{err}</p>}
    </div>
  );
}
