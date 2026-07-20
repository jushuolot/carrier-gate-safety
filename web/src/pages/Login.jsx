import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
    <div className="stage">
      <div className="stage-glow stage-glow-a" aria-hidden />
      <div className="stage-glow stage-glow-b" aria-hidden />
      <div className="stage-grid" aria-hidden />

      <div className="portal portal-login">
        <div className="portal-kicker" style={{ marginBottom: 16 }}>
          <span className="stage-logo-mark" style={{ width: 18, height: 18, borderRadius: 5 }} />
          Sign in
        </div>
        <h1 style={{ fontSize: "2.4rem", marginBottom: 8 }}>欢迎回来</h1>
        <p className="muted" style={{ marginBottom: 28, fontSize: 16 }}>
          {preset.tip}
        </p>

        <form className="card" style={{ borderRadius: 22, padding: 24 }} onSubmit={submit}>
          <div className="field">
            <label>手机号</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {err && <p style={{ color: "#ff8a80", fontSize: 14 }}>{err}</p>}
          <button
            className="btn primary"
            disabled={loading}
            type="submit"
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading ? "登录中…" : "继续"}
          </button>
        </form>

        <div className="row" style={{ marginTop: 18 }}>
          {tips.map(([k, v]) => (
            <button
              key={k}
              type="button"
              className="btn"
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
