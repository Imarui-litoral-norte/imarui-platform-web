"use client";
import { useCallback, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { PLATFORM_SCOPE } from "../api/iiamApi";
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
  Metrics,
  Modal,
  PageNav,
  QueryState,
  Reason,
  Section,
  Select,
} from "./ManagementUi";
import { IdentityPicker } from "./GrantManagement";
import s from "./iam.module.css";
import IdentityReference from "./IdentityReference";

export function ScopeManagement({ api, scope, onChange, onScopesChanged }) {
  const query = useRemote(
    useCallback(async () => {
      const [scopes, ancestors] = await Promise.all([
        api.scopes(scope),
        api.ancestors(scope),
      ]);
      return { scopes: rowsOf(scopes), ancestors: rowsOf(ancestors) };
    }, [api, scope]),
  );
  const [editor, setEditor] = useState(null),
    [remove, setRemove] = useState(null);
  const operation = useOperation();
  return (
    <Section
      title="Hierarquia de escopos"
      description="Escopos delimitam recursos e herança de políticas. Eles representam contextos administrativos; a gestão de empresas fica na área de Identidade."
      action={
        <div className={s.actions}>
          <Button onClick={query.reload}>
            <RefreshCw size={15} />
            Atualizar
          </Button>
          <Button primary onClick={() => setEditor("create")}>
            <Plus size={15} />
            Novo escopo
          </Button>
        </div>
      }
    >
      <Feedback {...operation} />
      <QueryState query={query}>
        {query.data ? (
          <>
            <div className={s.callout}>
              <strong>Caminho de administração</strong>
              <div className={s.actions}>
                {query.data.ancestors.map((ancestor) => (
                  <Button
                    key={ancestor.id}
                    onClick={() => onChange(ancestor.id)}
                  >
                    {ancestor.name}
                  </Button>
                ))}
              </div>
            </div>
            <DataTable
              label="Escopos descendentes"
              rows={query.data.scopes}
              statuses={["ACTIVE", "DISABLED"]}
              columns={[
                {
                  label: "Escopo",
                  sort: (r) => r.name,
                  render: (r) => (
                    <div>
                      <strong>{r.name}</strong>
                      <p className={s.muted}>{r.code}</p>
                      <CopyValue value={r.id} />
                    </div>
                  ),
                },
                {
                  label: "Escopo superior",
                  render: (r) => <CopyValue value={r.parentId} />,
                },
                {
                  label: "Situação",
                  render: (r) => <Badge value={r.status} />,
                },
                {
                  label: "Ações",
                  render: (r) => (
                    <div className={s.actions}>
                      <Button onClick={() => onChange(r.id)}>
                        Abrir contexto
                      </Button>
                      <Button onClick={() => setEditor(r)}>Editar</Button>
                      <Button
                        danger
                        disabled={r.id === PLATFORM_SCOPE}
                        onClick={() => setRemove(r)}
                      >
                        Excluir
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          </>
        ) : null}
      </QueryState>
      {editor ? (
        <ScopeEditor
          api={api}
          parentId={scope}
          scope={editor === "create" ? null : editor}
          options={query.data?.scopes || []}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            query.reload();
            onScopesChanged();
          }}
        />
      ) : null}
      {remove ? (
        <Confirm
          title="exclusão do escopo"
          description={`Excluir ${remove.name}? O serviço verifica dependências e bloqueia a exclusão quando houver vínculos incompatíveis.`}
          reasonRequired
          operation={operation}
          onClose={() => setRemove(null)}
          onConfirm={async (reason) => {
            if (await operation.run(() => api.deleteScope(remove, reason))) {
              setRemove(null);
              onScopesChanged();
              if (remove.id === scope)
                onChange(remove.parentId || PLATFORM_SCOPE);
              else query.reload();
            }
          }}
        />
      ) : null}
    </Section>
  );
}
function ScopeEditor({ api, parentId, scope, options, onClose, onSaved }) {
  const [reason, setReason] = useState(""),
    [parent, setParent] = useState(scope ? scope.parentId || "" : parentId);
  const operation = useOperation();
  return (
    <Modal
      title={scope ? "Editar escopo" : "Novo escopo"}
      description="A mudança de estado ou de escopo superior pode alterar a herança de acessos dos descendentes."
      onClose={onClose}
      busy={operation.busy}
    >
      <Feedback {...operation} />
      <form
        className={s.form}
        onSubmit={async (e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget);
          if (
            await operation.run(() =>
              scope
                ? api.saveScope(
                    scope,
                    String(values.get("name")),
                    String(values.get("status")),
                    parent,
                    reason,
                  )
                : api.createScope(
                    String(values.get("code")),
                    String(values.get("name")),
                    parent,
                    reason,
                  ),
            )
          )
            onSaved();
        }}
      >
        {!scope ? (
          <Field
            label="Código"
            name="code"
            required
            maxLength={80}
            pattern="[A-Za-z][A-Za-z0-9_]{0,79}"
            hint="Letras, números e underscore; começa com uma letra."
          />
        ) : null}
        <Field
          label="Nome do escopo"
          name="name"
          defaultValue={scope?.name || ""}
          required
          maxLength={150}
        />
        {scope ? (
          <Select label="Situação" name="status" defaultValue={scope.status}>
            {["ACTIVE", "DISABLED"]
              .filter(
                (status) => scope.id !== PLATFORM_SCOPE || status === "ACTIVE",
              )
              .map((status) => (
                <option key={status} value={status}>
                  {labelOf(status)}
                </option>
              ))}
          </Select>
        ) : null}
        {scope?.id !== PLATFORM_SCOPE ? (
          <>
            <Select
              label="Selecionar escopo superior"
              value={options.some((o) => o.id === parent) ? parent : ""}
              onChange={(e) => setParent(e.target.value)}
            >
              <option value="">Raiz independente / outro UUID</option>
              {options
                .filter((o) => o.id !== scope?.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} · {o.code}
                  </option>
                ))}
            </Select>
            <Field
              label="UUID do escopo superior"
              value={parent}
              onChange={(e) => setParent(e.target.value)}
              hint="Vazio cria uma raiz independente. O serviço valida ciclos e sua autoridade na hierarquia."
            />
          </>
        ) : null}
        <Reason value={reason} onChange={setReason} />
        <div className={s.dialogActions}>
          <Button disabled={operation.busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button primary type="submit" disabled={operation.busy}>
            Salvar escopo
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function DiagnosticsPanel({ api, scope, initialIdentityId }) {
  const [identityId, setIdentityId] = useState(initialIdentityId || ""),
    [consulted, setConsulted] = useState(""),
    [explain, setExplain] = useState(null);
  const query = useRemote(
    useCallback(
      () =>
        consulted ? api.effective(consulted, scope) : Promise.resolve(null),
      [api, consulted, scope],
    ),
  );
  const rows = rowsOf(query.data);
  return (
    <Section
      title="Por que esta identidade tem ou não tem acesso?"
      description="Consulte a decisão efetiva do serviço, incluindo estado da identidade, concessões, herança e negações."
    >
      <IdentityPicker
        api={api}
        value={identityId}
        onChange={(value) => {
          setIdentityId(value);
          setConsulted("");
        }}
      />
      <div className={s.actions}>
        <Button
          primary
          disabled={!identityId || query.loading}
          onClick={() => {
            setConsulted(identityId);
            if (identityId === consulted) query.reload();
          }}
        >
          Consultar acesso efetivo
        </Button>
      </div>
      {consulted ? (
        <QueryState query={query}>
          <Metrics
            items={[
              { label: "Permissões avaliadas", value: rows.length },
              {
                label: "Permitidas",
                value: rows.filter((p) => p.allowed).length,
              },
              {
                label: "Bloqueadas",
                value: rows.filter((p) => !p.allowed).length,
              },
            ]}
          />
          <DataTable
            label="Decisões efetivas"
            rows={rows}
            columns={[
              {
                label: "Permissão",
                sort: (p) => p.code,
                render: (p) => <code>{p.code}</code>,
              },
              {
                label: "Decisão",
                render: (p) => (
                  <Badge value={p.allowed ? "ALLOWED" : "DENY"}>
                    {p.allowed ? "Permitido" : "Bloqueado"}
                  </Badge>
                ),
              },
              { label: "Motivo", render: (p) => labelOf(p.reason) },
              {
                label: "Evidências",
                render: (p) => (
                  <Button onClick={() => setExplain(p.code)}>
                    Explicar decisão
                  </Button>
                ),
              },
            ]}
          />
        </QueryState>
      ) : (
        <p className={s.callout}>
          Selecione e confira a identidade. Depois, consulte o resultado real da
          política no escopo atual.
        </p>
      )}
      {explain ? (
        <Explanation
          api={api}
          scope={scope}
          identityId={consulted}
          permission={explain}
          onClose={() => setExplain(null)}
        />
      ) : null}
    </Section>
  );
}
function Explanation({ api, scope, identityId, permission, onClose }) {
  const query = useRemote(
    useCallback(
      () => api.explain(identityId, permission, scope),
      [api, scope, identityId, permission],
    ),
  );
  return (
    <Modal
      wide
      title="Explicação da decisão"
      description={permission}
      onClose={onClose}
    >
      <QueryState query={query}>
        {query.data ? (
          <>
            <Facts
              items={[
                [
                  "Resultado",
                  <Badge
                    key="decision"
                    value={query.data.decision.allowed ? "ALLOWED" : "DENY"}
                  >
                    {query.data.decision.allowed ? "Permitido" : "Bloqueado"}
                  </Badge>,
                ],
                ["Motivo", labelOf(query.data.decision.reason)],
                ["Identidade", <CopyValue key="identity" value={identityId} />],
                ["Escopo consultado", <CopyValue key="scope" value={scope} />],
              ]}
            />
            <DataTable
              label="Origens da decisão"
              searchable={false}
              rows={query.data.sources || []}
              columns={[
                { label: "Efeito", render: (r) => <Badge value={r.effect} /> },
                {
                  label: "Origem",
                  render: (r) => (
                    <div>
                      {r.inherited
                        ? "Herdada do ancestral"
                        : "Direta no escopo"}
                      <p>
                        <CopyValue value={r.originScopeId} />
                      </p>
                    </div>
                  ),
                },
                {
                  label: "Perfil",
                  render: (r) => (r.roleId ? `#${r.roleId}` : "—"),
                },
                {
                  label: "Evidência",
                  render: (r) => <CopyValue value={r.evidenceId} />,
                },
              ]}
              empty="Sem concessão ou negação para detalhar neste resultado."
            />
          </>
        ) : null}
      </QueryState>
    </Modal>
  );
}
export function AuditPanel({ api, scope }) {
  const [filters, setFilters] = useState({
      event: "",
      correlationId: "",
      page: 0,
    }),
    [selected, setSelected] = useState(null);
  const query = useRemote(
    useCallback(() => api.audit(scope, filters), [api, scope, filters]),
  );
  return (
    <Section
      title="Trilha de auditoria"
      description="Consulte ações, responsáveis, motivos e alterações de políticas dentro da sua jurisdição."
      action={
        <Button onClick={query.reload}>
          <RefreshCw size={15} />
          Atualizar
        </Button>
      }
    >
      <form
        className={s.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget);
          setFilters({
            event: String(values.get("event")).trim(),
            correlationId: String(values.get("correlationId")).trim(),
            page: 0,
          });
        }}
      >
        <Field name="event" label="Evento" placeholder="Ex.: ROLE_CREATED" />
        <Field
          name="correlationId"
          label="Identificador de correlação"
          placeholder="UUID (opcional)"
        />
        <Button type="submit">Aplicar filtros</Button>
        <Button
          type="reset"
          onClick={() => setFilters({ event: "", correlationId: "", page: 0 })}
        >
          Limpar
        </Button>
      </form>
      <QueryState query={query}>
        <DataTable
          label="Eventos de auditoria da página"
          searchable={false}
          paginate={false}
          rows={rowsOf(query.data)}
          columns={[
            { label: "Quando", render: (r) => dateOf(r.occurredAt) },
            { label: "Evento", render: (r) => <strong>{r.event}</strong> },
            {
              label: "Responsável",
              render: (r) => (
                <IdentityReference api={api} id={r.actorIdentityId} />
              ),
            },
            {
              label: "Recurso",
              render: (r) => (
                <div>
                  {r.resourceType}
                  <p className={s.muted}>{r.resourceId}</p>
                </div>
              ),
            },
            { label: "Motivo", render: (r) => r.reason },
            {
              label: "Detalhes",
              render: (r) => (
                <Button onClick={() => setSelected(r)}>Ver alteração</Button>
              ),
            },
          ]}
        />
        <PageNav
          page={filters.page}
          total={query.data?.total || 0}
          onChange={(page) => setFilters((old) => ({ ...old, page }))}
        />
      </QueryState>
      {selected ? (
        <Modal
          wide
          title={selected.event}
          description={dateOf(selected.occurredAt)}
          onClose={() => setSelected(null)}
        >
          <Facts
            items={[
              [
                "Responsável",
                <CopyValue key="actor" value={selected.actorIdentityId} />,
              ],
              ["Serviço", selected.service],
              ["Escopo", <CopyValue key="scope" value={selected.scopeId} />],
              [
                "Correlação",
                <CopyValue key="correlation" value={selected.correlationId} />,
              ],
              ["Motivo", selected.reason],
            ]}
          />
          <div className={s.formGrid}>
            <div>
              <h3>Antes da alteração</h3>
              <pre className={s.codeBlock}>
                {JSON.stringify(selected.before, null, 2) ||
                  "Sem estado anterior"}
              </pre>
            </div>
            <div>
              <h3>Depois da alteração</h3>
              <pre className={s.codeBlock}>
                {JSON.stringify(selected.after, null, 2) ||
                  "Sem estado posterior"}
              </pre>
            </div>
          </div>
        </Modal>
      ) : null}
    </Section>
  );
}
