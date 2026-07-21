import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, getUser } from "../../api";

const DRIVER_DOCS = [
  { type: "driver_license", label: "驾驶证" },
  { type: "qualification", label: "从业资格证" },
  { type: "id_card", label: "身份证" },
  { type: "hazmat_permit", label: "危化许可" },
  { type: "auth_letter", label: "授权委托书" },
  { type: "delivery_note", label: "提货单/DN" },
];

export default function DriverDocs() {
  const user = getUser();
  const [docs, setDocs] = useState([]);
  const [expireDays, setExpireDays] = useState(200);
  const [msg, setMsg] = useState("");
  const [lastOcr, setLastOcr] = useState(null);

  async function reload() {
    const data = await api(
      `/documents?subjectType=driver&subjectId=${user.driver_id}`
    );
    setDocs(data.items);
  }

  useEffect(() => {
    if (!user?.driver_id) return;
    reload().catch((e) => setMsg(e.message));
  }, [user?.driver_id]);

  async function runOcr(docType) {
    setMsg("OCR 识别中…");
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
      setMsg(`${r.label} 已归档 · 到期 ${r.ocr.expireAt} · 置信度 ${r.ocr.confidence}`);
      await reload();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div className="h5">
      <Link to="/driver" className="h5-back">
        ← 返回
      </Link>
      <h1 className="h5-title">资质上传</h1>
      <p className="h5-sub">③登记证件 · OCR 自动校验到期日（模拟）</p>

      <div className="card">
        <div className="field">
          <label>模拟证件剩余有效天数</label>
          <input
            type="number"
            value={expireDays}
            onChange={(e) => setExpireDays(e.target.value)}
          />
        </div>
        <div className="row">
          {DRIVER_DOCS.map((d) => (
            <button key={d.type} className="btn primary" type="button" onClick={() => runOcr(d.type)}>
              上传并识别{d.label}
            </button>
          ))}
        </div>
      </div>

      {lastOcr && (
        <div className="card" style={{ marginTop: 12 }}>
          <strong>OCR 结果</strong>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
            {JSON.stringify(lastOcr.ocr.fields, null, 2)}
          </pre>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <strong>我的证件</strong>
        <table className="table">
          <thead>
            <tr>
              <th>类型</th>
              <th>到期</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td>{d.label}</td>
                <td>{d.expire_at}</td>
                <td>
                  <span className={`pill ${d.status === "valid" ? "ok" : "warn"}`}>
                    {d.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
