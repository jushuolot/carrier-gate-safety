import { isPagesDemo, mockApi, reclaimDemoStorage } from "./mockApi";
import { translateApiError } from "./i18n/content";

const TOKEN_KEY = "cgs_token";
const USER_KEY = "cgs_user";
const LANG_KEY = "cgs_lang";

function currentLang() {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "en" || v === "de" || v === "zh") return v;
  } catch {
    /* ignore */
  }
  return "zh";
}

function localizedError(message) {
  return translateApiError(currentLang(), message);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (e) {
    // Pages 演示库占满配额时，腾出空间后再写会话
    if (isPagesDemo()) {
      reclaimDemoStorage();
      try {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        return;
      } catch {
        /* fall through */
      }
    }
    throw new Error(
      localizedError(
        e?.message?.includes("quota") || e?.name === "QuotaExceededError"
          ? "浏览器本地存储已满，请清除本站数据后重试"
          : e.message || "无法保存登录状态"
      )
    );
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function api(path, options = {}) {
  try {
    if (isPagesDemo()) {
      return await mockApi(path, {
        method: options.method || "GET",
        body: options.body,
        headers: {
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
      });
    }

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`/api${path}`, {
      ...options,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || res.statusText || "请求失败");
    return data;
  } catch (e) {
    throw new Error(localizedError(e.message || "请求失败"));
  }
}
