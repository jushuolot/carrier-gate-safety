import { createContext, useContext, useEffect, useMemo, useState } from "react";
import messages from "./messages";

const LANG_KEY = "cgs_lang";
const I18nContext = createContext(null);

function detectLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "zh" || saved === "en" || saved === "de") return saved;
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || "zh").toLowerCase();
  if (nav.startsWith("de")) return "de";
  if (nav.startsWith("en")) return "en";
  return "zh";
}

const TITLES = {
  zh: "EHS数字化管理系统 · EHS Digital Management System",
  en: "EHS Digital Management System",
  de: "EHS Digitales Managementsystem",
};

const HTML_LANG = { zh: "zh-CN", en: "en", de: "de" };

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);

  function setLang(next) {
    const v = next === "en" || next === "de" ? next : "zh";
    setLangState(v);
    try {
      localStorage.setItem(LANG_KEY, v);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang] || "zh-CN";
    document.title = TITLES[lang] || TITLES.zh;
  }, [lang]);

  const value = useMemo(() => {
    const dict = messages[lang] || messages.zh;
    const t = (key, vars) => {
      let s = dict[key] ?? messages.zh[key] ?? key;
      if (vars && typeof s === "string") {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replaceAll(`{${k}}`, String(v ?? ""));
        }
      }
      return s;
    };
    return { lang, setLang, t, dict };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function LangSwitch({ className = "" }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label="Language">
      <button type="button" className={lang === "zh" ? "on" : ""} onClick={() => setLang("zh")}>
        {t("langZh")}
      </button>
      <button type="button" className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>
        {t("langEn")}
      </button>
      <button type="button" className={lang === "de" ? "on" : ""} onClick={() => setLang("de")}>
        {t("langDe")}
      </button>
    </div>
  );
}

/** Brand lockup: primary title + secondary language line */
export function BrandLockup({ variant = "dark", compact = false }) {
  const { t } = useI18n();
  return (
    <div className={`brand-lockup brand-lockup-${variant} ${compact ? "compact" : ""}`}>
      <div className="brand-lockup-title">{t("brand")}</div>
      <div className="brand-lockup-sub">{t("brandAlt")}</div>
    </div>
  );
}
