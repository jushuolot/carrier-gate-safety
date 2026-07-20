import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, setSession } from "../api";

const PRESETS = {
  driver: { phone: "13900000001", password: "driver123", tip: "首次司机（需培训）" },
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
      const role = data.user.role;
      nav(role === "driver" ? "/driver" : role === "gate" ? "/gate" : "/admin");
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="portal" style={{ maxWidth: 480 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>登录</h1>
      <p className="muted">演示账号可一点填入 · 当前建议：{preset.tip}</p>

      <form className="card" style={{ marginTop: 16 }} onSubmit={submit}>
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
        {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
        <button className="btn primary" disabled={loading} type="submit">
          {loading ? "登录中…" : "进入系统"}
        </button>
      </form>

      <div className="row" style={{ marginTop: 16 }}>
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
  );
}
