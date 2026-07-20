/**
 * 设备对接抽象层
 * 业务只依赖 DeviceHub；具体厂商实现放在 adapters/ 下替换即可。
 */

/** @typedef {'barrier'|'lpr'|'camera'|'weighbridge'|'face'} DeviceType */

/**
 * @typedef {Object} DeviceAdapter
 * @property {string} id
 * @property {DeviceType} type
 * @property {string} name
 * @property {() => Promise<{ online: boolean, meta?: object }>} ping
 * @property {(cmd: string, params?: object) => Promise<object>} execute
 */

export class DeviceHub {
  /** @param {Map<string, DeviceAdapter>} adapters */
  constructor(adapters = new Map()) {
    this.adapters = adapters;
  }

  register(adapter) {
    this.adapters.set(adapter.id, adapter);
    return this;
  }

  list() {
    return [...this.adapters.values()].map((a) => ({
      id: a.id,
      type: a.type,
      name: a.name,
    }));
  }

  get(id) {
    const a = this.adapters.get(id);
    if (!a) throw new Error(`设备未注册: ${id}`);
    return a;
  }

  async statusAll() {
    const rows = [];
    for (const a of this.adapters.values()) {
      try {
        const st = await a.ping();
        rows.push({ id: a.id, type: a.type, name: a.name, ...st });
      } catch (e) {
        rows.push({
          id: a.id,
          type: a.type,
          name: a.name,
          online: false,
          error: String(e.message || e),
        });
      }
    }
    return rows;
  }

  /** 开闸放行 */
  async openBarrier(deviceId, { visitId, direction = "in", reason } = {}) {
    return this.get(deviceId).execute("open", { visitId, direction, reason });
  }

  /** 关闸 */
  async closeBarrier(deviceId) {
    return this.get(deviceId).execute("close", {});
  }

  /** 触发车牌识别 */
  async capturePlate(deviceId) {
    return this.get(deviceId).execute("capture", {});
  }

  /** 抓拍 */
  async snapshot(deviceId, { visitId } = {}) {
    return this.get(deviceId).execute("snapshot", { visitId });
  }

  /** 读地磅 */
  async readWeight(deviceId) {
    return this.get(deviceId).execute("read", {});
  }

  /** 人脸核验（可选） */
  async verifyFace(deviceId, { driverId } = {}) {
    return this.get(deviceId).execute("verify", { driverId });
  }
}
