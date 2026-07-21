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
    title: "司机 / 自提",
    desc: "培训、证件与报到",
  },
  {
    to: "/login?role=gate",
    title: "门岗作业台",
    desc: "安检、放行与在场",
  },
  {
    to: "/login?role=admin",
    title: "管理后台",
    desc: "看板、台账与审计",
  },
];

export default function Portal() {
  const user = getUser();
  const pagesDemo = isPagesDemo();

  return (
    <div className="stage">
      <div className="stage-photo" aria-hidden />

      <header className="stage-nav">
        <div className="stage-logo">
          <span className="stage-logo-mark" aria-hidden />
          <span>Gate Safety</span>
        </div>
        {pagesDemo && <span className="stage-badge">Demo</span>}
        {user && (
          <Link className="stage-nav-link" to={homeFor(user)}>
            继续
          </Link>
        )}
      </header>

      <main className="stage-main">
        <div className="stage-hero">
          <h1 className="stage-brand">承运商安全</h1>
          <p className="stage-lead">到离场准入，一站完成培训、证件与放行。</p>
        </div>

        <nav className="stage-entries" aria-label="入口">
          {ENTRIES.map((e, i) => (
            <Link
              key={e.to}
              className="stage-entry"
              to={e.to}
              style={{ animationDelay: `${0.08 + i * 0.06}s` }}
            >
              <span className="stage-entry-body">
                <strong>{e.title}</strong>
                <span>{e.desc}</span>
              </span>
              <span className="stage-entry-go" aria-hidden>
                ›
              </span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
