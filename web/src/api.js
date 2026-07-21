import { isPagesDemo, mockApi, reclaimDemoStorage } from "./mockApi";

const TOKEN_KEY = "cgs_token";
const USER_KEY = "cgs_user";

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
      e?.message?.includes("quota") || e?.name === "QuotaExceededError"
        ? "浏览器本地存储已满，请清除本站数据后重试"
        : e.message || "无法保存登录状态"
    );
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function api(path, options = {}) {
  if (isPagesDemo()) {
    return mockApi(path, {
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
}
