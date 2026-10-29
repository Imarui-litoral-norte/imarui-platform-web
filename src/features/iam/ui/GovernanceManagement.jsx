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
  PageNav,
  QueryState,
  Reason,
  Section,
  Select,
  Subnav,
} from "./ManagementUi";
import { IdentityPicker } from "./GrantManagement";
import s from "./iam.module.css";

export default function GovernanceManagement({ api, scope, profile }) {
  const [section, setSection] = useState("permissions");
  return (
    <>
      <Subnav
        value={section}
        onChange={setSection}
        items={[
          { id: "permissions", label: "Catálogo de permissões" },
          { id: "owners", label: "Serviços e versões" },
          { id: "clients", label: "Integrações técnicas" },
          { id: "root", label: "Transferência ROOT" },
        ]}
      />
      {section === "permissions" ? (
        <PermissionCatalog api={api} scope={scope} />
      ) : null}
      {section === "owners" ? <CatalogOwners api={api} /> : null}
      {section === "clients" ? (
        <TechnicalClients api={api} scope={scope} />
      ) : null}
      {section === "root" ? (
        <RootTransfer api={api} scope={scope} profile={profile} />
      ) : null}
    </>
  );
}
function PermissionCatalog({ api, scope }) {
  const query = useRemote(
    useCallback(() => api.permissions(scope), [api, scope]),
  );
  const [bootstrap, setBootstrap] = useState(false),
    [reason, setReason] = useState("");
  const operation = useOperation();
  return (
    <Section
      title="Catálogo de permissões"
      description="Consulte a finalidade, o módulo e o serviço responsável por cada permissão."
      action={
        <div className={s.actions}>
          <Button onClick={query.reload}>
            <RefreshCw size={15} />
            Atualizar
          </Button>
          <Button onClick={() => setBootstrap(true)}>
            Autoridade inicial de catálogo
          </Button>
        </div>
      }
    >
      <QueryState query={query}>
        <DataTable
          label="Catálogo de permissões"
          rows={rowsOf(query.data)}
          columns={[
            {
              label: "Permissão",
              sort: (p) => p.code,
              render: (p) => (
                <div>
                  <strong>{p.description || p.code}</strong>
                  <p className={s.muted}>{p.code}</p>
                </div>
              ),
            },
            { label: "Módulo", sort: (p) => p.module, render: (p) => p.module },
            {
              label: "Serviço proprietário",
              sort: (p) => p.owner,
              render: (p) => p.owner,
            },
            { label: "Namespace", render: (p) => p.namespace },
            {
              label: "Situação",
              render: (p) => (
                <Badge value={p.deprecated ? "INACTIVE" : "ACTIVE"}>
                  {p.deprecated ? "Descontinuada" : "Disponível"}
                </Badge>
              ),
            },
          ]}
        />
      </QueryState>
      {bootstrap ? (
        <Modal
          title="Autoridade inicial de catálogo"
          description="Operação de governança reservada. O serviço verifica a autoridade inicial e o escopo raiz informado."
          onClose={() => setBootstrap(false)}
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
                  api.initialAuthority(
                    String(values.get("permission")),
                    String(values.get("scope")),
                    reason,
                  ),
                )
              ) {
                setBootstrap(false);
                query.reload();
              }
            }}
          >
            <Select label="Permissão do catálogo" name="permission" required>
              <option value="">Selecione</option>
              {rowsOf(query.data)
                .filter((p) => !p.deprecated)
                .map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.code}
                  </option>
                ))}
            </Select>
            <Field
              label="Escopo raiz"
              name="scope"
              defaultValue={scope}
              required
            />
            <Reason value={reason} onChange={setReason} />
            <div className={s.dialogActions}>
              <Button onClick={() => setBootstrap(false)}>Cancelar</Button>
              <Button primary type="submit" disabled={operation.busy}>
                Conceder autoridade inicial
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </Section>
  );
}
function CatalogOwners({ api }) {
  const [page, setPage] = useState(0),
    [editor, setEditor] = useState(false),
    [service, setService] = useState(null),
    [reason, setReason] = useState("");
  const query = useRemote(useCallback(() => api.owners(page), [api, page]));
  const operation = useOperation();
  return (
    <Section
      title="Serviços proprietários do catálogo"
      description="Acompanhe quem publica as permissões, a versão atual e o histórico dos manifestos."
      action={
        <Button primary onClick={() => setEditor(true)}>
          <Plus size={15} />
          Cadastrar proprietário
        </Button>
      }
    >
      <QueryState query={query}>
        <DataTable
          label="Serviços proprietários"
          searchable={false}
          paginate={false}
          rows={rowsOf(query.data)}
          columns={[
            {
              label: "Serviço",
              render: (r) => <strong>{r.serviceCode}</strong>,
            },
            { label: "Namespace", render: (r) => r.namespace },
            { label: "Versão", render: (r) => r.version },
            { label: "Atualizado em", render: (r) => dateOf(r.updatedAt) },
            {
              label: "Histórico",
              render: (r) => (
                <Button onClick={() => setService(r.serviceCode)}>
                  Ver versões
                </Button>
              ),
            },
          ]}
        />
        <PageNav
          page={page}
          total={query.data?.total || 0}
          onChange={setPage}
        />
      </QueryState>
      {editor ? (
        <Modal
          title="Cadastrar proprietário de catálogo"
          onClose={() => setEditor(false)}
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
                  api.enrollOwner(
                    String(values.get("service")),
                    String(values.get("namespace")),
                    reason,
                  ),
                )
              ) {
                setEditor(false);
                query.reload();
              }
            }}
          >
            <Field
              label="Código do serviço"
              name="service"
              pattern="[a-z][a-z0-9-]{1,49}"
              minLength={2}
              maxLength={50}
              required
            />
            <Field
              label="Namespace de permissões"
              name="namespace"
              pattern="[a-z][a-z0-9-]{1,49}"
              minLength={2}
              maxLength={50}
              required
            />
            <Reason value={reason} onChange={setReason} />
            <div className={s.dialogActions}>
              <Button onClick={() => setEditor(false)}>Cancelar</Button>
              <Button primary type="submit" disabled={operation.busy}>
                Cadastrar proprietário
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
      {service ? (
        <CatalogRevisions
          api={api}
          service={service}
          onClose={() => setService(null)}
        />
      ) : null}
    </Section>
  );
}
function CatalogRevisions({ api, service, onClose }) {
  const [page, setPage] = useState(0),
    [version, setVersion] = useState(null);
  const query = useRemote(
    useCallback(() => api.revisions(service, page), [api, service, page]),
  );
  const manifest = useRemote(
    useCallback(
      () =>
        version !== null
          ? api.manifest(service, version)
          : Promise.resolve(null),
      [api, service, version],
    ),
  );
  return (
    <Modal wide title={`Versões de ${service}`} onClose={onClose}>
      <QueryState query={query}>
        <DataTable
          label="Versões do catálogo"
          paginate={false}
          searchable={false}
          rows={rowsOf(query.data)}
          columns={[
            { label: "Versão", render: (r) => r.version },
            { label: "Registrada em", render: (r) => dateOf(r.recordedAt) },
            { label: "Permissões", render: (r) => r.entries },
            {
              label: "Manifesto",
              render: (r) => (
                <Button onClick={() => setVersion(r.version)}>
                  Ver manifesto
                </Button>
              ),
            },
          ]}
        />
        <PageNav
          page={page}
          total={query.data?.total || 0}
          onChange={setPage}
        />
      </QueryState>
      {version !== null ? (
        <QueryState query={manifest}>
          <h3>Manifesto · versão {version}</h3>
          <pre className={s.codeBlock}>
            {JSON.stringify(manifest.data, null, 2)}
          </pre>
        </QueryState>
      ) : null}
    </Modal>
  );
}
function TechnicalClients({ api, scope }) {
  const [page, setPage] = useState(0),
    [editor, setEditor] = useState(null);
  const query = useRemote(useCallback(() => api.clients(page), [api, page]));
  return (
    <Section
      title="Integrações técnicas"
      description="Gerencie clientes de serviço, operações permitidas e chaves públicas. Estas integrações não são contas de pessoas."
      action={
        <div className={s.actions}>
          <Button onClick={query.reload}>Atualizar</Button>
          <Button primary onClick={() => setEditor("create")}>
            <Plus size={15} />
            Nova integração
          </Button>
        </div>
      }
    >
      <QueryState query={query}>
        <DataTable
          label="Clientes técnicos"
          paginate={false}
          searchable={false}
          rows={rowsOf(query.data)}
          columns={[
            {
              label: "Serviço",
              render: (r) => <strong>{r.serviceCode}</strong>,
            },
            {
              label: "Operações",
              render: (r) => r.operations.map(labelOf).join(" · "),
            },
            {
              label: "Situação",
              render: (r) => (
                <Badge value={r.enabled ? "ACTIVE" : "DISABLED"} />
              ),
            },
            {
              label: "Ações",
              render: (r) => (
                <Button onClick={() => setEditor(r.serviceCode)}>
                  Configurar e ver chaves
                </Button>
              ),
            },
          ]}
        />
        <PageNav
          page={page}
          total={query.data?.total || 0}
          onChange={setPage}
        />
      </QueryState>
      {editor ? (
        <ClientEditor
          api={api}
          service={editor === "create" ? null : editor}
          scope={scope}
          onClose={() => setEditor(null)}
          onSaved={query.reload}
        />
      ) : null}
    </Section>
  );
}
const rootsFrom = (value) =>
  String(value)
    .split(/[\s,;]+/)
    .filter(Boolean);
