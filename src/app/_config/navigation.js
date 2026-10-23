import { APP_ROUTES, getRouteSegment, matchesRoute } from "@/shared/config/routes";
import { DPO_PILLARS } from "@/features/dpo/lib/dpoConfig";
import { SPO_CONTEXTS } from "@/features/spo/lib/spoConfig";

const DPO_PILLAR_LABELS = Object.fromEntries(
  DPO_PILLARS.map((pillar) => [pillar.slug, pillar.label]),
);
const SPO_CONTEXT_LABELS = Object.fromEntries(
  SPO_CONTEXTS.map((context) => [context.slug, context.label]),
);

const BREADCRUMB_LABELS = {
  [APP_ROUTES.IAM]: "IAM",
  [APP_ROUTES.IAM_IDENTITY]: "Identidade",
  [APP_ROUTES.IAM_AUTHENTICATION]: "Autenticação",
  [APP_ROUTES.IAM_AUTHORIZATION]: "Autorização",
  [APP_ROUTES.DPO_DTO_MANAGER]: "Gerenciador de DTOs",
  [APP_ROUTES.DPO_DELIVERY_ROUTE_CME]: "Acompanhamento de rota CME",
  [APP_ROUTES.DPO_JOURNEY_MANAGER]: "Gerenciador de Jornada",
};

export const APP_SIDEBAR_ITEMS = [
  {
    id: "favorites",
    label: "Favoritos",
    description: "Atalhos definidos pelo proprio usuario.",
    type: "panel",
    icon: "star",
    panel: {
      eyebrow: "Favoritos",
      title: "Escolha futura",
      body:
        "Este espaco vai receber a selecao das telas favoritas do usuario. Por enquanto, nao existe nenhuma aba configurada.",
    },
  },
  {
    id: "dpo",
    label: "DPO",
    description: "Auditoria, casa de pilares e questionarios.",
    type: "link",
    href: APP_ROUTES.DPO,
    activePath: APP_ROUTES.DPO,
    icon: "house",
  },
  {
    id: "spo",
    label: "SPO",
    description: "Contextos globais para organizacao de ferramentas.",
    type: "link",
    href: APP_ROUTES.SPO,
    activePath: APP_ROUTES.SPO,
    icon: "clipboard",
  },
  {
    id: "iam",
    label: "IAM",
    description: "Identidade, autenticação e autorização.",
    type: "panel",
    activePath: APP_ROUTES.IAM,
    icon: "service",
    panel: {
      eyebrow: "IAM",
      title: "Identidades e acessos",
      body: "Administre dados cadastrais, sessões e políticas de acesso.",
    },
    children: [
      { id: "iam-identity", label: "Identidade", description: "Diretório e dados cadastrais.", href: APP_ROUTES.IAM_IDENTITY },
      { id: "iam-authentication", label: "Autenticação", description: "Sessões e recuperação de acesso.", href: APP_ROUTES.IAM_AUTHENTICATION },
      { id: "iam-authorization", label: "Autorização", description: "Roles, permissões e vínculos.", href: APP_ROUTES.IAM_AUTHORIZATION },
    ],
  },
  {
    id: "server-manager",
    label: "Servidor",
    description: "Status do gateway e controle dos processos gerenciados.",
    type: "link",
    href: APP_ROUTES.SERVER_MANAGER,
    icon: "service",
  },
  {
    id: "critica-pedidos",
    label: "Critica Pedidos",
    description: "Analise operacional de pedidos, PDVs e mapa logistico.",
    type: "link",
    href: APP_ROUTES.CRITICA_PEDIDOS,
    icon: "clipboard",
  },
  {
    id: "sustainability-kpis",
    label: "KPI's Sustentabilidade",
    description: "Indicadores e leitura da frente sustentavel.",
    type: "panel",
    icon: "chart",
    panel: {
      eyebrow: "KPI's Sustentabilidade",
      title: "Modulo em definicao",
      body:
        "Este espaco vai concentrar os indicadores e a leitura operacional da frente de sustentabilidade.",
    },
  },
  {
    id: "meetings",
    label: "Reunioes",
    description: "Ritos, agendas e acompanhamento recorrente.",
    type: "panel",
    icon: "calendar",
    panel: {
      eyebrow: "Reunioes",
      title: "Modulo em definicao",
      body:
        "Aqui vao entrar os ritos, agendas e registros recorrentes acompanhados pela operacao.",
    },
  },
  {
    id: "action-plans",
    label: "Planos de Acao",
    description: "Registro e desdobramento das acoes operacionais.",
    type: "panel",
    icon: "clipboard",
    panel: {
      eyebrow: "Planos de Acao",
      title: "Modulo em definicao",
      body:
        "Este bloco vai receber os planos de acao e os desdobramentos que hoje ainda nao estao modelados.",
    },
  },
  {
    id: "services",
    label: "Servicos",
    description: "Acessos rapidos aos servicos internos.",
    type: "panel",
    icon: "service",
    showServices: true,
    panel: {
      eyebrow: "Servicos",
      title: "Acessos internos",
      body:
        "Os links abaixo vao centralizar o acesso rapido aos servicos internos da operacao.",
    },
  },
];

