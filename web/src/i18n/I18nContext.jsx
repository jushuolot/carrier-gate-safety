import { createContext, useContext, useEffect, useMemo, useState } from "react";
import messages from "./messages";

const LANG_KEY = "cgs_lang";
const I18nContext = createContext(null);

function detectLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || "zh").toLowerCase();
  return nav.startsWith("en") ? "en" : "zh";
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);

  function setLang(next) {
    const v = next === "en" ? "en" : "zh";
    setLangState(v);
    try {
      localStorage.setItem(LANG_KEY, v);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.title =
      lang === "en"
        ? "EHS Digital Management System"
        : "EHS数字化管理系统 · EHS Digital Management System";
  }, [lang]);

  const value = useMemo(() => {
    const dict = messages[lang] || messages.zh;
    const t = (key) => dict[key] ?? messages.zh[key] ?? key;
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
      <button
        type="button"
        className={lang === "zh" ? "on" : ""}
        onClick={() => setLang("zh")}
      >
        {t("langZh")}
      </button>
      <button
        type="button"
        className={lang === "en" ? "on" : ""}
        onClick={() => setLang("en")}
      >
        {t("langEn")}
      </button>
    </div>
  );
}

/** 品牌标题块：当前语言主标 + 另一语言副标 */
export function BrandLockup({ variant = "dark", compact = false }) {
  const { t } = useI18n();
  return (
    <div className={`brand-lockup brand-lockup-${variant} ${compact ? "compact" : ""}`}>
      <div className="brand-lockup-title">{t("brand")}</div>
      <div className="brand-lockup-sub">{t("brandEn")}</div>
    </div>
  );
}
