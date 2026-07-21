import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";
import { useI18n } from "../../i18n/I18nContext";
import { docTypeLabel, statusLabel } from "../../i18n/labels";

const DRIVER_DOC_TYPES = [
  "driver_license",
  "qualification",
  "id_card",
  "hazmat_permit",
  "auth_letter",
  "delivery_note",
];

export default function DriverDocs() {
  const user = getUser();
  const { t } = useI18n();
  const [docs, setDocs] = useState([]);
  const [expireDays, setExpireDays] = useState(200);
  const [msg, setMsg] = useState("");
  const [lastOcr, setLastOcr] = useState(null);

  async function reload() {
    const data = await api(`/documents?subjectType=driver&subjectId=${user.driver_id}`);
    setDocs(data.items);
  }

  useEffect(() => {
    if (!user?.driver_id) return;
    reload().catch((e) => setMsg(e.message));
  }, [user?.driver_id]);

  async function runOcr(docType) {
    setMsg(t("ocrProcessing"));
    try {
      const r = await api("/documents/ocr", {
        method: "POST",
        body: {
          subjectType: "driver",
          subjectId: user.driver_id,
          docType,
          forceExpireDays: Number(expireDays),
          hint: { name: user.name },
          confirm: true,
        },
      });
      setLastOcr(r);
      setMsg(
        t("ocrArchived", {
          label: docTypeLabel(t, docType),
          expire: r.ocr.expireAt,
          confidence: r.ocr.confidence,
        })
      );
      await reload();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="h5">
      <Link to="/driver" className="h5-back">
        ← {t("back")}
      </Link>
      <h1 className="h5-title">{t("docsUploadTitle")}</h1>
      <p className="h5-sub">{t("docsUploadSub")}</p>

      <div className="card">
        <div className="field">
          <label>{t("simExpireDays")}</label>
          <input
            type="number"
            value={expireDays}
            onChange={(e) => setExpireDays(e.target.value)}
          />
        </div>
        <div className="doc-actions">
          {DRIVER_DOC_TYPES.map((type) => (
            <button key={type} className="btn primary" type="button" onClick={() => runOcr(type)}>
              {t("uploadAndOcr", { label: docTypeLabel(t, type) })}
            </button>
          ))}
        </div>
      </div>

      {lastOcr && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>{t("ocrResult")}</strong>
          <pre className="result-pre" style={{ marginTop: 8 }}>
            {JSON.stringify(lastOcr.ocr.fields, null, 2)}
          </pre>
        </div>
      )}

      <div className="card panel-card" style={{ marginTop: 12 }}>
        <div className="panel-card-head">
          <strong>{t("myDocs")}</strong>
          <span className="muted">{t("docCount", { n: docs.length })}</span>
        </div>
        {!docs.length ? (
          <p className="muted" style={{ margin: "12px 0 0" }}>
            {t("noDocsUploaded")}
          </p>
        ) : (
          <ul className="entity-list">
            {docs.map((d) => (
              <li key={d.id} className="entity-row">
                <div className="entity-main">
                  <div className="entity-primary">{docTypeLabel(t, d.doc_type)}</div>
                  <div className="entity-secondary">{t("expiresOn", { date: d.expire_at || "-" })}</div>
                </div>
                <span className={`pill ${d.status === "valid" ? "ok" : "warn"}`}>
                  {statusLabel(t, d.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
