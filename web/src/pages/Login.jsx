import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, setSession } from "../api";

const PRESETS = {
  driver: { phone: "13900000001", password: "driver123", tip: "首次司机" },
  driver2: { phone: "13900000002", password: "driver123", tip: "已准入司机" },
  pickup: { phone: "13700000001", password: "pickup123", tip: "客户自提" },
  gate: { phone: "13800000002", password: "gate123", tip: "门岗" },
  ehs: { phone: "13800000001", password: "ehs123", tip: "EHS" },
  admin: { phone: "13800000000", password: "admin123", tip: "管理员" },
  carrier: { phone: "13800000003", password: "carrier123", tip: "承运商" },
};

export default function Login() {
  const [params] = useSearchParams();
  const role = params.get("role") || "admin";
  const preset = PRESETS[role] || PRESETS.admin;
  const [phone, setPhone] = useState(preset.phone);
  const [password, setPassword] = useState(preset.password);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const tips = useMemo(() => Object.entries(PRESETS), []);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: { phone, password },
      });
      setSession(data.token, data.user);
      const r = data.user.role;
      nav(r === "driver" ? "/driver" : r === "gate" ? "/gate" : "/admin");
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="stage stage-login">
      <div className="stage-photo" aria-hidden />

      <header className="stage-nav">
        <Link className="stage-logo" to="/">
          <span className="stage-logo-mark" aria-hidden />
          <span>Gate Safety</span>
        </Link>
        <Link className="stage-nav-link" to="/">
          返回
        </Link>
      </header>

      <div className="login-panel">
        <p className="login-kicker">承运商安全</p>
        <h1 className="login-title">登录</h1>
        <p className="login-sub">{preset.tip}</p>

        <form className="login-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="phone">手机号</label>
            <input
              id="phone"
              inputMode="tel"
              autoComplete="username"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {err && <p className="login-err">{err}</p>}
          <button className="btn primary btn-block" disabled={loading} type="submit">
            {loading ? "登录中…" : "继续"}
          </button>
        </form>

        <div className="login-presets" aria-label="演示账号">
          {tips.map(([k, v]) => (
            <button
              key={k}
              type="button"
              className={`chip ${phone === v.phone ? "on" : ""}`}
              onClick={() => {
                setPhone(v.phone);
                setPassword(v.password);
              }}
            >
              {v.tip}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
