type AppRoutePath = `/${string}`;

export const APP_ROUTES = {
  ROOT: "/",
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  FORGOT_PASSWORD: "/forgot-password",
  PASSWORD_RECOVERY_RESET: "/forgot-password/reset",
  DPO: "/dpo",
  SPO: "/spo",
  SPO_FINANCEIRO: "/spo/financeiro",
  DPO_MANAGEMENT: "/dpo/gestao",
  DPO_DTO_MANAGER: "/dpo/gestao/gerenciador-dto",
  DPO_BLITZ_MANAGER: "/dpo/seguranca/gerenciador-blitz",
  DPO_SECURITY_TEMPLATES_MANAGER: "/dpo/seguranca/gerenciador-gabaritos-seguranca",
  DPO_DELIVERY_ROUTE_CME: "/dpo/entrega/acompanhamento-rota-cme",
  DPO_JOURNEY_MANAGER: "/dpo/entrega/gerenciador-jornada",
  CRITICA_PEDIDOS: "/critica-pedidos",
  AUTHORIZATION_ROLES: "/authorization/role-management",
  IAM: "/iam",
  IAM_IDENTITY: "/iam/identidade",
  IAM_AUTHENTICATION: "/iam/autenticacao",
  IAM_AUTHORIZATION: "/iam/autorizacao",
  EXTRATOR_MANAGER: "/extrator",
  EXTRATOR_GLOBAL_QUEUE: "/extrator/fila",
  SERVER_MANAGER: "/servidor",
} as const satisfies Record<string, AppRoutePath>;

export type AppRoute =
  (typeof APP_ROUTES)[keyof typeof APP_ROUTES];

export function getRouteSegment(route: string): string {
  return (
    route
      .replace(/^\/+/, "")
      .split("/")[0] || ""
  );
}

export function matchesRoute(
  pathname: string | null | undefined,
  route: AppRoutePath,
): boolean {
  const normalizedPathname = pathname ?? "";

  return (
    normalizedPathname === route ||
    normalizedPathname.startsWith(`${route}/`)
  );
}
