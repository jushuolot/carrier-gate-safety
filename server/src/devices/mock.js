import { nanoid } from "nanoid";

/**
 * 模拟设备适配器 —— 本地演示 / CI 用。
 * 生产替换：实现同一 execute/ping 契约即可挂到 DeviceHub。
 */
export function createMockAdapters({ onEvent } = {}) {
  const emit = (deviceType, deviceId, eventType, payload) => {
    if (onEvent) onEvent({ deviceType, deviceId, eventType, payload });
  };

  const barrierIn = {
    id: "barrier-in-1",
    type: "barrier",
    name: "一号门入口道闸（模拟）",
    async ping() {
      return { online: true, meta: { vendor: "mock", firmware: "1.0.0" } };
    },
    async execute(cmd, params = {}) {
      if (cmd === "open") {
        const result = {
          ok: true,
          cmd,
          gate: "open",
          direction: params.direction || "in",
          visitId: params.visitId || null,
          at: new Date().toISOString(),
          txnId: nanoid(10),
        };
        emit("barrier", this.id, "opened", result);
        return result;
      }
      if (cmd === "close") {
        const result = { ok: true, cmd, gate: "closed", at: new Date().toISOString() };
        emit("barrier", this.id, "closed", result);
        return result;
      }
      throw new Error(`barrier 不支持指令: ${cmd}`);
    },
  };

  const barrierOut = {
    id: "barrier-out-1",
    type: "barrier",
    name: "一号门出口道闸（模拟）",
    async ping() {
      return { online: true, meta: { vendor: "mock" } };
    },
    async execute(cmd, params = {}) {
      if (cmd === "open") {
        const result = {
          ok: true,
          cmd,
          gate: "open",
          direction: "out",
          visitId: params.visitId || null,
          at: new Date().toISOString(),
          txnId: nanoid(10),
        };
        emit("barrier", this.id, "opened", result);
        return result;
      }
      if (cmd === "close") {
        return { ok: true, cmd, gate: "closed", at: new Date().toISOString() };
      }
      throw new Error(`barrier 不支持指令: ${cmd}`);
    },
  };

  const lpr = {
    id: "lpr-gate-1",
    type: "lpr",
    name: "入口车牌识别（模拟）",
    _lastPlate: "沪A12345",
    async ping() {
      return { online: true, meta: { vendor: "mock-lpr" } };
    },
    async execute(cmd, params = {}) {
      if (cmd === "capture") {
        const plate = params.plateNo || this._lastPlate;
        const result = {
          ok: true,
          plateNo: plate,
          confidence: 0.96,
          imageUrl: null,
          at: new Date().toISOString(),
        };
        emit("lpr", this.id, "plate_captured", result);
        return result;
      }
      if (cmd === "set_demo_plate") {
        this._lastPlate = params.plateNo;
        return { ok: true, plateNo: this._lastPlate };
      }
      throw new Error(`lpr 不支持指令: ${cmd}`);
    },
  };

  const camera = {
    id: "cam-gate-1",
    type: "camera",
    name: "门岗抓拍相机（模拟）",
    async ping() {
      return { online: true };
    },
    async execute(cmd, params = {}) {
      if (cmd === "snapshot") {
        const result = {
          ok: true,
          visitId: params.visitId || null,
          imageId: `snap_${nanoid(8)}`,
          at: new Date().toISOString(),
        };
        emit("camera", this.id, "snapshot", result);
        return result;
      }
      throw new Error(`camera 不支持指令: ${cmd}`);
    },
  };

  const weighbridge = {
    id: "scale-1",
    type: "weighbridge",
    name: "地磅 1#（模拟）",
    async ping() {
      return { online: true, meta: { unit: "kg" } };
    },
    async execute(cmd) {
      if (cmd === "read") {
        const kg = 12000 + Math.floor(Math.random() * 8000);
        const result = { ok: true, weightKg: kg, stable: true, at: new Date().toISOString() };
        emit("weighbridge", this.id, "weight", result);
        return result;
      }
      throw new Error(`weighbridge 不支持指令: ${cmd}`);
    },
  };

  const face = {
    id: "face-1",
    type: "face",
    name: "人脸核验终端（模拟·可选）",
    async ping() {
      return { online: true, meta: { enabled: false, note: "默认关闭，预留对接" } };
    },
    async execute(cmd, params = {}) {
      if (cmd === "verify") {
        const result = {
          ok: true,
          matched: true,
          driverId: params.driverId || null,
          score: 0.91,
          at: new Date().toISOString(),
          note: "模拟通过；生产对接后人脸 SDK",
        };
        emit("face", this.id, "verified", result);
        return result;
      }
      throw new Error(`face 不支持指令: ${cmd}`);
    },
  };

  return [barrierIn, barrierOut, lpr, camera, weighbridge, face];
}

/**
 * 厂商适配器脚手架（未实现，供集成时复制）
 * @example
 * export const hikvisionBarrier = {
 *   id: 'hik-barrier-1', type: 'barrier', name: '海康道闸',
 *   async ping() { ... },
 *   async execute(cmd, params) { // 调厂商 SDK/HTTP }
 * }
 */
export const vendorAdapterStubs = {
  hikvision_barrier: {
    id: "hik-barrier-stub",
    type: "barrier",
    name: "海康道闸（待对接）",
    async ping() {
      return { online: false, meta: { stub: true } };
    },
    async execute() {
      throw new Error("海康道闸适配器尚未实现：请在 adapters/hikvision.js 中对接");
    },
  },
  dahua_lpr: {
    id: "dahua-lpr-stub",
    type: "lpr",
    name: "大华车牌识别（待对接）",
    async ping() {
      return { online: false, meta: { stub: true } };
    },
    async execute() {
      throw new Error("大华 LPR 适配器尚未实现：请在 adapters/dahua-lpr.js 中对接");
    },
  },
};
