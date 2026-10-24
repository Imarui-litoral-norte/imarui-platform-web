import { authApi, clearAuthSession, getOrCreateDeviceId, readAuthSession } from "@/features/auth";
import { buildGatewayUrl } from "@/shared/network/gatewayUrl";

let refresh: Promise<unknown> | null = null;
/** Auth is composed at the View layer; the financial feature does not import sibling features. */
export async function receivablesRequest(path: string, signal: AbortSignal, retry = true): Promise<unknown> {
  const session = readAuthSession();
  if (!session?.accessToken) throw new Error("Sessão autenticada não encontrada. Entre novamente.");
  let response: Response;
  try { response = await fetch(buildGatewayUrl(path), { signal, cache: "no-store", headers: {
    Accept: "application/json", Authorization: `Bearer ${session.accessToken}`, "X-Device-Id": getOrCreateDeviceId(),
  } }); } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Não foi possível conectar ao serviço de boletos. Tente atualizar novamente.");
  }
  if (response.status === 401 && retry) {
    refresh ??= Promise.resolve(authApi.refresh()).finally(() => { refresh = null; });
    await refresh;
    signal.throwIfAborted();
    return receivablesRequest(path, signal, false);
  }
  if (response.status === 401) { clearAuthSession(); throw new Error("Sua sessão expirou. Entre novamente."); }
  if (response.status === 403) throw new Error("Acesso negado. Solicite a permissão de consulta de boletos ao administrador.");
  if (response.status === 404) throw new Error("Este título não está mais disponível na carteira atual. Atualize a lista.");
  if (!response.ok) throw new Error("Não foi possível consultar a carteira. Tente atualizar novamente.");
  return response.json();
}

