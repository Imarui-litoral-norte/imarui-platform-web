import { clearAuthSession, readAuthSession, saveAuthSession } from "@/features/auth/lib/authSession";
import { buildGatewayUrl } from "@/shared/network/gatewayUrl";
const AUTH = "/api/iam/authentication";
let refreshInFlight;
async function bodyOf(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); } catch {
    if (response.ok) throw new Error("O serviço retornou uma resposta inválida.");
    return { detail: text };
  }
}
async function csrfToken() {
  const response = await fetch(buildGatewayUrl(`${AUTH}/csrf`), { credentials: "include", cache: "no-store" });
  const body = await bodyOf(response);
  if (!response.ok || !body?.token) throw Object.assign(new Error("Não foi possível preparar a proteção CSRF."), { status: response.status });
  return body.token;
}
export async function authRequest(path, { method = "GET", body, authenticated = false, accessToken, csrf = false, signal, retry = true } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = accessToken || (authenticated ? readAuthSession()?.accessToken : null);
  if (token) headers.Authorization = `Bearer ${token}`;
  if (csrf) headers["X-XSRF-TOKEN"] = await csrfToken();
  let response;
  try { response = await fetch(buildGatewayUrl(path), { method, headers, credentials: "include", cache: "no-store", signal,
    body: body !== undefined ? JSON.stringify(body) : undefined }); }
  catch (error) { if (error?.name === "AbortError") throw error; throw new Error("Não foi possível conectar ao gateway."); }
  const payload = await bodyOf(response);
  if (!response.ok) {
    if (response.status === 401 && authenticated && !accessToken && retry) {
      await refreshSession();
      return authRequest(path, { method, body, authenticated, csrf, signal, retry: false });
    }
    throw Object.assign(new Error(payload?.detail || payload?.message || payload?.title || `Solicitação recusada (${response.status}).`),
      { status: response.status, code: payload?.code });
  }
  return payload;
}
async function publishBrowserContext(accessToken) {
  return authRequest("/api/v1/gateway/browser-context", { method: "POST", authenticated: true, accessToken, retry: false });
}
export function refreshSession() {
  if (refreshInFlight) return refreshInFlight;
  const rotate = async () => {
    const previous = readAuthSession();
    try {
      const tokens = await authRequest(`${AUTH}/refresh`, { method: "POST", csrf: true, retry: false });
      await publishBrowserContext(tokens.accessToken);
      return saveAuthSession(tokens, previous?.profile);
    } catch (error) { clearAuthSession(); throw error; }
  };
  if (typeof navigator === "undefined" || !navigator.locks?.request) {
    return Promise.reject(new Error("A renovação segura entre abas exige um navegador com Web Locks em HTTPS. Entre novamente."));
  }
  refreshInFlight = navigator.locks.request("logimarui-iiam-refresh", rotate).finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}
export const authApi = {
  async login(payload) {
    const tokens = await authRequest(`${AUTH}/login`, { method: "POST", body: payload, csrf: true });
    await publishBrowserContext(tokens.accessToken);
    return { ...tokens, expiresInSeconds: tokens.expiresIn };
  },
  register: (payload) => authRequest("/api/iam/api/v1/identity-applications", { method: "POST", body: payload }),
  createPasswordRecoveryRequest: (payload) => authRequest(`${AUTH}/recovery/request`, { method: "POST", body: payload }),
  sendPasswordRecoveryEmailToken: (payload) => authRequest(`${AUTH}/recovery/request`, { method: "POST", body: payload }),
  resetPasswordByToken: ({ token, newPassword }) => authRequest(`${AUTH}/recovery/complete`, { method: "POST", body: { token, password: newPassword } }),
  completeActivation: ({ token, newPassword }) => authRequest(`${AUTH}/activation/complete`, { method: "POST", body: { token, password: newPassword } }),
  async me({ accessToken, signal } = {}) {
    const profile = await authRequest("/api/v1/gateway/me", { authenticated: true, accessToken, signal });
    // Administrative introspection is optional; ordinary users never receive AUDIT_READ just for navigation.
    try {
      const internal = [];
      for (let page = 0; page < 10; page += 1) {
        const result = await authRequest(`/api/iam/api/v1/authorization/admin/effective-permissions?identityId=${encodeURIComponent(profile.identityId)}&scopeId=00000000-0000-0000-0000-000000000001&page=${page}&size=100`, { authenticated: true, accessToken, signal });
        internal.push(...(result.items || []).filter(item => item.allowed).map(item => item.code));
        if ((page + 1) * 100 >= result.total) break;
      }
      profile.authorities = [...new Set([...(profile.authorities || []), ...internal])];
    } catch (error) { if (error.status !== 403) throw error; }
    return profile;
  },
  async logout() {
    const token = readAuthSession()?.accessToken;
    try { if (token) await authRequest("/api/v1/gateway/browser-context", { method: "DELETE", authenticated: true, accessToken: token, retry: false }); }
    finally { await authRequest(`${AUTH}/logout`, { method: "POST", csrf: true, retry: false }); }
  },
  refresh: refreshSession,
};
