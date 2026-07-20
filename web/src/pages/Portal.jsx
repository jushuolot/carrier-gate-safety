import { Link } from "react-router-dom";
import { getUser } from "../api";
import { isPagesDemo } from "../mockApi";

function homeFor(user) {
  if (!user) return "/login";
  if (user.role === "driver") return "/driver";
  if (user.role === "gate") return "/gate";
  return "/admin";
}

const ENTRIES = [
  {
    to: "/login?role=driver",
    code: "01",
    title: "司机 / 自提",
    desc: "培训 · 证件 · 报到",
  },
  {
    to: "/login?role=gate",
    code: "02",
    title: "门岗作业台",
    desc: "安检 · 放行 · 在场",
  },
  {
    to: "/login?role=admin",
    code: "03",
    title: "管理后台",
    desc: "看板 · 台账 · 审计",
  },
];

export default function Portal() {
  const user = getUser();
  const pagesDemo = isPagesDemo();

  return (
    <div className="stage">
      <div className="stage-glow stage-glow-a" aria-hidden />
      <div className="stage-glow stage-glow-b" aria-hidden />
      <div className="stage-grid" aria-hidden />

      <header className="stage-nav">
        <div className="stage-logo">
          <span className="stage-logo-mark" aria-hidden />
          <span>Gate Safety</span>
        </div>
        {pagesDemo && <span className="stage-badge">Demo</span>}
        {user && (
          <Link className="stage-nav-link" to={homeFor(user)}>
            继续 · {user.name}
          </Link>
        )}
      </header>

      <main className="stage-main">
        <p className="stage-eyebrow">Enterprise Yard Access</p>
        <h1 className="stage-title">
          承运商安全
          <br />
          准入管理系统
        </h1>

        <nav className="stage-entries" aria-label="入口">
          {ENTRIES.map((e) => (
            <Link key={e.to} className="stage-entry" to={e.to}>
              <span className="stage-entry-code">{e.code}</span>
              <span className="stage-entry-body">
                <strong>{e.title}</strong>
                <span>{e.desc}</span>
              </span>
              <span className="stage-entry-go" aria-hidden>
                →
              </span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
