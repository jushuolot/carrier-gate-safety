import { Link } from "react-router-dom";
import { getUser } from "../api";
import { isPagesDemo } from "../mockApi";
import BrandMark from "../components/BrandMark";
import StageBands from "../components/StageBands";
import { BrandLockup, LangSwitch, useI18n } from "../i18n/I18nContext";

function homeFor(user) {
  if (!user) return "/login";
  if (user.role === "driver") return "/driver";
  if (user.role === "gate") return "/gate";
  return "/admin";
}

export default function Portal() {
  const user = getUser();
  const pagesDemo = isPagesDemo();
  const { t } = useI18n();

  const entries = [
    { to: "/login?role=driver", title: t("entryDriver"), desc: t("entryDriverDesc") },
    { to: "/login?role=gate", title: t("entryGate"), desc: t("entryGateDesc") },
    { to: "/login?role=admin", title: t("entryAdmin"), desc: t("entryAdminDesc") },
  ];

  return (
    <div className="stage">
      <StageBands />

      <header className="stage-nav">
        <div className="stage-logo">
          <BrandMark className="stage-logo-mark" />
          <span className="stage-logo-text">{t("brandShort")}</span>
        </div>
        <div className="stage-nav-right">
          {pagesDemo && <span className="stage-badge">{t("demo")}</span>}
          <LangSwitch className="lang-switch-dark" />
          {user && (
            <Link className="stage-nav-link" to={homeFor(user)}>
              {t("continue")}
            </Link>
          )}
        </div>
      </header>

      <main className="stage-main">
        <div className="stage-hero">
          <BrandLockup variant="hero" />
          <p className="stage-lead">{t("portalLead")}</p>
        </div>

        <nav className="stage-entries" aria-label="entries">
          {entries.map((e, i) => (
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
