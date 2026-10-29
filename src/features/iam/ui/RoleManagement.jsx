"use client";
import { useCallback, useState } from "react";
import { CheckCheck, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { labelOf, rowsOf } from "../model/management";
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
  Metrics,
  Modal,
  QueryState,
  Reason,
  Section,
  Select,
  Subnav,
} from "./ManagementUi";
import s from "./iam.module.css";

export function PermissionPicker({
  permissions,
  value,
  onChange,
  disabled = false,
}) {
  const [search, setSearch] = useState("");
  const missing = value.filter(
    (code) => !permissions.some((p) => p.code === code),
  );
  const filtered = permissions.filter((p) =>
    [p.code, p.description, p.module, p.owner]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className={s.stack}>
      <Field
        label="Buscar permissões"
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Descrição, código, módulo ou serviço"
      />
      <div className={s.row}>
        <span className={s.muted}>
          {value.length} selecionada(s) · {filtered.length} visível(is)
        </span>
        <div className={s.actions}>
          <Button
            disabled={disabled}
            onClick={() =>
              onChange([
                ...new Set([
                  ...value,
                  ...filtered.filter((p) => !p.deprecated).map((p) => p.code),
                ]),
              ])
            }
          >
            <CheckCheck size={14} />
            Selecionar visíveis
          </Button>
          <Button
            disabled={disabled}
            onClick={() =>
              onChange(
                value.filter((code) => !filtered.some((p) => p.code === code)),
              )
            }
          >
            Desmarcar visíveis
          </Button>
        </div>
      </div>
      <div className={s.permissionList}>
        {[
          ...missing.map((code) => ({
            code,
            description:
              "Permissão já vinculada, ausente no catálogo consultado",
          })),
          ...filtered,
        ].map((p) => (
          <label className={s.permission} key={p.code}>
            <input
              type="checkbox"
              disabled={disabled || (p.deprecated && !value.includes(p.code))}
              checked={value.includes(p.code)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, p.code]
                    : value.filter((code) => code !== p.code),
                )
              }
            />
            <span>
              {p.description || p.code}
              <code>{p.code}</code>
              <small>
                {[p.module, p.owner, p.deprecated ? "Descontinuada" : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
          </label>
        ))}
        {!filtered.length && !missing.length ? (
          <p className={s.muted}>Nenhuma permissão corresponde à busca.</p>
        ) : null}
      </div>
    </div>
  );
}
export default function RoleManagement({ api, scope }) {
  const [view, setView] = useState("owned"),
    [editor, setEditor] = useState(null),
    [action, setAction] = useState(null);
  const query = useRemote(
    useCallback(
      () => (view === "owned" ? api.roles(scope) : api.availableRoles(scope)),
      [api, scope, view],
    ),
  );
  const operation = useOperation(),
    rows = rowsOf(query.data);
  return (
    <>
      <Metrics
        items={[
          {
            label:
              view === "owned" ? "Perfis do contexto" : "Perfis disponíveis",
            value: query.data ? rows.length : undefined,
            icon: ShieldCheck,
            hint: "Conforme a consulta selecionada",
          },
          {
            label: "Ativos",
            value: query.data
              ? rows.filter((r) => r.status === "ACTIVE").length
              : undefined,
            hint: "Ativos nesta consulta",
          },
          {
            label: "Gerenciáveis",
            value: query.data
              ? rows.filter((r) => r.manageable).length
              : undefined,
            hint: "Seu acesso permite editar",
          },
        ]}
      />
      <Section
        title="Perfis de acesso"
        description="Componha permissões em perfis e atribua-os às identidades. A propriedade de um perfil não concede acesso por si só."
        action={
          <div className={s.actions}>
            <Button onClick={query.reload}>
              <RefreshCw size={15} />
              Atualizar
            </Button>
            <Button primary onClick={() => setEditor("create")}>
              <Plus size={15} />
              Novo perfil
            </Button>
          </div>
        }
      >
        <Subnav
          value={view}
          onChange={setView}
          items={[
            { id: "owned", label: "Pertencem ao contexto" },
            { id: "available", label: "Disponíveis para atribuição" },
          ]}
        />
        <Feedback {...operation} />
        <QueryState query={query}>
          <DataTable
            label="Perfis de acesso"
            rows={rows}
            statuses={["ACTIVE", "INACTIVE", "ARCHIVED"]}
            columns={[
              {
                label: "Perfil",
                sort: (r) => r.name,
                render: (r) => (
                  <div>
                    <strong>{r.name}</strong>
                    <p className={s.muted}>
                      #{r.id}
                      {!r.manageable ? " · Somente consulta" : ""}
                    </p>
                  </div>
                ),
              },
              {
                label: "Propriedade",
                render: (r) => <Badge value={r.ownership} />,
              },
              {
                label: "Disponibilidade",
                render: (r) =>
                  r.available
                    ? "Pode ser atribuído"
                    : "Indisponível para atribuição",
              },
              { label: "Situação", render: (r) => <Badge value={r.status} /> },
              {
                label: "Ações",
                render: (r) => (
                  <div className={s.actions}>
                    <Button onClick={() => setEditor(r)}>
                      {r.manageable
                        ? "Editar e ver permissões"
                        : "Ver detalhes"}
                    </Button>
                    <Button
                      disabled={
                        !r.manageable ||
                        r.status === "ARCHIVED" ||
                        operation.busy
                      }
                      onClick={() =>
                        setAction({
                          role: r,
                          type: "lifecycle",
                          status: r.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                        })
                      }
                    >
                      {r.status === "ACTIVE" ? "Inativar" : "Ativar"}
                    </Button>
                    <Button
                      danger
                      disabled={!r.manageable || operation.busy}
                      onClick={() => setAction({ role: r, type: "delete" })}
                    >
                      Excluir
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </QueryState>
      </Section>
      {editor ? (
        <RoleEditor
          api={api}
          scope={scope}
          roleId={editor === "create" ? null : editor.id}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            query.reload();
          }}
        />
      ) : null}
      {action ? (
        <Confirm
          title={
            action.type === "delete"
              ? "exclusão do perfil"
              : `${action.status === "ACTIVE" ? "ativação" : "inativação"} do perfil`
          }
          description={`${action.role.name}: ${action.type === "delete" ? "a exclusão depende das regras de integridade do serviço." : action.status === "INACTIVE" ? "as permissões deste perfil deixarão de conceder acesso nas suas atribuições." : "as atribuições existentes podem voltar a conceder acesso."}`}
          operation={operation}
          onClose={() => setAction(null)}
          reasonRequired
          danger={action.type === "delete" || action.status === "INACTIVE"}
          onConfirm={async (reason) => {
            if (
              await operation.run(() =>
                action.type === "delete"
                  ? api.deleteRole(action.role, reason)
                  : api.roleLifecycle(action.role, action.status, reason),
              )
            ) {
              setAction(null);
              query.reload();
            }
          }}
        />
      ) : null}
    </>
  );
}
function RoleEditor({ api, scope, roleId, onClose, onSaved }) {
  const operation = useOperation();
  const query = useRemote(
    useCallback(async () => {
      const [permissions, role, composition] = await Promise.all([
        api.permissions(scope),
        roleId ? api.role(roleId) : Promise.resolve(null),
        roleId ? api.rolePermissions(roleId) : Promise.resolve([]),
      ]);
      return { permissions: rowsOf(permissions), role, composition };
    }, [api, scope, roleId]),
  );
  return (
    <Modal
      wide
      title={roleId ? "Perfil e permissões" : "Criar perfil de acesso"}
      description="Revise o alcance e a composição antes de salvar. As alterações exigem uma justificativa."
      onClose={onClose}
      busy={operation.busy}
    >
      <QueryState query={query}>
        {query.data ? (
          <RoleForm
            key={query.data.role?.version ?? "new"}
            api={api}
            scope={scope}
            {...query.data}
            operation={operation}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : null}
      </QueryState>
    </Modal>
  );
}
function RoleForm({
  api,
  scope,
  role,
  permissions,
  composition,
  operation,
  onClose,
  onSaved,
}) {
  const [selected, setSelected] = useState(composition),
    [ownership, setOwnership] = useState(role?.ownership || "SCOPE"),
    [reason, setReason] = useState("");
  const editable = !role || role.manageable;
  return (
    <form
      className={s.form}
      onSubmit={async (e) => {
        e.preventDefault();
        const values = new FormData(e.currentTarget);
        if (
          await operation.run(
            () =>
              role
                ? api.saveRole(
                    role,
                    String(values.get("name")),
                    String(values.get("status")),
                    selected,
                    reason,
                  )
                : api.createRole(
                    String(values.get("name")),
                    ownership,
                    scope,
                    String(values.get("tenantId") || ""),
                    selected,
                    reason,
                  ),
            "Perfil e permissões salvos.",
          )
        )
          onSaved();
      }}
    >
      <Feedback {...operation} />
      {role ? (
        <Facts
          items={[
            ["Identificador", `#${role.id}`],
            ["Propriedade", labelOf(role.ownership)],
            [
              "Escopo proprietário",
              <CopyValue key="scope" value={role.ownerScopeId} />,
            ],
            [
              "Empresa proprietária",
              <CopyValue key="tenant" value={role.ownerTenantId} />,
            ],
          ]}
        />
      ) : null}
      <div className={s.formGrid}>
        <Field
          label="Nome do perfil"
          name="name"
          defaultValue={role?.name || ""}
          maxLength={100}
          required
          disabled={!editable || operation.busy}
        />
        {role ? (
          <Select
            label="Situação"
            name="status"
            defaultValue={role.status}
            disabled={!editable || operation.busy}
          >
            {["ACTIVE", "INACTIVE", "ARCHIVED"].map((status) => (
              <option key={status} value={status}>
                {labelOf(status)}
              </option>
            ))}
          </Select>
        ) : (
          <Select
            label="Propriedade"
            value={ownership}
            onChange={(e) => setOwnership(e.target.value)}
          >
            {["SCOPE", "GLOBAL", "TENANT"].map((type) => (
              <option key={type} value={type}>
                {labelOf(type)}
              </option>
            ))}
          </Select>
        )}
      </div>
      {!role && ownership === "TENANT" ? (
        <Field
          label="UUID da empresa proprietária"
          name="tenantId"
          required
          hint="O serviço resolve o escopo vinculado à empresa."
        />
      ) : null}
      <h3>Composição do perfil</h3>
      <PermissionPicker
        permissions={permissions}
        value={selected}
        onChange={setSelected}
        disabled={!editable || operation.busy}
      />
      {editable ? (
        <>
          <p className={s.callout}>
            Salvar a composição altera os acessos de todas as identidades com
            este perfil. A versão consultada é enviada para impedir que uma
            edição sobrescreva outra.
          </p>
          <Reason value={reason} onChange={setReason} />
        </>
      ) : (
        <p className={s.callout}>
          Seu acesso permite consultar este perfil. A edição depende da
          permissão na jurisdição proprietária. O perfil ROOT é protegido.
        </p>
      )}
      <div className={s.dialogActions}>
        <Button disabled={operation.busy} onClick={onClose}>
          {editable ? "Cancelar" : "Fechar"}
        </Button>
        {editable ? (
          <Button primary type="submit" disabled={operation.busy}>
            Salvar perfil e permissões
          </Button>
        ) : null}
      </div>
    </form>
  );
}
