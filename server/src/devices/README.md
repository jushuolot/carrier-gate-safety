# 设备对接说明

业务层只调用 `DeviceHub`，不直接依赖厂商 SDK。

## 已注册设备（默认 mock）

| ID | 类型 | 用途 |
|----|------|------|
| `barrier-in-1` | barrier | 入口道闸开/关 |
| `barrier-out-1` | barrier | 出口道闸开/关 |
| `lpr-gate-1` | lpr | 车牌识别 |
| `cam-gate-1` | camera | 门岗抓拍 |
| `scale-1` | weighbridge | 地磅读数 |
| `face-1` | face | 人脸核验（预留） |

另有 `hik-barrier-stub` / `dahua-lpr-stub` 占位，`ping` 返回 offline。

## 对接步骤

1. 在 `server/src/devices/adapters/` 新建厂商文件，实现：
   - `id` / `type` / `name`
   - `ping()` → `{ online, meta? }`
   - `execute(cmd, params)` → 厂商协议结果
2. 在 `index.js` 中 `deviceHub.register(adapter)`，可按环境变量切换 mock / 实装。
3. 业务放行点已调用：
   - 安检通过 → `openBarrier('barrier-in-1')` + `snapshot`
   - 离场完成 → `openBarrier('barrier-out-1')` + `readWeight`
4. 设备事件写入 `device_events`，可在后台「设备」页查看。

## HTTP 调试

```http
GET  /api/devices
POST /api/devices/:id/execute  { "cmd": "open", "params": { "visitId": "..." } }
POST /api/devices/lpr/simulate { "plateNo": "沪A12345" }
```
