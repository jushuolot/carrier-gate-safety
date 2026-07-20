import { useEffect, useState } from "react";
import { api } from "../../api";

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

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>设备与对接</h2>
      <p className="muted">
        管理域查看适配器状态与事件流；日常开闸由门岗作业台在放行时自动触发。厂商 stub
        离线表示待对接。
      </p>

      <div className="card">
        <table className="table">
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
                  <strong>{d.name}</strong>
                  <div className="muted">{d.id}</div>
                </td>
                <td>{d.type}</td>
                <td>
                  <span className={`pill ${d.online ? "ok" : "bad"}`}>
                    {d.online ? "在线" : "离线/未对接"}
                  </span>
                </td>
                <td>
                  <div className="row">
                    {d.type === "barrier" && d.online && (
                      <>
                        <button className="btn" type="button" onClick={() => exec(d.id, "open")}>
                          开闸
                        </button>
                        <button className="btn" type="button" onClick={() => exec(d.id, "close")}>
                          关闸
                        </button>
                      </>
                    )}
                    {d.type === "lpr" && d.online && (
                      <button className="btn" type="button" onClick={() => exec(d.id, "capture")}>
                        抓拍车牌
                      </button>
                    )}
                    {d.type === "weighbridge" && d.online && (
                      <button className="btn" type="button" onClick={() => exec(d.id, "read")}>
                        读磅
                      </button>
                    )}
                    {d.type === "camera" && d.online && (
                      <button className="btn" type="button" onClick={() => exec(d.id, "snapshot")}>
                        抓拍
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {msg && (
          <pre style={{ fontSize: 12, background: "#f8fafc", padding: 10, borderRadius: 8 }}>
            {msg}
          </pre>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <strong>设备事件流</strong>
        <table className="table">
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
                <td>{e.created_at}</td>
                <td>
                  {e.device_type}/{e.device_id}
                </td>
                <td>{e.event_type}</td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {JSON.stringify(e.payload)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
