export const rowsOf = (value) =>
  Array.isArray(value) ? value : value?.items || value?.content || [];
export const labels = {
  ACTIVE: "Ativo",
  DISABLED: "Desabilitado",
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
  INACTIVE: "Inativo",
  ARCHIVED: "Arquivado",
  REVOKED: "Revogado",
  LOGGED_OUT: "Encerrada",
  EXPIRED: "Expirado",
  ROTATED: "Substituído",
  PERSON: "Pessoa física",
  LEGAL_ENTITY: "Pessoa jurídica",
  SERVICE: "Serviço",
  GLOBAL: "Global",
  SCOPE: "Escopo",
  TENANT: "Empresa",
  EMPLOYEE: "Funcionário",
  CUSTOMER: "Cliente",
  SUPPLIER: "Fornecedor",
  PARTNER: "Parceiro",
  EXTERNAL: "Externo",
  ALLOWED: "Permitido pelo perfil",
  EXPLICIT_DENY: "Negação explícita prevalece",
  NO_GRANT: "Sem concessão de acesso",
  INACTIVE_IDENTITY: "Identidade inativa",
  UNKNOWN_PERMISSION: "Permissão desconhecida",
  UNAVAILABLE_RESOURCE: "Recurso indisponível",
  ALLOW: "Permite",
  DENY: "Nega",
  COMPLETED: "Concluído",
  PDP_DECIDE: "Decidir acesso",
  CATALOG_SYNC: "Sincronizar catálogo",
};
export const labelOf = (value) => labels[value] || value || "—";
export function dateOf(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
export const nameOf = (item) =>
  item?.details?.fullName ||
  item?.details?.legalName ||
  item?.details?.name ||
  item?.nickname ||
  "Sem nome";
const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
export function filterRows(rows, search, status, text) {
  const term = normalize(search).trim();
  return rows.filter((row) => {
    const rowStatus =
      row.status ??
      (row.active === undefined ? "" : row.active ? "ACTIVE" : "INACTIVE");
    const rowText = text
      ? text(row)
      : Object.values(row)
          .filter((v) => typeof v !== "object")
          .join(" ");
    return (
      (!status || String(rowStatus) === status) &&
      (!term || normalize(rowText).includes(term))
    );
  });
}
export function errorOf(error) {
  if (error?.status === 403)
    return "Seu acesso não permite esta consulta ou alteração neste contexto. Solicite a permissão ao administrador responsável.";
  if (error?.status === 409)
    return "Os dados mudaram ou a operação conflita com o estado atual. Atualize a consulta e revise os dados antes de tentar novamente.";
  if (error?.status === 404)
    return "Registro não encontrado ou indisponível neste contexto.";
  return error?.message || "Não foi possível concluir a operação.";
}
export function availableActions(status) {
  return status === "PENDING"
    ? ["activate"]
    : status === "ACTIVE"
      ? ["disable"]
      : status === "DISABLED"
        ? ["reactivate"]
        : [];
}
