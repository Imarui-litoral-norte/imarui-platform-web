import { authApi } from "@/features/auth/lib/authApi";
import { buildSessionResult } from "@/features/auth/lib/authResult";
import { persistSession } from "@/features/auth/services/shared";
import { APP_ROUTES } from "@/shared/config/routes";
export async function loginService(payload) {
  const tokens = await authApi.login({ identifier: String(payload.identifier || "").trim(), password: String(payload.password || "") });
  const { profile } = await persistSession(tokens);
  return { ok: true, redirectTo: APP_ROUTES.HOME, message: "Sessão iniciada com sucesso.", result: buildSessionResult(tokens, profile) };
}
