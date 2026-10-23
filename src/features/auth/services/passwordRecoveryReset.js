import { authApi } from "@/features/auth/lib/authApi";
import { clearAuthSession } from "@/features/auth/lib/authSession";
import { APP_ROUTES } from "@/shared/config/routes";
let challenge;
export async function passwordRecoveryResetService(payload) {
  if (!challenge) {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const query = new URLSearchParams(window.location.search);
    challenge = { token: fragment.get("token") || query.get("token"), activation: window.location.pathname === "/first-access" || query.get("flow") === "activation" };
    window.history.replaceState(null, "", window.location.pathname);
  }
  if (!challenge.token) throw new Error("Convite ou token não encontrado no link.");
  const operation = challenge.activation ? authApi.completeActivation : authApi.resetPasswordByToken;
  await operation({ token: challenge.token, newPassword: String(payload.password || "") });
  challenge = null;
  clearAuthSession();
  return { ok: true, redirectTo: APP_ROUTES.LOGIN, message: "Senha definida. Entre com sua identificação e nova senha." };
}
