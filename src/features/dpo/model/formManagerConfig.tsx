"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  blitzApi,
  dtoApi,
  securityTemplatesApi,
  type DtoApi,
} from "@/features/dpo/api/dtoApi";

export interface FormManagerConfig {
  api: DtoApi;
  managerTitle: string;
  pillarEyebrow: string;
  singular: string;
  plural: string;
  formLabel: string;
  appliedLabel: string;
  description: string;
  discoveryKey: string;
  routeKey: string;
  supportsHistoricalDate?: boolean;
}

export const DTO_MANAGER_CONFIG: FormManagerConfig = {
  api: dtoApi,
  managerTitle: "Gerenciador de DTOs",
  pillarEyebrow: "Gestão DPO",
  singular: "DTO",
  plural: "DTOs",
  formLabel: "Formulário DTO",
  appliedLabel: "DTOs aplicadas",
  description:
    "Análise gerencial das aplicações de Diagnóstico Operacional do Trabalho, com foco em aderência, recorrências e oportunidades de atuação sobre os resultados negativos.",
  discoveryKey: "DTO",
  routeKey: "dto",
};

export const BLITZ_MANAGER_CONFIG: FormManagerConfig = {
  api: blitzApi,
  managerTitle: "Gerenciador de Blitz",
  pillarEyebrow: "Segurança DPO",
  singular: "Blitz",
  plural: "Blitz",
  formLabel: "Formulário de Blitz",
  appliedLabel: "Blitz aplicadas",
  description:
    "Análise gerencial das aplicações de Blitz de Segurança, com foco em aderência, recorrências e oportunidades de atuação sobre os resultados negativos.",
  discoveryKey: "Blitz",
  routeKey: "blitz",
};

export const SECURITY_TEMPLATES_MANAGER_CONFIG: FormManagerConfig = {
  api: securityTemplatesApi,
  managerTitle: "Gerenciador de Gabaritos de Segurança",
  pillarEyebrow: "Segurança DPO",
  singular: "Gabarito de Segurança",
  plural: "Gabaritos de Segurança",
  formLabel: "Formulário de Gabarito de Segurança",
  appliedLabel: "Gabaritos aplicados",
  description:
    "Análise gerencial das aplicações dos Gabaritos de Segurança, com foco em aderência, recorrências e oportunidades de atuação sobre os resultados negativos.",
  discoveryKey: "Gabarito-segurança",
  routeKey: "gabaritos-seguranca",
  supportsHistoricalDate: true,
};

const FormManagerContext = createContext<FormManagerConfig>(DTO_MANAGER_CONFIG);

export function FormManagerProvider({
  children,
  config,
}: {
  children: ReactNode;
  config: FormManagerConfig;
}) {
  return (
    <FormManagerContext.Provider value={config}>
      {children}
    </FormManagerContext.Provider>
  );
}

export function useFormManagerConfig(): FormManagerConfig {
  return useContext(FormManagerContext);
}
