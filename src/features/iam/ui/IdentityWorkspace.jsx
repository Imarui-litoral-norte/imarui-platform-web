"use client";
import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ClipboardList,
  Eye,
  Fingerprint,
  Mail,
  Plus,
  RefreshCw,
  UserCheck,
  Users,
} from "lucide-react";
import {
  availableActions,
  dateOf,
  labelOf,
  nameOf,
  rowsOf,
} from "../model/management";
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
  Person,
  QueryState,
  Section,
  Select,
  Subnav,
} from "./ManagementUi";
import s from "./iam.module.css";

const detailLabels = {
  fullName: "Nome completo",
  legalName: "Razão social",
  tradeName: "Nome fantasia",
  name: "Nome",
  cpf: "CPF",
  cnpj: "CNPJ",
  phoneNumber: "Telefone",
  birthDate: "Nascimento",
  description: "Descrição",
  serviceName: "Serviço",
  owner: "Responsável",
};
function DetailFacts({ details = {} }) {
  return (
    <Facts
      items={Object.entries(details)
        .filter(
          ([key, value]) =>
            key !== "type" && value !== null && typeof value !== "object",
        )
        .map(([key, value]) => [detailLabels[key] || key, String(value)])}
    />
  );
}
const actionLabels = {
  activate: "Ativar",
  disable: "Desabilitar",
  reactivate: "Reativar",
};

export default function IdentityWorkspace({
  api,
  profile,
  initialIdentityId,
  initialSection,
}) {
  const canReview = (profile?.authorities || []).includes(
    "IDENTITY_APPLICATION_REVIEW",
  );
  const [section, setSection] = useState(
    initialIdentityId
      ? "identities"
      : ["applications", "identities", "tenants"].includes(initialSection)
        ? initialSection
        : canReview
          ? "applications"
          : "identities",
  );
  const [target, setTarget] = useState(
    initialIdentityId || profile?.identityId || "",
  );
  const [tenantId, setTenantId] = useState("");
  const [known, setKnown] = useState([]);
  return (
    <>
      <Subnav
        value={section}
        onChange={setSection}
        items={[
          { id: "applications", label: "Solicitações", icon: ClipboardList },
          { id: "identities", label: "Cadastro e acesso", icon: Fingerprint },
          { id: "tenants", label: "Empresas", icon: Building2 },
        ]}
      />
      {section === "applications" ? (
        <Applications
          api={api}
          tenantId={tenantId}
          setKnown={setKnown}
          onIdentity={(id) => {
            setTarget(id);
            setSection("identities");
          }}
        />
      ) : null}
      {section === "identities" ? (
        <IdentityDossier
          key={target}
          api={api}
          profile={profile}
          target={target}
          onTarget={setTarget}
          known={known}
        />
      ) : null}
      {section === "tenants" ? (
        <TenantPanel api={api} initialId={tenantId} onTenant={setTenantId} />
      ) : null}
    </>
  );
}

