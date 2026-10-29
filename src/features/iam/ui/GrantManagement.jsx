"use client";
import { useCallback, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { dateOf, labelOf, rowsOf } from "../model/management";
import { useOperation, useRemote } from "./useManagement";
import {
  Badge,
  Button,
  Confirm,
  CopyValue,
  DataTable,
  Facts,
  Feedback,
  Field,
  Modal,
  Person,
  QueryState,
  Reason,
  Section,
  Select,
} from "./ManagementUi";
import s from "./iam.module.css";
import IdentityReference from "./IdentityReference";

export function IdentityPicker({ api, value, onChange, required = true }) {
  const [draft, setDraft] = useState(value || "");
  const query = useRemote(
    useCallback(
      () => (value ? api.identity(value) : Promise.resolve(null)),
      [api, value],
    ),
  );
  return (
    <div className={s.stack}>
      <div className={s.fieldRow}>
        <Field
          label="Identidade destinatária"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (value) onChange("");
          }}
          required={required}
          placeholder="UUID da identidade"
        />
        <Button
          onClick={() => {
            onChange(draft.trim());
            if (draft.trim() === value) query.reload();
          }}
        >
          Conferir identidade
        </Button>
      </div>
      {value ? (
        <QueryState query={query}>
          {query.data ? (
            <div className={s.dossierHeader}>
              <Person
                name={
                  query.data.details?.fullName ||
                  query.data.details?.legalName ||
                  query.data.nickname
                }
                email={query.data.primaryEmail}
              />
              <Badge value={query.data.status} />
            </div>
          ) : null}
        </QueryState>
      ) : (
        <p className={s.muted}>
          Confira o cadastro para ver o nome e a situação antes de continuar.
        </p>
      )}
    </div>
  );
}
const config = {
  assignments: {
    title: "Atribuições de perfis",
    description:
      "Vincule uma identidade a um perfil disponível neste escopo. Considere também as concessões herdadas.",
    create: "Atribuir perfil",
  },
  denies: {
    title: "Negações explícitas",
    description:
      "Uma negação prevalece sobre permissões concedidas por perfis, inclusive quando herdada pelos descendentes.",
    create: "Criar negação",
  },
  delegations: {
    title: "Delegações de autoridade",
    description:
      "Autorize a gestão de uma permissão. Delegar autoridade não concede, por si só, acesso operacional à permissão.",
    create: "Delegar autoridade",
  },
};
export default function GrantManagement({
  api,
  scope,
  kind,
  initialIdentityId,
}) {
  const [inherited, setInherited] = useState(false),
    [filter, setFilter] = useState(initialIdentityId || ""),
    [filterDraft, setFilterDraft] = useState(initialIdentityId || ""),
    [editor, setEditor] = useState(false),
    [revoke, setRevoke] = useState(null);
  const query = useRemote(
    useCallback(
      () =>
        kind === "assignments"
          ? api.assignments(scope, filter || undefined, inherited)
          : kind === "denies"
            ? api.denies(scope)
            : api.delegations(scope),
      [api, scope, kind, filter, inherited],
    ),
  );
  const roles = useRemote(
    useCallback(() => api.availableRoles(scope), [api, scope]),
  );
  const operation = useOperation(),
    current = config[kind],
    roleRows = rowsOf(roles.data);
  const rows = rowsOf(query.data);
  return (
    <Section
      title={current.title}
      description={current.description}
      action={
        <div className={s.actions}>
          <Button onClick={query.reload}>
            <RefreshCw size={15} />
            Atualizar
          </Button>
          <Button primary onClick={() => setEditor(true)}>
            <Plus size={15} />
            {current.create}
          </Button>
        </div>
      }
    >
      <Feedback {...operation} />
      {kind === "assignments" ? (
        <form
          className={s.toolbar}
          onSubmit={(e) => {
            e.preventDefault();
            setFilter(filterDraft.trim());
          }}
        >
          <Field
            label="Filtrar identidade no servidor"
            value={filterDraft}
            onChange={(e) => setFilterDraft(e.target.value)}
            placeholder="UUID (opcional)"
          />
          <Button type="submit">Aplicar filtro</Button>
          {filter ? (
            <Button
              onClick={() => {
                setFilter("");
                setFilterDraft("");
              }}
            >
              Todas as identidades
            </Button>
          ) : null}
          <label className={s.checkRow}>
            <input
              type="checkbox"
              checked={inherited}
              onChange={(e) => setInherited(e.target.checked)}
            />
            Incluir atribuições herdadas
          </label>
        </form>
      ) : null}
      <QueryState query={query}>
        <DataTable
          label={current.title}
          rows={rows}
          statuses={["ACTIVE", "INACTIVE"]}
          searchText={(r) =>
            [
              r.identityId,
              r.roleId,
              roleRows.find((role) => role.id === r.roleId)?.name,
              r.permission,
              r.scopeId,
              r.reason,
            ].join(" ")
          }
          columns={[
            {
              label: "Destinatário",
              render: (r) =>
                r.identityId ? (
                  <IdentityReference api={api} id={r.identityId} />
                ) : (
                  <span>
                    Perfil:{" "}
                    {roleRows.find((role) => role.id === r.roleId)?.name ||
                      `#${r.roleId}`}
                  </span>
                ),
            },
            {
              label: kind === "assignments" ? "Perfil" : "Permissão",
              render: (r) =>
                kind === "assignments" ? (
                  roleRows.find((role) => role.id === r.roleId)?.name ||
                  `Perfil #${r.roleId}`
                ) : (
                  <code>{r.permission}</code>
                ),
            },
            {
              label: "Origem / alcance",
              render: (r) => (
                <div>
                  <CopyValue value={r.scopeId} />
                  {r.scopeId !== scope ? (
                    <Badge value="INACTIVE">Herdada</Badge>
                  ) : null}
                  {kind === "delegations" ? (
                    <p className={s.muted}>
                      {r.redelegable ? "Pode redelegar" : "Sem redelegação"}
                    </p>
                  ) : null}
                </div>
              ),
            },
            {
              label: "Criada em",
              sort: (r) => r.createdAt,
              render: (r) => dateOf(r.createdAt),
            },
            {
              label: "Situação",
              render: (r) => (
                <Badge value={r.active ? "ACTIVE" : "INACTIVE"}>
                  {r.active ? "Ativa" : "Revogada"}
                </Badge>
              ),
            },
            ...(kind !== "assignments"
              ? [{ label: "Motivo", render: (r) => r.reason || "—" }]
              : []),
            {
              label: "Ações",
              render: (r) => (
                <Button
                  danger
                  disabled={!r.active || operation.busy}
                  onClick={() => setRevoke(r)}
                >
                  Revogar
                </Button>
              ),
            },
          ]}
        />
      </QueryState>
      {roles.error ? (
        <p className={s.muted}>
          Os nomes dos perfis não puderam ser consultados. Os identificadores
          originais foram preservados.
        </p>
      ) : null}
      {editor ? (
        <GrantEditor
          api={api}
          scope={scope}
          kind={kind}
          initialIdentityId={initialIdentityId}
          onClose={() => setEditor(false)}
          onSaved={() => {
            setEditor(false);
            query.reload();
          }}
        />
      ) : null}
      {revoke ? (
        <Confirm
          title="revogação"
          description={`${kind === "denies" ? "Remover esta negação pode liberar um acesso concedido por outros perfis." : kind === "delegations" ? "O destinatário perde esta autoridade de gestão." : "A identidade perde esta atribuição. Outros perfis ainda podem conceder acesso."}${revoke.scopeId !== scope ? " A origem é um escopo ancestral; a revogação afeta também os demais descendentes." : ""}`}
          operation={operation}
          onClose={() => setRevoke(null)}
          reasonRequired
          onConfirm={async (reason) => {
            if (
              await operation.run(() =>
                kind === "assignments"
                  ? api.revokeAssignment(revoke, reason)
                  : kind === "denies"
                    ? api.revokeDeny(revoke, reason)
                    : api.revokeDelegation(revoke, reason),
              )
            ) {
              setRevoke(null);
              query.reload();
            }
          }}
        >
          <Facts
            items={[
              ["Origem", <CopyValue key="scope" value={revoke.scopeId} />],
              ["Destinatário", revoke.identityId || `Perfil #${revoke.roleId}`],
              [
                "Permissão / perfil",
                revoke.permission || `Perfil #${revoke.roleId}`,
              ],
            ]}
          />
        </Confirm>
      ) : null}
    </Section>
  );
}
function GrantEditor({
  api,
  scope,
  kind,
  initialIdentityId,
  onClose,
  onSaved,
}) {
  const operation = useOperation();
  const [identityId, setIdentityId] = useState(initialIdentityId || ""),
    [reason, setReason] = useState(""),
    [targetType, setTargetType] = useState("identity");
  const query = useRemote(
    useCallback(async () => {
      const [roles, permissions] = await Promise.all([
        api.availableRoles(scope),
        kind !== "assignments" ? api.permissions(scope) : Promise.resolve([]),
      ]);
      return { roles: rowsOf(roles), permissions: rowsOf(permissions) };
    }, [api, scope, kind]),
  );
  return (
    <Modal
      title={config[kind].create}
      description={config[kind].description}
      onClose={onClose}
      busy={operation.busy}
    >
      <Feedback {...operation} />
      <QueryState query={query}>
        {query.data ? (
          <form
            className={s.form}
            onSubmit={async (e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              const ok = await operation.run(async () => {
                if (targetType === "identity" && !identityId)
                  throw new Error(
                    "Confira a identidade destinatária antes de continuar.",
                  );
                if (kind === "assignments")
                  await api.assign(
                    identityId,
                    values.get("role"),
                    scope,
                    reason,
                  );
                else if (kind === "denies") {
                  if (targetType === "identity")
                    await api.deny(
                      identityId,
                      String(values.get("permission")),
                      scope,
                      reason,
                    );
                  else
                    await api.denyRole(
                      values.get("role"),
                      String(values.get("permission")),
                      scope,
                      reason,
                    );
                } else
                  await api.delegate(
                    identityId,
                    String(values.get("permission")),
                    scope,
                    values.get("redelegable") === "on",
                    reason,
                  );
              });
              if (ok) onSaved();
            }}
          >
            <p className={s.callout}>
              Escopo desta alteração: <CopyValue value={scope} />
            </p>
            {kind === "denies" ? (
              <Select
                label="Aplicar negação a"
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
              >
                <option value="identity">Uma identidade</option>
                <option value="role">Um perfil de acesso</option>
              </Select>
            ) : null}
            {targetType === "identity" ? (
              <IdentityPicker
                api={api}
                value={identityId}
                onChange={setIdentityId}
              />
            ) : null}
            {kind === "assignments" || targetType === "role" ? (
              <Select label="Perfil disponível" name="role" required>
                <option value="">Selecione um perfil</option>
                {query.data.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · {labelOf(r.ownership)}
                  </option>
                ))}
              </Select>
            ) : null}
            {kind !== "assignments" ? (
              <Select label="Permissão" name="permission" required>
                <option value="">Selecione uma permissão</option>
                {query.data.permissions
                  .filter((p) => !p.deprecated)
                  .map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.description || p.code} · {p.code}
                    </option>
                  ))}
              </Select>
            ) : null}
            {kind === "delegations" ? (
              <label className={s.checkRow}>
                <input type="checkbox" name="redelegable" />
                Permitir que o destinatário redelegue esta autoridade
              </label>
            ) : null}
            <Reason value={reason} onChange={setReason} />
            <div className={s.dialogActions}>
              <Button onClick={onClose} disabled={operation.busy}>
                Cancelar
              </Button>
              <Button type="submit" primary disabled={operation.busy}>
                {config[kind].create}
              </Button>
            </div>
          </form>
        ) : null}
      </QueryState>
    </Modal>
  );
}
