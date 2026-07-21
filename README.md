# EHS数字化管理系统 / EHS Digital Management System

承运商到离场 · 安全准入（厂区 EHS 数字化管理演示系统）：

- **中英文切换**：门户 / 登录 / 侧栏导航 / 司机首页等支持 ZH ↔ EN
- **三层身份**：承运商组织 / 司机 / 车辆
- **硬门禁**：首次须完成安全培训视频 + 答题，并上传资质（OCR 读到期日）
- **到离场状态机**：预约 → 培训/登记 → OCR → 门岗 Check In → 作业/离场检查 → 双签 Check Out
- **业务类型**：运输入场 / 运输出场 / 客户自提 / 临时车辆
- **设备对接预留**：道闸、LPR、摄像抓拍、地磅（模拟适配器可切换）

## 设计与开发文档（含完整代码）

- **[完整设计及开发文档](docs/设计与开发文档.md)** — 架构、生命周期、API、数据模型、验收
- **[附录：完整源代码](docs/附录-完整源代码.md)** — 全部业务源文件原文（离线审阅用）

## 在线演示（GitHub Pages）

**https://jushuolot.github.io/carrier-gate-safety/**

> Pages 版为浏览器内 mock（无后端），账号与本地相同。若网页打不开，多为网络访问 GitHub 问题，可改用本地启动。

## 快速启动（本地正式 API）

```bash
cd carrier-gate-safety
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
| 客户自提 | `13700000001` | `pickup123` |

## 目录

```
docs/     设计与开发文档 + 完整源码附录
server/   Express + SQLite API、准入引擎、设备适配层
web/      React 三端（门户 / 司机 H5 / 门岗与后台）
scripts/  全流程自检
```

## 自检

```bash
npm run selfcheck        # Pages Mock 全流程
npm run selfcheck:server # 本地 API（须先 seed + start）
npm run selfcheck:all
```

## 设备对接

见 `server/src/devices/`：统一 `DeviceAdapter` 接口，默认 `mock`。
生产可替换为海康/大华道闸、车牌识别相机、地磅仪表等实现，无需改业务状态机。