function ClientEditor({ api, service, scope, onClose, onSaved }) {
  const query = useRemote(
    useCallback(
      () =>
        service
          ? api.client(service)
          : Promise.resolve({
              serviceCode: "",
              enabled: true,
              operations: ["PDP_DECIDE"],
              scopeRoots: [scope],
              keys: [],
            }),
      [api, service, scope],
    ),
  );
  const operation = useOperation();
  return (
    <Modal
      wide
      title={service ? `Integração ${service}` : "Nova integração técnica"}
      onClose={onClose}
      busy={operation.busy}
    >
      <Feedback {...operation} />
      <QueryState query={query}>
        {query.data ? (
          <ClientForm
            key={`${query.data.id || "new"}:${query.data.version}`}
            api={api}
            client={query.data}
            service={service}
            operation={operation}
            onClose={onClose}
            onSaved={() => {
              query.reload();
              onSaved();
            }}
          />
        ) : null}
      </QueryState>
    </Modal>
  );
}
function ClientForm({ api, client, service, operation, onClose, onSaved }) {
  const [reason, setReason] = useState(""),
    [keyAction, setKeyAction] = useState(null),
    [operations, setOperations] = useState(client.operations),
    [enabled, setEnabled] = useState(client.enabled);
  return (
    <>
      <form
        className={s.form}
        onSubmit={async (e) => {
          e.preventDefault();
          const values = new FormData(e.currentTarget);
          const ok = await operation.run(async () => {
            if (!operations.length)
              throw new Error("Selecione pelo menos uma operação.");
            const scopeRoots = rootsFrom(values.get("roots"));
            if (!scopeRoots.length)
              throw new Error("Informe pelo menos um escopo raiz.");
            if (service)
              await api.configureClient(
                client,
                enabled,
                operations,
                scopeRoots,
                reason,
              );
            else
              await api.enrollClient(
                {
                  service: String(values.get("service")),
                  operations,
                  scopeRoots,
                  publicKey: String(values.get("publicKey")),
                  expiresAt: new Date(
                    String(values.get("expiresAt")),
                  ).toISOString(),
                },
                reason,
              );
          });
          if (ok) {
            onSaved();
            if (!service) onClose();
          }
        }}
      >
        {!service ? (
          <Field
            label="Código do serviço"
            name="service"
            required
            pattern="[a-z][a-z0-9-]{1,49}"
            maxLength={50}
          />
        ) : (
          <label className={s.checkRow}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Integração habilitada
          </label>
        )}
        <div>
          <h3>Operações permitidas</h3>
          <div className={s.actions}>
            {["PDP_DECIDE", "CATALOG_SYNC"].map((op) => (
              <label key={op} className={s.permission}>
                <input
                  type="checkbox"
                  checked={operations.includes(op)}
                  onChange={(e) =>
                    setOperations((old) =>
                      e.target.checked
                        ? [...old, op]
                        : old.filter((v) => v !== op),
                    )
                  }
                />
                {labelOf(op)}
              </label>
            ))}
          </div>
        </div>
        <label className={s.field}>
          Escopos raiz
          <textarea
            name="roots"
            defaultValue={client.scopeRoots.join("\n")}
            rows={3}
            required
          />
          <small>
            Um UUID por linha. O serviço verifica a jurisdição para cada raiz.
          </small>
        </label>
        {!service ? <PublicKeyFields /> : null}
        <Reason value={reason} onChange={setReason} />
        <div className={s.dialogActions}>
          <Button onClick={onClose} disabled={operation.busy}>
            Fechar
          </Button>
          <Button primary type="submit" disabled={operation.busy}>
            {service ? "Salvar configuração" : "Cadastrar integração"}
          </Button>
        </div>
      </form>
      {service ? (
        <>
          <h3>Chaves públicas</h3>
          <p className={s.muted}>
            Use somente a chave pública da integração. A chave privada permanece
            sob responsabilidade do serviço.
          </p>
          <DataTable
            label="Chaves da integração"
            searchable={false}
            rows={client.keys}
            columns={[
              {
                label: "Impressão digital",
                render: (key) => <CopyValue value={key.fingerprint} />,
              },
              { label: "Expira em", render: (key) => dateOf(key.expiresAt) },
              {
                label: "Situação",
                render: (key) => (
                  <Badge value={key.active ? "ACTIVE" : "REVOKED"} />
                ),
              },
              {
                label: "Ações",
                render: (key) => (
                  <Button
                    danger
                    disabled={!key.active || operation.busy}
                    onClick={() => setKeyAction(key)}
                  >
                    Revogar chave
                  </Button>
                ),
              },
            ]}
          />
          <div className={s.actions}>
            <Button onClick={() => setKeyAction("rotate")}>
              Adicionar chave de rotação
            </Button>
            <Button onClick={() => setKeyAction("resource")}>
              Vincular recurso ao serviço
            </Button>
          </div>
        </>
      ) : null}
      {keyAction && typeof keyAction === "object" ? (
        <Confirm
          title="revogação da chave"
          description="A integração deixará de autenticar usando esta chave. Confira se existe uma chave substituta em uso."
          operation={operation}
          reasonRequired
          onClose={() => setKeyAction(null)}
          onConfirm={async (reason) => {
            if (
              await operation.run(() =>
                api.revokeClientKey(service, keyAction.id, reason),
              )
            ) {
              setKeyAction(null);
              onSaved();
            }
          }}
        />
      ) : null}
      {typeof keyAction === "string" ? (
        <ClientKeyAction
          api={api}
          service={service}
          action={keyAction}
          onClose={() => setKeyAction(null)}
          onSaved={() => {
            setKeyAction(null);
            onSaved();
          }}
        />
      ) : null}
    </>
  );
}
function PublicKeyFields() {
  return (
    <>
      <label className={s.field}>
        Chave pública RSA em Base64 (X.509 DER)
        <textarea
          name="publicKey"
          required
          maxLength={4096}
          rows={5}
          placeholder="Cole o conteúdo Base64, sem cabeçalhos PEM"
        />
        <small>
          RSA de 2048 a 4096 bits. Informe apenas a chave pública, sem quebras
          de linha.
        </small>
      </label>
      <Field
        label="Expiração da chave"
        name="expiresAt"
        type="datetime-local"
        required
        hint="Escolha uma data futura em até 90 dias. A data será convertida para UTC ao enviar."
      />
    </>
  );
}
function ClientKeyAction({ api, service, action, onClose, onSaved }) {
  const [reason, setReason] = useState("");
  const operation = useOperation();
  return (
    <Modal
      title={
        action === "rotate" ? "Adicionar chave pública" : "Vincular recurso"
      }
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
              action === "rotate"
                ? api.rotateClientKey(
                    service,
                    String(values.get("publicKey")),
                    new Date(String(values.get("expiresAt"))).toISOString(),
                    reason,
                  )
                : api.bindClientResource(
                    service,
                    String(values.get("type")),
                    String(values.get("resourceId")),
                    String(values.get("scope")),
                    reason,
                  ),
            )
          )
            onSaved();
        }}
      >
        {action === "rotate" ? (
          <PublicKeyFields />
        ) : (
          <>
            <Field
              label="Tipo do recurso"
              name="type"
              required
              maxLength={50}
              pattern="[A-Z][A-Z0-9_]{0,49}"
              hint="Código em maiúsculas. TENANT é reservado ao vínculo de empresas."
            />
            <Field
              label="Identificador do recurso"
              name="resourceId"
              required
              maxLength={150}
            />
            <Field label="UUID do escopo do recurso" name="scope" required />
          </>
        )}
        <Reason value={reason} onChange={setReason} />
        <div className={s.dialogActions}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button primary type="submit" disabled={operation.busy}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function RootTransfer({ api, scope, profile }) {
  const [mode, setMode] = useState("inspect"),
    [id, setId] = useState(""),
    [transfer, setTransfer] = useState(null),
    [recipient, setRecipient] = useState(""),
    [reason, setReason] = useState("");
  const operation = useOperation();
  return (
    <Section
      title="Transferência da responsabilidade ROOT"
      description="Fluxo de governança com duas pessoas: o responsável atual inicia e o destinatário indicado confirma com sua própria sessão."
    >
      <p className={s.callout}>
        A solicitação expira em 10 minutos. As duas sessões humanas precisam
        continuar válidas. A confirmação transfere a responsabilidade e preserva
        as negações existentes.
      </p>
      <Subnav
        value={mode}
        onChange={setMode}
        items={[
          { id: "inspect", label: "Consultar e confirmar" },
          { id: "initiate", label: "Iniciar transferência" },
        ]}
      />
      <Feedback {...operation} />
      {mode === "inspect" ? (
        <form
          className={s.fieldRow}
          onSubmit={async (e) => {
            e.preventDefault();
            await operation.run(
              async () => setTransfer(await api.transfer(id)),
              "Transferência consultada.",
            );
          }}
        >
          <Field
            label="UUID da transferência"
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setTransfer(null);
            }}
            required
          />
          <Button type="submit" disabled={operation.busy}>
            Consultar transferência
          </Button>
        </form>
      ) : (
        <form
          className={s.form}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const password = String(new FormData(form).get("password"));
            const ok = await operation.run(async () => {
              if (!recipient)
                throw new Error("Confira o destinatário da transferência.");
              setTransfer(
                await api.initiateTransfer(recipient, scope, password, reason),
              );
            }, "Transferência iniciada. O destinatário precisa consultar e confirmar o UUID.");
            form.reset();
            if (ok) setMode("inspect");
          }}
        >
          <IdentityPicker api={api} value={recipient} onChange={setRecipient} />
          <Field
            label="Sua senha atual para reautenticação"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          <Reason value={reason} onChange={setReason} />
          <Button
            danger
            type="submit"
            disabled={
              operation.busy || !recipient || recipient === profile?.identityId
            }
          >
            Iniciar transferência ROOT
          </Button>
        </form>
      )}
      {transfer ? (
        <>
          <Facts
            items={[
              ["Transferência", <CopyValue key="id" value={transfer.id} />],
              [
                "Iniciador",
                <CopyValue key="initiator" value={transfer.initiatorId} />,
              ],
              [
                "Destinatário",
                <CopyValue key="recipient" value={transfer.recipientId} />,
              ],
              ["Escopo", <CopyValue key="scope" value={transfer.scopeId} />],
              ["Expira em", dateOf(transfer.expiresAt)],
              ["Situação", <Badge key="status" value={transfer.status} />],
              [
                "Preserva negações",
                transfer.preservesExistingDenials ? "Sim" : "Não informado",
              ],
            ]}
          />
          {transfer.status === "PENDING" &&
          transfer.recipientId === profile?.identityId ? (
            <form
              className={s.form}
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const password = String(new FormData(form).get("password"));
                await operation.run(
                  async () =>
                    setTransfer(
                      await api.confirmTransfer(transfer.id, password),
                    ),
                  "Transferência confirmada.",
                );
                form.reset();
              }}
            >
              <Field
                label="Sua senha atual para confirmar o recebimento"
                type="password"
                name="password"
                required
                autoComplete="current-password"
              />
              <Button danger type="submit" disabled={operation.busy}>
                Confirmar recebimento da responsabilidade ROOT
              </Button>
            </form>
          ) : null}
        </>
      ) : null}
    </Section>
  );
}
