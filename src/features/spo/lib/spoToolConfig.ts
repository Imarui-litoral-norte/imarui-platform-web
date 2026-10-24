export type SpoToolDefinition = {
  id: string;
  contextSlug: string;
  href: string;
  label: string;
  description: string;
};

export const SPO_TOOL_DEFINITIONS: readonly SpoToolDefinition[] = [
  {
    id: "gestao-boletos",
    contextSlug: "financeiro",
    href: "/spo/financeiro/gestao-boletos",
    label: "Gestão de boletos",
    description: "Acompanhe a carteira, os vencimentos e as prioridades de cobrança.",
  },
];

export function getSpoToolsForContext(contextSlug: string): SpoToolDefinition[] {
  return SPO_TOOL_DEFINITIONS.filter(
    (tool) => tool.contextSlug === contextSlug,
  );
}
