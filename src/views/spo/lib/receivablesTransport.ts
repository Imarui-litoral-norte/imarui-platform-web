import { authApi, clearAuthSession, getOrCreateDeviceId, readAuthSession } from "@/features/auth";
import { buildGatewayUrl } from "@/shared/network/gatewayUrl";

let refresh: Promise<unknown> | null = null;
/** Auth is composed at the View layer; the financial feature does not import sibling features. */
async function receivablesResponse(path: string, signal: AbortSignal, accept: string, retry = true): Promise<Response> {
  const session = readAuthSession();
  if (!session?.accessToken) throw new Error("Sessão autenticada não encontrada. Entre novamente.");
  let response: Response;
  try { response = await fetch(buildGatewayUrl(path), { signal, cache: "no-store", headers: {
    Accept: accept, Authorization: `Bearer ${session.accessToken}`, "X-Device-Id": getOrCreateDeviceId(),
  } }); } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Não foi possível conectar ao serviço de boletos. Tente atualizar novamente.");
  }
  if (response.status === 401 && retry) {
    refresh ??= Promise.resolve(authApi.refresh()).finally(() => { refresh = null; });
    await refresh;
    signal.throwIfAborted();
    return receivablesResponse(path, signal, accept, false);
  }
  if (response.status === 401) { clearAuthSession(); throw new Error("Sua sessão expirou. Entre novamente."); }
  if (response.status === 403) throw new Error("Acesso negado. Solicite a permissão de consulta de boletos ao administrador.");
  if (response.status === 404) throw new Error("Este título não está mais disponível na carteira atual. Atualize a lista.");
  if (response.status === 400) throw new Error("Filtros inválidos. Revise os períodos e aplique os filtros novamente.");
  if (!response.ok) throw new Error("Não foi possível consultar a carteira. Tente atualizar novamente.");
  return response;
}

export async function receivablesRequest(path: string, signal: AbortSignal): Promise<unknown> {
  return (await receivablesResponse(path, signal, "application/json")).json();
}

export async function receivablesDownload(path: string, signal: AbortSignal): Promise<{ blob: Blob; filename: string }> {
  const response = await receivablesResponse(path, signal, "text/csv, application/json");
  if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "text/csv")
    throw new Error("O serviço não retornou um arquivo CSV válido. Tente exportar novamente.");
  const filename = response.headers.get("content-disposition")?.match(/filename="?(boletos-\d{4}-\d{2}-\d{2}\.csv)"?(?:;|$)/)?.[1] ?? "boletos.csv";
  return { blob: await response.blob(), filename };
}

