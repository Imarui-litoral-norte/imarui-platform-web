"use client";
import { useCallback, useState } from "react";
import {
  Activity,
  BookOpen,
  GitBranch,
  History,
  ListChecks,
  Lock,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PLATFORM_SCOPE, uuid } from "../api/iiamApi";
import { errorOf, rowsOf } from "../model/management";
import { useRemote } from "./useManagement";
import {
  Badge,
  Button,
  CopyValue,
  Feedback,
  Field,
  QueryState,
  Section,
  Select,
  Subnav,
} from "./ManagementUi";
import RoleManagement from "./RoleManagement";
import GrantManagement from "./GrantManagement";
import {
  AuditPanel,
  DiagnosticsPanel,
  ScopeManagement,
} from "./PolicyInspection";
import GovernanceManagement from "./GovernanceManagement";
import s from "./iam.module.css";

const panels = [
  { id: "roles", label: "Perfis", icon: ShieldCheck },
  { id: "assignments", label: "Atribuições", icon: Users },
  { id: "denies", label: "Negações", icon: Lock },
  { id: "delegations", label: "Delegações", icon: ListChecks },
  { id: "scopes", label: "Escopos", icon: GitBranch },
  { id: "diagnostics", label: "Diagnóstico", icon: Activity },
  { id: "audit", label: "Auditoria", icon: History },
  { id: "governance", label: "Catálogo e governança", icon: BookOpen },
];
export default function AuthorizationWorkspace({
  api,
  profile,
  initialSection,
  initialIdentityId,
  initialScope,
}) {
  const [section, setSection] = useState(
    panels.some((p) => p.id === initialSection) ? initialSection : "roles",
  );
  const [scope, setScope] = useState(initialScope || PLATFORM_SCOPE),
    [draft, setDraft] = useState(initialScope || PLATFORM_SCOPE),
    [error, setError] = useState("");
  const scopes = useRemote(
    useCallback(() => api.scopes(PLATFORM_SCOPE), [api]),
  );
  const context = useRemote(useCallback(() => api.scope(scope), [api, scope]));
  function choose(value) {
    try {
      const next = uuid(value);
      setScope(next);
      setDraft(next);
      setError("");
    } catch (e) {
      setError(errorOf(e));
    }
  }
  const scopeRows = rowsOf(scopes.data);
  return (
    <>
      <Section
        title="Contexto de gestão"
        description="Os perfis, vínculos e decisões abaixo pertencem ao escopo selecionado. Alterar o contexto encerra a edição anterior."
      >
        <div className={s.formGrid}>
          <Select
            label="Escopos visíveis na plataforma"
            value={scopeRows.some((r) => r.id === scope) ? scope : ""}
            onChange={(e) => {
              if (e.target.value) choose(e.target.value);
            }}
          >
            <option value="">
              {scopes.loading
                ? "Consultando escopos…"
                : "Selecione um contexto"}
            </option>
            {scopeRows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.code}
                {r.status !== "ACTIVE" ? " (desabilitado)" : ""}
              </option>
            ))}
          </Select>
          <form
            className={s.fieldRow}
            onSubmit={(e) => {
              e.preventDefault();
              choose(draft);
              if (draft === scope) context.reload();
            }}
          >
            <Field
              label="Consultar outro escopo por UUID"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              required
            />
            <Button type="submit">Aplicar contexto</Button>
          </form>
        </div>
        {scopes.error ? (
          <p className={s.muted}>
            A lista geral de escopos não está acessível. Consulte diretamente um
            contexto autorizado pelo UUID.
          </p>
        ) : null}
        <Feedback error={error} />
        <QueryState query={context}>
          {context.data ? (
            <div className={s.row}>
              <p>
                <strong>{context.data.name}</strong> · {context.data.code}{" "}
                <Badge value={context.data.status} />
              </p>
              <CopyValue value={scope} />
            </div>
          ) : null}
        </QueryState>
      </Section>
      <Subnav value={section} onChange={setSection} items={panels} />
      {!context.loading && !context.error && context.data ? (
        <div key={`${scope}:${section}`} className={s.stack}>
          {section === "roles" ? (
            <RoleManagement api={api} scope={scope} />
          ) : null}
          {["assignments", "denies", "delegations"].includes(section) ? (
            <GrantManagement
              api={api}
              scope={scope}
              kind={section}
              initialIdentityId={initialIdentityId}
            />
          ) : null}
          {section === "scopes" ? (
            <ScopeManagement
              api={api}
              scope={scope}
              onChange={choose}
              onScopesChanged={scopes.reload}
            />
          ) : null}
          {section === "diagnostics" ? (
            <DiagnosticsPanel
              api={api}
              scope={scope}
              initialIdentityId={initialIdentityId || profile?.identityId}
            />
          ) : null}
          {section === "audit" ? <AuditPanel api={api} scope={scope} /> : null}
          {section === "governance" ? (
            <GovernanceManagement api={api} scope={scope} profile={profile} />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
