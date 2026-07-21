/** Simple visual pass code block (QR-style grid from code hash, no deps). */
import { useI18n } from "../i18n/I18nContext";
import { riskLevelLabel } from "../i18n/labels";

export function PassCodeCard({ code, hint }) {
  const { t } = useI18n();
  if (!code) return null;
  const cells = [];
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0;
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const bit = (h >> ((x + y * 7) % 28)) & 1;
      const border = x === 0 || y === 0 || x === 6 || y === 6;
      cells.push(border || bit);
      h = (h * 1103515245 + 12345) >>> 0;
    }
  }
  return (
    <div className="pass-card">
      <div className="pass-qr" aria-hidden>
        {cells.map((on, i) => (
          <i key={i} className={on ? "on" : ""} />
        ))}
      </div>
      <div className="pass-meta">
        <div className="pass-code">{code}</div>
        <p className="muted">{hint || t("passCodeDefaultHint")}</p>
      </div>
    </div>
  );
}

export function RiskPill({ level, score }) {
  const { t } = useI18n();
  if (!level && score == null) return null;
  const lv = level || (score >= 60 ? "high" : score >= 35 ? "medium" : "low");
  const label = riskLevelLabel(t, lv);
  return (
    <span className={`risk-pill ${lv}`}>
      {label}
      {score != null ? ` · ${score}` : ""}
    </span>
  );
}
