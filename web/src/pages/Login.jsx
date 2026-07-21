import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, setSession } from "../api";
import { isPagesDemo, reclaimDemoStorage } from "../mockApi";
import { BrandLockup, LangSwitch, useI18n } from "../i18n/I18nContext";

function isQuotaError(msg = "") {
  return /quota|setItem|Storage|存储/i.test(String(msg));
}

export default function Login() {
  const [params] = useSearchParams();
  const role = params.get("role") || "admin";
  const { t } = useI18n();

  const PRESETS = useMemo(
    () => ({
      driver: { phone: "13900000001", password: "driver123", tipKey: "tipDriver" },
      driver2: { phone: "13900000002", password: "driver123", tipKey: "tipDriver2" },
      pickup: { phone: "13700000001", password: "pickup123", tipKey: "tipPickup" },
      gate: { phone: "13800000002", password: "gate123", tipKey: "tipGate" },
      ehs: { phone: "13800000001", password: "ehs123", tipKey: "tipEhs" },
      admin: { phone: "13800000000", password: "admin123", tipKey: "tipAdmin" },
      carrier: { phone: "13800000003", password: "carrier123", tipKey: "tipCarrier" },
    }),
    []
  );

  const preset = PRESETS[role] || PRESETS.admin;
  const [phone, setPhone] = useState(preset.phone);
  const [password, setPassword] = useState(preset.password);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const tips = useMemo(() => Object.entries(PRESETS), [PRESETS]);

  function wipeDemoCache() {
    if (isPagesDemo()) reclaimDemoStorage();
    else {
      try {
        const kill = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith("cgs-pages-demo") || k === "cgs_token" || k === "cgs_user")) {
            kill.push(k);
          }
        }
        kill.forEach((k) => localStorage.removeItem(k));
      } catch {
        /* ignore */
      }
    }
  }

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
      if (isQuotaError(ex.message)) {
        wipeDemoCache();
        try {
          const data = await api("/auth/login", {
            method: "POST",
            body: { phone, password },
          });
          setSession(data.token, data.user);
          const r = data.user.role;
          nav(r === "driver" ? "/driver" : r === "gate" ? "/gate" : "/admin");
          return;
        } catch {
          setErr(
            "本地演示缓存已满。请点下方「清除演示缓存」，或用无痕窗口打开页面后再登录。"
          );
          return;
        }
      }
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
          <span className="stage-logo-text">{t("brandShort")}</span>
        </Link>
        <div className="stage-nav-right">
          <LangSwitch className="lang-switch-dark" />
          <Link className="stage-nav-link" to="/">
            {t("back")}
          </Link>
        </div>
      </header>

      <div className="login-panel">
        <BrandLockup variant="hero" compact />
        <h1 className="login-title">{t("login")}</h1>
        <p className="login-sub">{t(preset.tipKey)}</p>

        <form className="login-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="phone">{t("phone")}</label>
            <input
              id="phone"
              inputMode="tel"
              autoComplete="username"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">{t("password")}</label>
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
            {loading ? "…" : t("loginContinue")}
          </button>
        </form>

        {isPagesDemo() && (
          <button
            className="btn btn-block"
            type="button"
            style={{ marginTop: 10 }}
            onClick={() => {
              wipeDemoCache();
              setErr("");
              window.location.hash = `#/login?role=${role}&reset=1`;
              window.location.reload();
            }}
          >
            {t("clearCache")}
          </button>
        )}

        <div className="login-presets" aria-label="demo accounts">
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
              {t(v.tipKey)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
