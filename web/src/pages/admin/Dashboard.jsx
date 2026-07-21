import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";
import { RiskPill } from "../../components/PassCode";
import { useI18n } from "../../i18n/I18nContext";

export default function Dashboard() {
  const user = getUser();
  const { t } = useI18n();
  const [dash, setDash] = useState(null);
  const [expiring, setExpiring] = useState([]);
  const [exceptions, setExceptions] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setDash(await api("/dashboard"));
    const d = await api("/documents/expiring?days=14");
    setExpiring((d.items || []).slice(0, 8));
    if (user?.role === "admin" || user?.role === "ehs") {
      const ex = await api("/visits?status=exception_requested");
      setExceptions(ex.items || []);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, [user?.role]);

  async function approve(id) {
    setBusy(true);
    setMsg("");
    try {
      await api(`/visits/${id}/exception/approve`, {
        method: "POST",
        body: { approverNote: "EHS 批准" },
      });
      setMsg("已批准例外并开闸");
      await load();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject(id) {
    setBusy(true);
    setMsg("");
    try {
      await api(`/visits/${id}/exception/reject`, {
        method: "POST",
        body: { reason: "证据不足" },
      });
      setMsg("已驳回，单据回待准入");
      await load();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!dash) return <p className="muted">加载中…</p>;

  return (
    <div className="page-block">
      <header className="page-head">
        <h2>{t("pageDashboard")}</h2>
        <p className="muted">
          {user?.role === "admin" || user?.role === "ehs" ? (
            <>
              {" "}
              <Link to="/gate">{t("navGate")}</Link>
            </>
          ) : null}
        </p>
      </header>

      {msg && <div className="gate-toast ok">{msg}</div>}

      <div className="grid stats">
        <div className="card stat">
          <div className="l">当前在场</div>
          <div className="v">{dash.onsite}</div>
        </div>
        <div className="card stat">
          <div className="l">今日到访</div>
          <div className="v">{dash.todayAppointed}</div>
        </div>
        <div className="card stat">
          <div className="l">待安检</div>
          <div className="v">{dash.inspecting ?? 0}</div>
        </div>
        <div className="card stat">
          <div className="l">待双签</div>
          <div className="v">{dash.exceptionRequested ?? 0}</div>
        </div>
        <div className="card stat">
          <div className="l">超时在场</div>
          <div className="v">{dash.dwellOver ?? 0}</div>
        </div>
        <div className="card stat">
          <div className="l">30 天内到期</div>
          <div className="v">{dash.expiring30d}</div>
        </div>
      </div>

      {(user?.role === "admin" || user?.role === "ehs") && (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>待双签例外</strong>
          <p className="muted">门岗申请后须 EHS/管理员批准方可开闸</p>
          {!exceptions.length && <p className="muted">暂无待批</p>}
          <ul className="gate-list" style={{ marginTop: 10 }}>
            {exceptions.map((v) => (
              <li key={v.id} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>
                    {v.plate_no || v.customer_name} · {v.driver_name}
                  </strong>
                  <RiskPill level={v.risk_level} score={v.risk_score} />
                </div>
                <p className="muted" style={{ margin: "6px 0 10px" }}>
                  {v.exception?.reason || "例外申请"}
                  {v.pass_code ? ` · 码 ${v.pass_code}` : ""}
                </p>
                <div className="row">
                  <button
                    className="btn primary"
                    type="button"
                    disabled={busy}
                    onClick={() => approve(v.id)}
                  >
                    批准开闸
                  </button>
                  <button className="btn danger" type="button" disabled={busy} onClick={() => reject(v.id)}>
                    驳回
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <strong>近期证件风险</strong>
          <p className="muted">后台催办承运商补证；门岗只在放行时看拦截结果。</p>
          <ul className="entity-list">
            {expiring.map((d) => (
              <li key={d.id} className="entity-row">
                <div className="entity-main">
                  <div className="entity-primary">{d.label}</div>
                  <div className="entity-secondary">
                    {d.subject_type}/{d.subject_id}
                  </div>
                </div>
                <span className={`pill ${d.expired ? "bad" : "warn"}`}>{d.expire_at}</span>
              </li>
            ))}
            {!expiring.length && <li className="muted">近 14 天无到期预警</li>}
          </ul>
          <Link to="/admin/documents">查看全部到期 →</Link>
        </div>

        <div className="card">
          <strong>智能编排能力</strong>
          <ul style={{ marginTop: 10, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>预约时段容量控制</li>
            <li>动态风险评分与快速通道提示</li>
            <li>通行码 + LPR 自动匹配</li>
            <li>双签例外与在场 SLA 催离</li>
          </ul>
          <div className="row" style={{ marginTop: 12 }}>
            <Link className="btn" to="/admin/visits">
              打开台账
            </Link>
            {(user?.role === "admin" || user?.role === "ehs") && (
              <Link className="btn" to="/gate">
                门岗指挥台
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
