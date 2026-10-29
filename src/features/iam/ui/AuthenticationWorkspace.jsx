"use client";
import { useCallback, useState } from "react";
import {
  History,
  KeyRound,
  Laptop,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { dateOf, rowsOf } from "../model/management";
import { useOperation, useRemote } from "./useManagement";
import {
  Badge,
  Button,
  Confirm,
  CopyValue,
  DataTable,
  Feedback,
  Field,
  Metrics,
  PageNav,
  QueryState,
  Section,
  Subnav,
} from "./ManagementUi";
import s from "./iam.module.css";
import IdentityReference from "./IdentityReference";

export default function AuthenticationWorkspace({
  api,
  profile,
  refreshSession,
  clearSession,
  initialSection,
  initialIdentityId,
}) {
  const [section, setSection] = useState(
    ["own", "admin", "tokens", "password"].includes(initialSection)
      ? initialSection
      : "own",
  );
  return (
    <>
      <Subnav
        value={section}
        onChange={setSection}
        items={[
          { id: "own", label: "Minhas sessões", icon: Laptop },
          { id: "admin", label: "Sessões administrativas", icon: ShieldCheck },
          { id: "tokens", label: "Renovações de acesso", icon: History },
          { id: "password", label: "Senha e recuperação", icon: LockKeyhole },
        ]}
      />
      {section === "own" ? (
        <OwnSessions
          api={api}
          profile={profile}
          refreshSession={refreshSession}
          clearSession={clearSession}
        />
      ) : null}
      {section === "admin" || section === "tokens" ? (
        <AdministrativeSecurity
          key={section}
          api={api}
          tokens={section === "tokens"}
          initialIdentityId={initialIdentityId}
          profile={profile}
          clearSession={clearSession}
        />
      ) : null}
      {section === "password" ? (
        <PasswordPanel api={api} clearSession={clearSession} />
      ) : null}
    </>
  );
}
function OwnSessions({ api, profile, refreshSession, clearSession }) {
  const query = useRemote(useCallback(() => api.sessions(), [api]));
  const operation = useOperation(),
    [target, setTarget] = useState(null);
  const rows = rowsOf(query.data);
  return (
    <>
      <Metrics
        items={[
          {
            label: "Minhas sessões",
            value: query.data ? rows.length : undefined,
            icon: Laptop,
            hint: "Sessões retornadas para sua conta",
          },
          {
            label: "Ativas",
            value: query.data
              ? rows.filter((r) => r.status === "ACTIVE").length
              : undefined,
            icon: ShieldCheck,
            hint: "Inclui outros navegadores",
          },
          {
            label: "Histórico",
            value: query.data
              ? rows.filter((r) => r.status !== "ACTIVE").length
              : undefined,
            icon: History,
            hint: "Encerradas, expiradas ou revogadas",
          },
        ]}
      />
      <Section
        title="Onde sua conta está conectada"
        description="Confira a criação e a expiração. Encerre acessos que você não reconhece."
        action={
          <div className={s.actions}>
            <Button
              disabled={operation.busy}
              onClick={() =>
                void operation.run(refreshSession, "Seu acesso foi renovado.")
              }
            >
              <RefreshCw size={14} />
              Renovar meu acesso
            </Button>
            <Button onClick={query.reload}>Atualizar lista</Button>
          </div>
        }
      >
        <Feedback {...operation} />
        <QueryState query={query}>
          <DataTable
            label="Minhas sessões"
            rows={rows}
            statuses={["ACTIVE", "LOGGED_OUT", "EXPIRED", "REVOKED"]}
            columns={[
              {
                label: "Sessão",
                render: (r) => (
                  <div>
                    <CopyValue value={r.sid} />
                    {r.sid === (profile?.sessionId || profile?.sid) ? (
                      <Badge value="ACTIVE">Esta sessão</Badge>
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
                label: "Expira em",
                sort: (r) => r.expiresAt,
                render: (r) => dateOf(r.expiresAt),
              },
              { label: "Situação", render: (r) => <Badge value={r.status} /> },
              {
                label: "Ações",
                render: (r) => (
                  <Button
                    danger
                    disabled={r.status !== "ACTIVE" || operation.busy}
                    onClick={() => setTarget(r)}
                  >
                    Encerrar sessão
                  </Button>
                ),
              },
            ]}
          />
        </QueryState>
        {target ? (
          <Confirm
            title="encerramento da sessão"
            description="Esta sessão deixa de poder ser utilizada. Se for o navegador atual, será necessário entrar novamente."
            onClose={() => setTarget(null)}
            operation={operation}
            onConfirm={async () => {
              if (
                await operation.run(
                  () => api.endSession(target.sid),
                  "Sessão encerrada.",
                )
              ) {
                setTarget(null);
                if (target.sid === (profile?.sessionId || profile?.sid)) {
                  clearSession();
                  window.location.assign("/login");
                } else query.reload();
              }
            }}
          />
        ) : null}
      </Section>
    </>
  );
}
function AdministrativeSecurity({
  api,
  tokens,
  initialIdentityId,
  profile,
  clearSession,
}) {
  const [page, setPage] = useState(0),
    [identityFilter, setIdentityFilter] = useState(
      tokens ? "" : initialIdentityId,
    ),
    [target, setTarget] = useState(null);
  const operation = useOperation();
  const query = useRemote(
    useCallback(
      () =>
        tokens ? api.refreshTokens(page, 20) : api.adminSessions(page, 20),
      [api, tokens, page],
    ),
  );
  const rows = rowsOf(query.data),
    visible = identityFilter.trim()
      ? rows.filter((r) => r.identityId === identityFilter.trim().toLowerCase())
      : rows;
  return (
    <Section
      title={tokens ? "Tokens de renovação" : "Sessões de todas as identidades"}
      description={
        tokens
          ? "Metadados de renovação, sessão de origem e substituição por rotação."
          : "Consulte as sessões administrativas e encerre uma sessão específica."
      }
      action={
        <Button onClick={query.reload} disabled={query.loading}>
          <RefreshCw size={15} />
          Atualizar
        </Button>
      }
    >
      <p className={s.callout}>
        {tokens
          ? "Revogar um token impede sua próxima renovação. Para encerrar o acesso da sessão, use a aba Sessões administrativas."
          : "Encerrar uma sessão invalida seu acesso. A ação usa o ID numérico administrativo; o UUID identifica a sessão pública."}
      </p>
      <Feedback {...operation} />
      <QueryState query={query}>
        <Metrics
          items={[
            {
              label: "Registros nesta página",
              value: rows.length,
              icon: tokens ? KeyRound : Laptop,
            },
            {
              label: "Ativos nesta página",
              value: rows.filter((r) => r.status === "ACTIVE").length,
              icon: ShieldCheck,
            },
          ]}
        />
        {!tokens ? (
          <Field
            label="Filtrar identidade nesta página"
            hint="A API não oferece filtro por identidade. Este filtro atua apenas nos 20 registros da página consultada; navegue para consultar outros registros."
            value={identityFilter}
            onChange={(e) => setIdentityFilter(e.target.value)}
            placeholder="UUID da identidade (opcional)"
          />
        ) : null}
        <p className={s.muted}>
          Busca e situação filtram apenas a página consultada. A navegação
          abaixo consulta outras páginas no servidor.
        </p>
        <DataTable
          label={
            tokens
              ? "Tokens da página atual"
              : "Sessões administrativas da página atual"
          }
          rows={visible}
          paginate={false}
          statuses={["ACTIVE", "LOGGED_OUT", "EXPIRED", "REVOKED", "ROTATED"]}
          columns={[
            {
              label: tokens ? "Renovação" : "Sessão",
              sort: (r) => r.id,
              render: (r) => <strong>#{r.id}</strong>,
            },
            {
              label: tokens ? "Sessão de origem" : "Identidade",
              render: (r) =>
                tokens ? (
                  `Sessão #${r.sessionId}`
                ) : (
                  <IdentityReference api={api} id={r.identityId} />
                ),
            },
            {
              label: "Criada em",
              sort: (r) => r.createdAt,
              render: (r) => dateOf(r.createdAt),
            },
            {
              label: "Expira em",
              sort: (r) => r.expiresAt,
              render: (r) => dateOf(r.expiresAt),
            },
            { label: "Situação", render: (r) => <Badge value={r.status} /> },
            {
              label: tokens ? "Substituído por" : "Encerrada / revogada em",
              render: (r) =>
                tokens
                  ? r.replacedByTokenId
                    ? `Token #${r.replacedByTokenId}`
                    : "—"
                  : dateOf(r.loggedOutAt || r.revokedAt),
            },
            {
              label: "Ações",
              render: (r) => (
                <Button
                  danger
                  disabled={r.status !== "ACTIVE" || operation.busy}
                  onClick={() => setTarget(r)}
                >
                  {tokens ? "Revogar token" : "Encerrar sessão"}
                </Button>
              ),
            },
          ]}
        />
        <PageNav
          page={page}
          hasNext={rows.length === 20}
          onChange={setPage}
          disabled={query.loading}
        />
      </QueryState>
      {target ? (
        <Confirm
          title={tokens ? "revogação do token" : "encerramento da sessão"}
          description={
            tokens
              ? `Revogar a renovação #${target.id} da sessão #${target.sessionId}? A próxima renovação com este token será recusada.`
              : `Encerrar a sessão #${target.id} da identidade ${target.identityId}?`
          }
          onClose={() => setTarget(null)}
          operation={operation}
          onConfirm={async () => {
            if (
              await operation.run(
                () =>
                  tokens
                    ? api.revokeRefreshToken(target.id)
                    : api.endAdminSession(target.id),
                tokens ? "Token revogado." : "Sessão encerrada.",
              )
            ) {
              setTarget(null);
              if (
                !tokens &&
                target.sid === (profile?.sessionId || profile?.sid)
              ) {
                clearSession();
                window.location.assign("/login");
              } else query.reload();
            }
          }}
        />
      ) : null}
    </Section>
  );
}
function PasswordPanel({ api, clearSession }) {
  const operation = useOperation();
  return (
    <div className={s.split}>
      <Section
        title="Alterar minha senha"
        description="A troca encerra suas sessões. Você precisará entrar novamente."
      >
        <Feedback {...operation} />
        <form
          className={s.form}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const values = new FormData(form);
            const current = String(values.get("current")),
              next = String(values.get("next")),
              confirmation = String(values.get("confirmation"));
            await operation.run(async () => {
              if (next !== confirmation)
                throw new Error(
                  "A confirmação precisa ser igual à nova senha.",
                );
              if ([...next].length < 12)
                throw new Error(
                  "A nova senha deve ter pelo menos 12 caracteres.",
                );
              if (new TextEncoder().encode(next).length > 72)
                throw new Error("A nova senha deve ter até 72 bytes UTF-8.");
              await api.changePassword(current, next);
              form.reset();
              clearSession();
              window.location.assign("/login");
            }, "Senha alterada. Entre novamente.");
          }}
        >
          <Field
            label="Senha atual"
            name="current"
            type="password"
            required
            autoComplete="current-password"
          />
          <Field
            label="Nova senha"
            name="next"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            hint="Use pelo menos 12 caracteres. Limite de 72 bytes UTF-8."
          />
          <Field
            label="Confirmar nova senha"
            name="confirmation"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
          />
          <Button primary type="submit" disabled={operation.busy}>
            Alterar senha e encerrar minhas sessões
          </Button>
        </form>
      </Section>
      <Section
        title="Recuperação e primeiro acesso"
        description="Escolha o fluxo adequado para a situação do titular."
      >
        <ol className={s.stack}>
          <li>
            <h3>Cadastro aprovado e ainda pendente</h3>
            <p className={s.muted}>
              Abra a identidade e gere o convite de primeiro acesso. O titular
              define a senha e ativa o cadastro pelo link.
            </p>
          </li>
          <li>
            <h3>Conta ativa que esqueceu a senha</h3>
            <p className={s.muted}>
              O titular solicita recuperação na tela de entrada e conclui a
              redefinição pelo canal cadastrado.
            </p>
          </li>
          <li>
            <h3>Suspeita de acesso indevido</h3>
            <p className={s.muted}>
              Encerre as sessões administrativas e revise os tokens de
              renovação. Para suspender o cadastro, desabilite a identidade.
            </p>
          </li>
        </ol>
        <p className={s.callout}>
          A API atual não disponibiliza consulta ou cancelamento administrativo
          dos pedidos de recuperação. Esses controles dependem de evolução do
          serviço.
        </p>
      </Section>
    </div>
  );
}
