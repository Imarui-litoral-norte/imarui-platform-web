import { authApi } from "@/features/auth/lib/authApi";
export async function forgotPasswordService(payload) {
  await authApi.createPasswordRecoveryRequest({ identityKind: payload.identityKind || "PERSON", identifier: String(payload.identifier || "").trim() });
  return { ok: true, resetForm: true, message: "Se a identidade estiver apta, as instruções serão enviadas ao contato cadastrado." };
}
