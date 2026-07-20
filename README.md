# 承运商到离场 · 安全准入管理系统

按企业 EHS / 承包商准入实践实现的可运行管理系统：

- **三层身份**：承运商组织 / 司机 / 车辆
- **硬门禁**：首次须完成安全培训视频 + 答题，并上传资质（OCR 读到期日）
- **到离场状态机**：预约 → 报到 → 准入 → 安检 → 在场 → 离场收口
- **设备对接预留**：道闸、LPR、摄像抓拍、地磅（模拟适配器可切换）

## 快速启动

```bash
cd /Users/chenli/Downloads/cursor/carrier-gate-safety
npm install
npm run seed
npm run dev
```

- 管理后台 / 门岗：http://localhost:5175
- API：http://localhost:7080
- 健康检查：http://localhost:7080/api/health

## 演示账号

| 角色 | 手机号 | 密码 |
|------|--------|------|
| 系统管理员 | `13800000000` | `admin123` |
| EHS 安全员 | `13800000001` | `ehs123` |
| 门岗 | `13800000002` | `gate123` |
| 承运商管理员 | `13800000003` | `carrier123` |
| 司机（首次，需培训） | `13900000001` | `driver123` |
| 司机（已准入） | `13900000002` | `driver123` |

## 目录

```
server/   Express + SQLite API、准入引擎、设备适配层
web/      React 三端（门户 / 司机 H5 / 门岗与后台）
```

## 设备对接

见 `server/src/devices/`：统一 `DeviceAdapter` 接口，默认 `mock`。
生产可替换为海康/大华道闸、车牌识别相机、地磅仪表等实现，无需改业务状态机。