function Applications({ api, tenantId, setKnown, onIdentity }) {
  const load = useCallback(async () => {
    const result = rowsOf(await api.applications());
    setKnown(result.filter((a) => a.resolvedIdentityId));
    return result;
  }, [api, setKnown]);
  const query = useRemote(load),
    operation = useOperation();
  const [review, setReview] = useState(null);
  const rows = query.data || [];
  return (
    <>
      <Metrics
        items={[
          {
            label: "Solicitações",
            value: query.data ? rows.length : undefined,
            hint: "Total retornado pela consulta",
            icon: Users,
          },
          {
            label: "Aguardam análise",
            value: query.data
              ? rows.filter((r) => r.status === "PENDING").length
              : undefined,
            hint: "Cadastros para revisar",
            icon: ClipboardList,
          },
          {
            label: "Aprovadas",
            value: query.data
              ? rows.filter((r) => r.status === "APPROVED").length
              : undefined,
            hint: "Identidade e vínculo criados",
            icon: UserCheck,
          },
          {
            label: "Rejeitadas",
            value: query.data
              ? rows.filter((r) => r.status === "REJECTED").length
              : undefined,
            hint: "Consulte o motivo na revisão",
            icon: Mail,
          },
        ]}
      />
      <Section
        title="Fila de solicitações"
        description="Revise os dados, escolha uma empresa ativa e classifique o vínculo antes de aprovar."
        action={
          <Button onClick={query.reload} disabled={query.loading}>
            <RefreshCw size={15} />
            Atualizar
          </Button>
        }
      >
        <Feedback {...operation} />
        <QueryState query={query}>
          <DataTable
            label="Solicitações de identidade"
            rows={rows}
            statuses={["PENDING", "APPROVED", "REJECTED"]}
            searchText={(a) =>
              [
                nameOf(a),
                a.nickname,
                a.email,
                a.id,
                a.details?.cpf,
                a.details?.cnpj,
              ].join(" ")
            }
            columns={[
              {
                label: "Solicitante",
                sort: nameOf,
                render: (a) => <Person name={nameOf(a)} email={a.email} />,
              },
              { label: "Tipo", render: (a) => <Badge value={a.type} /> },
              {
                label: "Solicitado em",
                sort: (a) => a.requestedAt,
                render: (a) => dateOf(a.requestedAt),
              },
              { label: "Situação", render: (a) => <Badge value={a.status} /> },
              {
                label: "Ações",
                render: (a) => (
                  <div className={s.actions}>
                    <Button onClick={() => setReview(a.id)}>
                      <Eye size={14} />
                      {a.status === "PENDING" ? "Analisar" : "Ver revisão"}
                    </Button>
                    {a.resolvedIdentityId ? (
                      <Button onClick={() => onIdentity(a.resolvedIdentityId)}>
                        Abrir cadastro
                      </Button>
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        </QueryState>
      </Section>
      {review ? (
        <ApplicationReview
          api={api}
          id={review}
          initialTenantId={tenantId}
          onClose={() => setReview(null)}
          onResolved={(id) => {
            setReview(null);
            query.reload();
            if (id) onIdentity(id);
          }}
        />
      ) : null}
    </>
  );
}

function ApplicationReview({ api, id, initialTenantId, onClose, onResolved }) {
  const query = useRemote(useCallback(() => api.application(id), [api, id]));
  const operation = useOperation();
  const [tenantDraft, setTenantDraft] = useState(initialTenantId),
    [tenantId, setTenantId] = useState(initialTenantId);
  const tenantQuery = useRemote(
    useCallback(
      () => (tenantId ? api.tenant(tenantId) : Promise.resolve(null)),
      [api, tenantId],
    ),
  );
  const [affiliation, setAffiliation] = useState(""),
    [kind, setKind] = useState(""),
    [mode, setMode] = useState("approve"),
    [reason, setReason] = useState("");
  const [newTenant, setNewTenant] = useState(false);
  const application = query.data,
    tenant = tenantQuery.data;
  return (
    <Modal
      wide
      title="Analisar solicitação"
      description="Confira a solicitação atual antes de decidir. A aprovação cria um cadastro pendente de primeiro acesso."
      onClose={onClose}
      busy={operation.busy}
    >
      <QueryState query={query}>
        {application ? (
          <>
            <div className={s.dossierHeader}>
              <Person name={nameOf(application)} email={application.email} />
              <Badge value={application.status} />
            </div>
            <DetailFacts details={application.details} />
            <Facts
              items={[
                ["Apelido", application.nickname],
                ["Tipo solicitado", labelOf(application.type)],
                ["Solicitação", <CopyValue key="id" value={application.id} />],
                ["Solicitada em", dateOf(application.requestedAt)],
              ]}
            />
            {application.status !== "PENDING" ? (
              <>
                <Facts
                  items={[
                    ["Revisada em", dateOf(application.reviewedAt)],
                    [
                      "Revisor",
                      <CopyValue
                        key="reviewer"
                        value={application.reviewedByIdentityId}
                      />,
                    ],
                    ["Tipo aprovado", labelOf(application.approvedKind)],
                    [
                      "Empresa",
                      <CopyValue
                        key="tenant"
                        value={application.assignedTenantId}
                      />,
                    ],
                    [
                      "Vínculo criado",
                      <CopyValue
                        key="affiliation"
                        value={application.resultingAffiliationId}
                      />,
                    ],
                    ["Motivo da rejeição", application.rejectionReason || "—"],
                  ]}
                />
                {application.resolvedIdentityId ? (
                  <Button
                    primary
                    onClick={() => onResolved(application.resolvedIdentityId)}
                  >
                    Abrir identidade aprovada
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <ol className={s.steps}>
                  <li>
                    Conferir cadastro<small>Dados e tipo solicitado</small>
                  </li>
                  <li>
                    Escolher empresa<small>Somente contexto ativo</small>
                  </li>
                  <li>
                    Classificar vínculo<small>Tipo e identificador</small>
                  </li>
                  <li>
                    Aprovar e convidar<small>Senha definida pelo titular</small>
                  </li>
                </ol>
                <Subnav
                  value={mode}
                  onChange={setMode}
                  items={[
                    { id: "approve", label: "Aprovar cadastro" },
                    { id: "reject", label: "Rejeitar com motivo" },
                  ]}
                />
                <Feedback {...operation} />
                {mode === "approve" ? (
                  <>
                    <form
                      className={s.fieldRow}
                      onSubmit={(e) => {
                        e.preventDefault();
                        setTenantId(tenantDraft);
                        if (tenantDraft === tenantId) tenantQuery.reload();
                      }}
                    >
                      <Field
                        label="Empresa para o vínculo"
                        hint="Informe o UUID da empresa. A API atual permite consultar empresas por identificador."
                        value={tenantDraft}
                        onChange={(e) => setTenantDraft(e.target.value)}
                        required
                      />
                      <Button type="submit">Consultar empresa</Button>
                      <Button onClick={() => setNewTenant(true)}>
                        <Plus size={14} />
                        Criar empresa
                      </Button>
                    </form>
                    {tenantId ? (
                      <QueryState query={tenantQuery}>
                        {tenant ? (
                          <div className={s.callout}>
                            <strong>{tenant.name}</strong> · {tenant.code} ·{" "}
                            <Badge value={tenant.status} />
                            {tenant.status !== "ACTIVE" ? (
                              <p>
                                A empresa precisa estar ativa. Ative-a na aba
                                Empresas e consulte novamente.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </QueryState>
                    ) : null}
                    <form
                      className={s.form}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const values = new FormData(e.currentTarget);
                        let approvedIdentity;
                        const ok = await operation.run(async () => {
                          if (
                            !tenant ||
                            tenant.status !== "ACTIVE" ||
                            tenant.id !== tenantDraft.trim().toLowerCase()
                          )
                            throw new Error(
                              "Consulte a empresa selecionada e confirme que está ativa.",
                            );
                          const selection = { type: affiliation };
                          if (affiliation === "EMPLOYEE")
                            selection.registration = String(
                              values.get("registration"),
                            ).trim();
                          if (affiliation === "CUSTOMER")
                            selection.customerCode = String(
                              values.get("registration"),
                            ).trim();
                          if (affiliation === "SUPPLIER")
                            selection.supplierCode = String(
                              values.get("registration"),
                            ).trim();
                          approvedIdentity = (
                            await api.approve(
                              id,
                              tenant.id,
                              selection,
                              kind || application.type,
                            )
                          ).resolvedIdentityId;
                        }, "Solicitação aprovada. Continue pelo cadastro para gerar o convite.");
                        if (ok) onResolved(approvedIdentity);
                      }}
                    >
                      <div className={s.formGrid}>
                        <Select
                          label="Tipo aprovado"
                          value={kind || application.type}
                          onChange={(e) => setKind(e.target.value)}
                        >
                          {[...new Set([application.type, "SERVICE"])].map(
                            (k) => (
                              <option key={k} value={k}>
                                {labelOf(k)}
                              </option>
                            ),
                          )}
                        </Select>
                        <Select
                          label="Classificação do vínculo"
                          value={affiliation}
                          required
                          onChange={(e) => setAffiliation(e.target.value)}
                        >
                          <option value="">Selecione o vínculo</option>
                          {[
                            "EMPLOYEE",
                            "CUSTOMER",
                            "SUPPLIER",
                            "PARTNER",
                            "EXTERNAL",
                          ].map((type) => (
                            <option value={type} key={type}>
                              {labelOf(type)}
                            </option>
                          ))}
                        </Select>
                      </div>
                      {["EMPLOYEE", "CUSTOMER", "SUPPLIER"].includes(
                        affiliation,
                      ) ? (
                        <Field
                          key={affiliation}
                          name="registration"
                          label={
                            affiliation === "EMPLOYEE"
                              ? "Matrícula"
                              : affiliation === "CUSTOMER"
                                ? "Código do cliente"
                                : "Código do fornecedor"
                          }
                          required
                        />
                      ) : null}
                      <p className={s.callout}>
                        A aprovação cria a identidade pendente e o vínculo
                        ativo. O titular define a senha pelo convite de primeiro
                        acesso. Perfis de acesso são atribuídos na área de
                        Autorização.
                      </p>
                      <div className={s.dialogActions}>
                        <Button onClick={onClose} disabled={operation.busy}>
                          Voltar
                        </Button>
                        <Button
                          primary
                          type="submit"
                          disabled={
                            operation.busy ||
                            !tenant ||
                            tenant.status !== "ACTIVE" ||
                            tenantDraft.trim().toLowerCase() !== tenant.id
                          }
                        >
                          Aprovar solicitação
                        </Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <form
                    className={s.form}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (
                        await operation.run(
                          () => api.reject(id, reason),
                          "Solicitação rejeitada.",
                        )
                      )
                        onResolved();
                    }}
                  >
                    <label className={s.field}>
                      Motivo da rejeição
                      <textarea
                        required
                        maxLength={500}
                        rows={4}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Explique por que este cadastro não foi aprovado"
                      />
                    </label>
                    <p className={s.muted}>
                      A decisão e o administrador responsável ficam registrados.
                      Esta solicitação não poderá ser aprovada depois.
                    </p>
                    <div className={s.dialogActions}>
                      <Button onClick={onClose}>Voltar</Button>
                      <Button type="submit" danger disabled={operation.busy}>
                        Rejeitar solicitação
                      </Button>
                    </div>
                  </form>
                )}
              </>
            )}
          </>
        ) : null}
      </QueryState>
      {newTenant ? (
        <TenantEditor
          api={api}
          onClose={() => setNewTenant(false)}
          onSaved={(created) => {
            setNewTenant(false);
            setTenantDraft(created.id);
            setTenantId(created.id);
          }}
        />
      ) : null}
    </Modal>
  );
}

function IdentityDossier({ api, profile, target, onTarget, known }) {
  const [draft, setDraft] = useState(target),
    [confirm, setConfirm] = useState(null),
    [invite, setInvite] = useState("");
  const [renaming, setRenaming] = useState(false);
  const operation = useOperation();
  const query = useRemote(
    useCallback(
      () => (target ? api.identity(target) : Promise.resolve(null)),
      [api, target],
    ),
  );
  const identity = query.data;
  return (
    <Section
      title="Cadastro e acesso"
      description="Consulte a identidade, acompanhe seu ciclo de vida e continue para segurança ou permissões."
      action={
        <Button onClick={query.reload} disabled={!target || query.loading}>
          <RefreshCw size={15} />
          Atualizar
        </Button>
      }
    >
      <form
        className={s.fieldRow}
        onSubmit={(e) => {
          e.preventDefault();
          onTarget(draft.trim());
          if (draft.trim() === target) query.reload();
        }}
      >
        <Field
          label="Identidade"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          required
          placeholder="UUID da identidade"
        />
        <Button type="submit" disabled={operation.busy}>
          Abrir cadastro
        </Button>
        <Button
          onClick={() => {
            setDraft(profile.identityId);
            onTarget(profile.identityId);
          }}
        >
          Meu cadastro
        </Button>
      </form>
      {known.length ? (
        <Select
          label="Identidades das solicitações já aprovadas"
          value=""
          onChange={(e) => {
            if (e.target.value) onTarget(e.target.value);
          }}
        >
          <option value="">Selecionar um cadastro analisado</option>
          {known.map((a) => (
            <option value={a.resolvedIdentityId} key={a.id}>
              {nameOf(a)} · {a.email}
            </option>
          ))}
        </Select>
      ) : null}
      <p className={s.muted}>
        A API atual consulta identidades por UUID. Abra também pelo botão “Abrir
        cadastro” na fila de solicitações.
      </p>
      <Feedback {...operation} />
      <QueryState
        query={query}
        empty="Selecione uma identidade para consultar."
      >
        {identity ? (
          <>
            <div className={s.dossierHeader}>
              <Person
                name={nameOf(identity)}
                email={identity.primaryEmail}
                id={identity.id}
              />
              <div className={s.actions}>
                <Badge value={identity.kind} />
                <Badge value={identity.status} />
              </div>
            </div>
            <Facts
              items={[
                ["Apelido", identity.nickname],
                ["Criada em", dateOf(identity.createdAt)],
                ["Atualizada em", dateOf(identity.updatedAt)],
                ["Ativada em", dateOf(identity.activatedAt)],
                ["Desabilitada em", dateOf(identity.disabledAt)],
              ]}
            />
            <DetailFacts details={identity.details} />
            {identity.status === "PENDING" ? (
              <div className={s.callout}>
                <strong>Próxima etapa: primeiro acesso.</strong> Gere um convite
                e entregue ao titular. Ao definir a senha, a identidade é
                ativada. A ativação administrativa abaixo exige avaliar se já
                existe credencial utilizável.
              </div>
            ) : null}
            <h3>Ações do cadastro</h3>
            <div className={s.actions}>
              <Button onClick={() => setRenaming(true)}>Alterar apelido</Button>
              {identity.status === "PENDING" ? (
                <Button
                  primary
                  disabled={operation.busy}
                  onClick={() => setConfirm("invitation")}
                >
                  <Mail size={15} />
                  Gerar convite de primeiro acesso
                </Button>
              ) : null}
              {availableActions(identity.status)
                .filter((a) => a !== "activate")
                .map((action) => (
                  <Button
                    danger={action === "disable"}
                    key={action}
                    disabled={operation.busy}
                    onClick={() => setConfirm(action)}
                  >
                    {actionLabels[action]} identidade
                  </Button>
                ))}
            </div>
            {identity.status === "PENDING" ? (
              <details>
                <summary>Ativação administrativa</summary>
                <p className={s.muted}>
                  Ativa o cadastro sem definir senha. O convite de primeiro
                  acesso só pode ser concluído por uma identidade pendente. Use
                  este caminho apenas quando o fluxo de credenciais já tiver
                  sido tratado.
                </p>
                <Button
                  disabled={operation.busy}
                  onClick={() => setConfirm("activate")}
                >
                  Ativar administrativamente
                </Button>
              </details>
            ) : null}
            {invite ? (
              <div className={s.callout}>
                <h3>Convite de uso único</h3>
                <CopyValue
                  value={invite}
                  label="Copiar convite de primeiro acesso"
                />
                <p>
                  Entregue ao titular. O convite fica apenas nesta tela e não é
                  salvo no navegador.
                </p>
                <Button onClick={() => setInvite("")}>Ocultar convite</Button>
              </div>
            ) : null}
            <h3>Continuar a gestão desta identidade</h3>
            <div className={s.actions}>
              <Link
                className={s.linkButton}
                href={`/iam/autenticacao?section=admin&identityId=${encodeURIComponent(identity.id)}`}
              >
                Consultar sessões
              </Link>
              <Link
                className={s.linkButton}
                href={`/iam/autorizacao?section=assignments&identityId=${encodeURIComponent(identity.id)}`}
              >
                Gerenciar perfis
              </Link>
              <Link
                className={s.linkButton}
                href={`/iam/autorizacao?section=diagnostics&identityId=${encodeURIComponent(identity.id)}`}
              >
                Diagnosticar acesso
              </Link>
            </div>
          </>
        ) : null}
      </QueryState>
      {confirm && identity ? (
        <Confirm
          title={
            confirm === "invitation"
              ? "geração de convite"
              : `${actionLabels[confirm]} identidade`
          }
          description={
            confirm === "disable"
              ? `Desabilitar ${identity.nickname} solicita a revogação dos acessos. O cadastro será preservado.`
              : confirm === "invitation"
                ? "O titular receberá um link para definir sua senha. Entregue o convite pelo canal adequado."
                : confirm === "activate"
                  ? "Esta ação ativa o cadastro sem criar uma senha e impede concluir um convite de primeiro acesso pendente."
                  : "O cadastro volta a ficar ativo. Sessões revogadas continuam inválidas."
          }
          onClose={() => setConfirm(null)}
          operation={operation}
          danger={confirm === "disable" || confirm === "activate"}
          onConfirm={async () => {
            if (
              await operation.run(async () => {
                if (confirm === "invitation") {
                  const result = await api.invitation(identity.id);
                  setInvite(
                    `${window.location.origin}/first-access#token=${encodeURIComponent(result.invitation)}`,
                  );
                } else {
                  await api.identityAction(identity.id, confirm);
                  query.reload();
                  setInvite("");
                }
              })
            )
              setConfirm(null);
          }}
        />
      ) : null}
      {renaming && identity ? (
        <RenameIdentity
          api={api}
          identity={identity}
          onClose={() => setRenaming(false)}
          onSaved={() => {
            setRenaming(false);
            query.reload();
          }}
        />
      ) : null}
    </Section>
  );
}
function RenameIdentity({ api, identity, onClose, onSaved }) {
  const operation = useOperation();
  return (
    <Modal title="Alterar apelido" onClose={onClose} busy={operation.busy}>
      <Feedback {...operation} />
      <form
        className={s.form}
        onSubmit={async (e) => {
          e.preventDefault();
          const nickname = String(
            new FormData(e.currentTarget).get("nickname"),
          );
          if (
            await operation.run(() => api.renameIdentity(identity.id, nickname))
          )
            onSaved();
        }}
      >
        <Field
          label="Apelido"
          name="nickname"
          defaultValue={identity.nickname}
          minLength={3}
          maxLength={64}
          required
          hint="O apelido precisa ser único no sistema."
        />
        <div className={s.dialogActions}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button primary type="submit" disabled={operation.busy}>
            Salvar apelido
          </Button>
        </div>
      </form>
    </Modal>
  );
}
function TenantPanel({ api, initialId, onTenant }) {
  const [draft, setDraft] = useState(initialId),
    [id, setId] = useState(initialId),
    [editor, setEditor] = useState(null),
    [action, setAction] = useState(null);
  const operation = useOperation();
  const query = useRemote(
    useCallback(() => (id ? api.tenant(id) : Promise.resolve(null)), [api, id]),
  );
  const tenant = query.data;
  return (
    <Section
      title="Empresas e contextos de vínculo"
      description="Crie e ative a empresa antes de aprovar cadastros. A desabilitação suspende a validade contextual dos vínculos."
      action={
        <Button primary onClick={() => setEditor("create")}>
          <Plus size={15} />
          Nova empresa
        </Button>
      }
    >
      <form
        className={s.fieldRow}
        onSubmit={(e) => {
          e.preventDefault();
          setId(draft);
          onTenant(draft);
          if (draft === id) query.reload();
        }}
      >
        <Field
          label="UUID da empresa"
          required
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit">Consultar empresa</Button>
      </form>
      <Feedback {...operation} />
      <QueryState
        query={query}
        empty="Consulte uma empresa por UUID ou crie uma nova."
      >
        {tenant ? (
          <>
            <div className={s.dossierHeader}>
              <Person name={tenant.name} email={tenant.code} id={tenant.id} />
              <Badge value={tenant.status} />
            </div>
            <Facts
              items={[
                ["Criada em", dateOf(tenant.createdAt)],
                ["Atualizada em", dateOf(tenant.updatedAt)],
                ["Ativada em", dateOf(tenant.activatedAt)],
                ["Desabilitada em", dateOf(tenant.disabledAt)],
              ]}
            />
            <div className={s.actions}>
              <Button
                disabled={tenant.status === "DISABLED"}
                onClick={() => setEditor("rename")}
              >
                Renomear empresa
              </Button>
              {availableActions(tenant.status).map((a) => (
                <Button
                  key={a}
                  danger={a === "disable"}
                  onClick={() => setAction(a)}
                >
                  {actionLabels[a]} empresa
                </Button>
              ))}
            </div>
            <p className={s.muted}>
              O código é permanente. Reativar a empresa não reativa vínculos
              inativos nem restaura tokens revogados.
            </p>
          </>
        ) : null}
      </QueryState>
      {editor ? (
        <TenantEditor
          api={api}
          tenant={editor === "rename" ? tenant : null}
          onClose={() => setEditor(null)}
          onSaved={(result) => {
            setEditor(null);
            setId(result.id);
            setDraft(result.id);
            onTenant(result.id);
            query.reload();
          }}
        />
      ) : null}
      {action && tenant ? (
        <Confirm
          title={`${actionLabels[action]} empresa`}
          description={
            action === "disable"
              ? "Os vínculos com esta empresa ficam indisponíveis, preservando os cadastros e estados individuais."
              : "A empresa ficará ativa para uso nos vínculos elegíveis."
          }
          operation={operation}
          onClose={() => setAction(null)}
          danger={action === "disable"}
          onConfirm={async () => {
            if (
              await operation.run(() => api.tenantAction(tenant.id, action))
            ) {
              setAction(null);
              query.reload();
            }
          }}
        />
      ) : null}
    </Section>
  );
}
function TenantEditor({ api, tenant, onClose, onSaved }) {
  const operation = useOperation();
  return (
    <Modal
      title={tenant ? "Renomear empresa" : "Nova empresa"}
      description={
        tenant
          ? "O código da empresa permanece o mesmo."
          : "A empresa é criada pendente. Ative-a antes de aprovar vínculos."
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
          let result;
          const ok = await operation.run(async () => {
            result = tenant
              ? await api.renameTenant(tenant.id, String(values.get("name")))
              : await api.createTenant(
                  String(values.get("code")),
                  String(values.get("name")),
                );
          });
          if (ok) onSaved(result);
        }}
      >
        {!tenant ? (
          <Field
            label="Código"
            name="code"
            minLength={3}
            maxLength={50}
            pattern="[A-Za-z][A-Za-z0-9_]{2,49}"
            hint="Comece com uma letra. Use letras, números e underscore."
            required
          />
        ) : null}
        <Field
          label="Nome da empresa"
          name="name"
          defaultValue={tenant?.name || ""}
          required
          maxLength={150}
        />
        <div className={s.dialogActions}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button primary type="submit" disabled={operation.busy}>
            {tenant ? "Salvar nome" : "Criar empresa pendente"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