export const APP_SERVICE_ITEMS = [
  {
    id: "gerenciador-extracao",
    label: "Extrator",
    href: APP_ROUTES.EXTRATOR_MANAGER,
  },
  {
    id: "gerenciador-database",
    label: "Gerenciador Database",
    description: "Monitoring e backup relacionados ao banco de dados.",
    children: [
      {
        id: "gerenciador-database-monitoring",
        label: "Monitoring",
        href: "/gerenciador-database/monitoring/",
      },
      {
        id: "gerenciador-database-backup",
        label: "Backup",
        href: "/gerenciador-database/backup/",
      },
    ],
  },
  {
    id: "n8n-interno",
    label: "N8N interno",
    href: "/n8n/",
  },
  {
    id: "evolution-interno",
    label: "Evolution Interno",
    href: "/evolution/",
  },
];

const DEFAULT_MAIN_CLASS_NAME =
  "min-h-screen px-4 pb-6 pt-28 sm:px-6 sm:pb-8 sm:pt-32";
const DEFAULT_CONTENT_CLASS_NAME =
  "mx-auto max-w-7xl rounded-[30px] border border-[color:var(--shell-line)] bg-[var(--shell-surface-strong)] p-4 shadow-[0_18px_60px_rgba(20,32,43,0.08)] sm:p-6";
const DPO_MANAGER_MAIN_CLASS_NAME =
  "min-h-screen px-4 pb-6 pt-72 min-[440px]:pt-52 sm:px-6 sm:pb-8 lg:pt-32";
const CRITICA_MAIN_CLASS_NAME =
  "min-h-screen px-2 pb-4 pt-24 sm:px-4 sm:pb-6 sm:pt-28";

const DPO_MANAGER_ROUTES = [
  APP_ROUTES.DPO_DTO_MANAGER,
  APP_ROUTES.DPO_BLITZ_MANAGER,
  APP_ROUTES.DPO_SECURITY_TEMPLATES_MANAGER,
  APP_ROUTES.DPO_DELIVERY_ROUTE_CME,
  APP_ROUTES.DPO_JOURNEY_MANAGER,
];

function formatBreadcrumbLabel(segment) {
  return String(segment ?? "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildAppBreadcrumbs(pathname) {
  const segments = String(pathname || "/")
    .split("/")
    .filter(Boolean);
  const items = [{ href: APP_ROUTES.HOME, label: "Home" }];

  if (segments.length === 0 || segments[0] === getRouteSegment(APP_ROUTES.HOME)) {
    return items;
  }

  let currentPath = "";

  for (const segment of segments) {
    currentPath += `/${segment}`;

    if (segment === getRouteSegment(APP_ROUTES.DPO)) {
      items.push({ href: currentPath, label: "DPO" });
      continue;
    }

    if (segment === getRouteSegment(APP_ROUTES.SPO)) {
      items.push({ href: currentPath, label: "SPO" });
      continue;
    }

    if (segments[0] === getRouteSegment(APP_ROUTES.DPO)) {
      items.push({
        href: currentPath,
        label:
          BREADCRUMB_LABELS[currentPath] ||
          DPO_PILLAR_LABELS[segment] ||
          formatBreadcrumbLabel(segment),
      });
      continue;
    }

    if (segments[0] === getRouteSegment(APP_ROUTES.SPO)) {
      items.push({
        href: currentPath,
        label: BREADCRUMB_LABELS[currentPath] || SPO_CONTEXT_LABELS[segment] || formatBreadcrumbLabel(segment),
      });
      continue;
    }

    items.push({ href: currentPath, label: BREADCRUMB_LABELS[currentPath] || formatBreadcrumbLabel(segment) });
  }

  return items;
}

export function resolveAppShellLayout(pathname) {
  if (matchesRoute(pathname, APP_ROUTES.CRITICA_PEDIDOS)) {
    return {
      contentClassName: "mx-auto max-w-none",
      mainClassName: CRITICA_MAIN_CLASS_NAME,
    };
  }

  if (matchesRoute(pathname, APP_ROUTES.IAM) ||
      DPO_MANAGER_ROUTES.some((route) => matchesRoute(pathname, route))) {
    return {
      contentClassName: DEFAULT_CONTENT_CLASS_NAME,
      mainClassName: DPO_MANAGER_MAIN_CLASS_NAME,
    };
  }

  return {
    contentClassName: DEFAULT_CONTENT_CLASS_NAME,
    mainClassName: DEFAULT_MAIN_CLASS_NAME,
  };
}
