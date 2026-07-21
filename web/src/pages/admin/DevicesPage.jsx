import { useEffect, useState } from "react";
import { api } from "../../api";

function formatAt(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(iso).slice(0, 19);
  }
}

export default function DevicesPage() {
  const [items, setItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const d = await api("/devices");
    setItems(d.items);
    try {
      const e = await api("/device-events");
      setEvents(e.items);
    } catch {
      setEvents([]);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function exec(id, cmd) {
    try {
      const r = await api(`/devices/${id}/execute`, {
        method: "POST",
        body: { cmd, params: {} },
      });
      setMsg(JSON.stringify(r.result));
      await load();
    } catch (e) {
      setMsg(e.message);
    }
  }

  function actions(d) {
    if (!d.online) return null;
    if (d.type === "barrier") {
      return (
        <>
          <button className="btn" type="button" onClick={() => exec(d.id, "open")}>
            开闸
          </button>
          <button className="btn" type="button" onClick={() => exec(d.id, "close")}>
            关闸
          </button>
        </>
      );
    }
    if (d.type === "lpr") {
      return (
        <button className="btn" type="button" onClick={() => exec(d.id, "capture")}>
          抓拍车牌
        </button>
      );
    }
    if (d.type === "weighbridge") {
      return (
        <button className="btn" type="button" onClick={() => exec(d.id, "read")}>
          读磅
        </button>
      );
    }
    if (d.type === "camera") {
      return (
        <button className="btn" type="button" onClick={() => exec(d.id, "snapshot")}>
          抓拍
        </button>
      );
    }
    return null;
  }

  return (
    <div className="page-block">
      <header className="page-head">
        <h2>设备与对接</h2>
        <p className="muted">适配器状态与事件流；日常开闸由门岗放行时触发。厂商 stub 离线表示待对接。</p>
      </header>

      <ul className="record-list mobile-only">
        {items.map((d) => (
          <li key={d.id} className="card record-card">
            <div className="record-card-top">
              <strong>{d.name}</strong>
              <span className={`pill ${d.online ? "ok" : "bad"}`}>
                {d.online ? "在线" : "离线/未对接"}
              </span>
            </div>
            <p className="record-sub muted">
              {d.type} · {d.id}
            </p>
            <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
              {actions(d)}
            </div>
          </li>
        ))}
      </ul>

      <div className="card desk-only table-panel">
        <div className="table-scroll">
          <table className="table table-comfortable">
            <thead>
              <tr>
                <th>设备</th>
                <th>类型</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="cell-stack">
                      <strong>{d.name}</strong>
                      <span className="muted">{d.id}</span>
                    </div>
                  </td>
                  <td>{d.type}</td>
                  <td>
                    <span className={`pill ${d.online ? "ok" : "bad"}`}>
                      {d.online ? "在线" : "离线/未对接"}
                    </span>
                  </td>
                  <td>
                    <div className="row" style={{ flexWrap: "wrap" }}>
                      {actions(d)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {msg && <pre className="result-pre">{msg}</pre>}
      </div>

      {msg && <pre className="result-pre mobile-only">{msg}</pre>}

      <section className="card panel-card" style={{ marginTop: 12 }}>
        <div className="panel-card-head">
          <strong>设备事件流</strong>
          <span className="muted">{events.length} 条</span>
        </div>

        <ul className="entity-list mobile-only">
          {!events.length && <li className="muted">暂无事件</li>}
          {events.map((e) => (
            <li key={e.id} className="entity-row entity-row-stack">
              <div className="entity-main">
                <div className="entity-primary">{e.event_type}</div>
                <div className="entity-secondary">
                  {e.device_type}/{e.device_id} · {formatAt(e.created_at)}
                </div>
                <div className="mono-soft muted" style={{ marginTop: 4, fontSize: 12 }}>
                  {JSON.stringify(e.payload)}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="table-scroll desk-only">
          <table className="table table-comfortable">
            <thead>
              <tr>
                <th>时间</th>
                <th>设备</th>
                <th>事件</th>
                <th>载荷</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">{formatAt(e.created_at)}</td>
                  <td className="cell-wrap">
                    {e.device_type}/{e.device_id}
                  </td>
                  <td>{e.event_type}</td>
                  <td className="muted mono-soft cell-wrap">{JSON.stringify(e.payload)}</td>
                </tr>
              ))}
              {!events.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    暂无事件
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
