import { authApi } from "@/features/auth/lib/authApi";
import { normalizeCpf } from "@/features/auth/services/shared";
export async function registerService(payload) {
  const result = await authApi.register({ type: "PERSON", fullName: String(payload.name || "").trim(),
    nickname: String(payload.nickname || "").trim(), cpf: normalizeCpf(payload.cpf), email: String(payload.email || "").trim(),
    phoneNumber: String(payload.phoneNumber || "").trim() || null });
  return { ok: true, resetForm: true, message: "Solicitação enviada. Aguarde a aprovação e o convite para definir sua senha.",
    result: { title: "Solicitação de identidade", items: [{ label: "Protocolo", value: result.id }, { label: "Situação", value: result.status }] } };
}
