const SESSION_KEY = "logimarui.auth.session";
const DEVICE_KEY = "logimarui.auth.device-id";
let session = null;
let channel;
const browser = () => typeof window !== "undefined";
function initialize() {
  if (!browser()) return;
  // Remove old persisted access/refresh tokens when upgrading the existing browser.
  try { window.localStorage.removeItem(SESSION_KEY); window.sessionStorage?.removeItem(SESSION_KEY); } catch {}
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("logimarui.iiam.session");
    channel.onmessage = ({ data }) => {
      if (data?.type === "logout") session = null;
      else if (data?.type === "session" && data.session?.accessToken) session = data.session;
      else return;
      window.dispatchEvent(new CustomEvent("iiam-session-change", { detail: { type: data.type } }));
    };
  }
}
export function getOrCreateDeviceId() {
  if (!browser()) return "";
  try {
    let value = window.localStorage.getItem(DEVICE_KEY);
    if (!value) { value = crypto.randomUUID(); window.localStorage.setItem(DEVICE_KEY, value); }
    return value;
  } catch { return ""; }
}
export function readAuthSession() { initialize(); return session; }
export function saveAuthSession(tokens, profile = null) {
  initialize();
  const expiresInSeconds = Number(tokens?.expiresIn ?? tokens?.expiresInSeconds ?? 0);
  if (!tokens?.accessToken || expiresInSeconds <= 0 || expiresInSeconds > 900) throw new Error("Resposta de sessão IIAM inválida.");
  session = { accessToken: tokens.accessToken, expiresInSeconds,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(), profile, savedAt: new Date().toISOString() };
  channel?.postMessage({ type: "session", session });
  return session;
}
export function replaceAuthSession(value) {
  if (!value?.accessToken) return null;
  session = { accessToken: value.accessToken, expiresInSeconds: value.expiresInSeconds,
    expiresAt: value.expiresAt, profile: value.profile, savedAt: new Date().toISOString() };
  return session;
}
export function updateAuthSessionProfile(profile) { return session ? replaceAuthSession({ ...session, profile }) : null; }
export function clearAuthSession() { initialize(); session = null; channel?.postMessage({ type: "logout" }); }
