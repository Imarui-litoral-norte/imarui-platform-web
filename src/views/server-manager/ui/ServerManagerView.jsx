"use client";

import { authRequest } from "@/features/auth/lib/authApi";
import { buildGatewayUrl } from "@/shared/network/gatewayUrl";
import { APP_ROUTES } from "@/shared/config/routes";
import { useManagedServices } from "@/features/server-manager/model/useManagedServices";

const requestServices=(path,options={})=>authRequest(path,{...options,authenticated:true});

const SERVICE_METADATA = {
  iiam: { label: "IIAM", description: "Identidade, autenticação e autorização centralizadas.", accessPath: "/api/iam/docs" },
  "gerenciador-extracao": {
    label: "Gerenciador Extracao",
    description: "Worker Python de extracao e transferencia.",
    accessPath: APP_ROUTES.EXTRATOR_MANAGER,
  },
  "gerenciador-database-monitoring": {
    label: "Database Monitoring",
    description: "Painel e automacoes ligadas ao monitoramento do banco.",
    accessPath: "/gerenciador-database/monitoring/",
  },
  "gerenciador-database-backup": {
    label: "Database Backup",
    description: "Rotinas de backup expostas pelo gateway.",
    accessPath: "/gerenciador-database/backup/",
  },
  "n8n-interno": {
    label: "N8N interno",
    description: "Stack Docker do n8n exposta pelo gateway.",
    accessPath: "/n8n/",
  },
  "critica-pedidos": {
    label: "Critica Pedidos",
    description: "Painel independente de critica e roteirizacao, com repositorio Git proprio.",
    accessPath: APP_ROUTES.CRITICA_PEDIDOS,
  },
  "evolution-interno": {
    label: "Evolution Interno",
    description: "Stack Docker da Evolution API.",
    accessPath: "/evolution/",
  },
  frontend: {
    label: "Frontend",
    description: "Aplicacao Next.js servida pelo gateway.",
    accessPath: APP_ROUTES.HOME,
  },
};

function formatDateTime(value) {
  if (!value) {
    return "Nao registrado";
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "Nao registrado";
  }

  return new Date(timestamp).toLocaleString("pt-BR");
}

function formatServiceType(type) {
  switch (type) {
    case "JAVA":
      return "Java";
    case "PYTHON":
      return "Python";
    case "NODE":
      return "Node";
    case "DOCKER":
      return "Docker";
    default:
      return type || "Desconhecido";
  }
}

function formatStartupStatus(startup) {
  const currentServiceId = startup?.currentServiceId;

  switch (startup?.status) {
    case "COMPLETED":
      return "Concluido";
    case "RUNNING":
      return currentServiceId
        ? `Em andamento: ${currentServiceId}`
        : "Em andamento";
    case "FAILED":
      return currentServiceId
        ? `Falhou em ${currentServiceId}`
        : "Falhou";
    case "NOT_STARTED":
      return "Nao iniciado";
    default:
      return "Sem leitura";
  }
}

function resolveServiceMeta(service) {
  return (
    SERVICE_METADATA[service.id] || {
      label: service.id,
      description: "Servico gerenciado pelo gateway.",
      accessPath: "",
    }
  );
}

function ServiceActionButton({
  children,
  disabled = false,
  onClick,
  tone = "default",
}) {
  const toneClass =
    tone === "danger"
      ? "border-[color:var(--shell-danger)] text-[var(--shell-danger)] hover:bg-[var(--shell-danger-bg)]"
      : tone === "accent"
        ? "border-[color:var(--shell-accent)] text-[var(--shell-accent)] hover:bg-[var(--shell-accent-soft)]"
        : "border-[color:var(--shell-line)] text-[var(--shell-text)] hover:border-[color:var(--shell-line-strong)] hover:bg-[var(--shell-surface)]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center rounded-2xl border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`}
    >
      {children}
    </button>
  );
}

function StatusPill({ running, text }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
        running
          ? "bg-[var(--shell-accent-soft)] text-[var(--shell-accent)]"
          : "bg-[var(--shell-surface-muted)] text-[var(--shell-muted)]"
      }`}
    >
      {text}
    </span>
  );
}

function ServiceModePill({ enabled, startOnBoot }) {
  if (!enabled) {
    return (
      <span className="inline-flex rounded-full bg-[var(--shell-danger-bg)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--shell-danger)]">
        Start manual
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-[var(--shell-surface-muted)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--shell-muted)]">
      {startOnBoot ? "Boot automatico" : "Start manual"}
    </span>
  );
}

function SystemSummaryCard({ label, value, hint, tone = "default" }) {
  const valueClass =
    tone === "danger"
      ? "text-[var(--shell-danger)]"
      : tone === "accent"
        ? "text-[var(--shell-accent)]"
        : "text-[var(--shell-text)]";

  return (
    <article className="rounded-[24px] border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shell-muted)]">
        {label}
      </p>
      <p className={`mt-3 text-lg font-semibold ${valueClass}`}>{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--shell-muted)]">{hint}</p>
    </article>
  );
}

function ServerManagerDashboard() {
  const {
    actionState,
    error,
    lastLoadedAt,
    overview,
    refreshOverview,
    restartService,
    restartSystem,
    runningCount,
    services,
    startService,
    startSystem,
    status,
    stopService,
    stopSystem,
  } = useManagedServices(requestServices);

  const startup = overview.startup;
  const totalServices = services.length;
  const gatewayState = status === "ready" ? "Online" : status === "loading" ? "Consultando" : "Sem resposta";
  const startupState = formatStartupStatus(startup);
  const failedStartup = startup?.status === "FAILED";
  const bulkActionRunning = Boolean(actionState);

  const handleStopSystem = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Parar o sistema vai encerrar os processos gerenciados, incluindo o frontend se ele estiver ativo. Deseja continuar?",
      )
    ) {
      return;
    }

    await stopSystem();
  };

  const handleRestartSystem = async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Reiniciar o sistema vai reciclar os processos gerenciados. O frontend pode ficar indisponivel por alguns segundos. Deseja continuar?",
      )
    ) {
      return;
    }

    await restartSystem();
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
      <section className="space-y-4">
        <section className="rounded-[28px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--shell-accent)]">
                Servidor
              </p>
              <h1 className="mt-3 font-serif text-3xl text-[var(--shell-text)] sm:text-4xl">
                Gateway e processos gerenciados
              </h1>
              <p className="mt-3 text-sm leading-7 text-[var(--shell-muted)]">
                Esta tela consulta o gateway em <code>/api/v1/admin/services</code> para
                acompanhar o reconcile, os runtimes persistidos e executar start,
                stop e restart de cada processo sem depender dos arquivos{" "}
                <code>.pid</code> como interface principal.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ServiceActionButton
                onClick={() => void refreshOverview()}
                disabled={bulkActionRunning}
              >
                Atualizar
              </ServiceActionButton>
              <ServiceActionButton
                onClick={() => void startSystem()}
                disabled={bulkActionRunning || status === "loading"}
                tone="accent"
              >
                Ligar sistema
              </ServiceActionButton>
              <ServiceActionButton
                onClick={() => void handleRestartSystem()}
                disabled={bulkActionRunning || status === "loading"}
              >
                Reiniciar sistema
              </ServiceActionButton>
              <ServiceActionButton
                onClick={() => void handleStopSystem()}
                disabled={bulkActionRunning || status === "loading"}
                tone="danger"
              >
                Desligar sistema
              </ServiceActionButton>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SystemSummaryCard
              label="Gateway Java"
              value={gatewayState}
              hint={`Ultima leitura: ${formatDateTime(lastLoadedAt)}`}
              tone={status === "error" ? "danger" : "accent"}
            />
            <SystemSummaryCard
              label="Reconcile"
              value={startupState}
              hint={
                startup?.finishedAt
                  ? `Finalizado em ${formatDateTime(startup.finishedAt)}`
                  : `Inicio em ${formatDateTime(startup?.startedAt)}`
              }
              tone={failedStartup ? "danger" : "default"}
            />
            <SystemSummaryCard
              label="Processos ativos"
              value={`${runningCount}/${totalServices}`}
              hint="Contagem baseada no runtime persistido pelo gateway."
              tone={runningCount > 0 ? "accent" : "default"}
            />
            <SystemSummaryCard
              label="Controle"
              value={actionState ? `${actionState.step}/${actionState.total}` : "Pronto"}
              hint={actionState ? actionState.label : "Nenhuma acao em andamento."}
              tone={actionState ? "accent" : "default"}
            />
          </div>

          {failedStartup ? (
            <div className="mt-6 rounded-[24px] border border-[color:var(--shell-danger)] bg-[var(--shell-danger-bg)] px-4 py-4 text-sm text-[var(--shell-danger)]">
              <p className="font-semibold">O startup do gateway falhou.</p>
              <p className="mt-2 leading-6">
                {startup?.errorMessage || "Falha sem mensagem registrada."}
              </p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-[24px] border border-[color:var(--shell-danger)] bg-[var(--shell-danger-bg)] px-4 py-4 text-sm text-[var(--shell-danger)]">
              {error}
            </div>
          ) : null}
        </section>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--shell-accent)]">
                Processos
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--shell-text)]">
                Estado individual dos servicos
              </h2>
            </div>
            <p className="text-sm text-[var(--shell-muted)]">
              A lista usa o catalogo do gateway, inclusive para servicos hoje parados.
            </p>
          </div>

          <div className="space-y-3">
            {services.map((service) => {
              const meta = resolveServiceMeta(service);
              const enabled = service.enabled !== false;
              const hasAccessPath = Boolean(meta.accessPath) && service.running;
              const stopDisabled = bulkActionRunning || !service.running;
              const startDisabled = bulkActionRunning || service.running;
              const restartDisabled = bulkActionRunning;

              return (
                <article
                  key={service.id}
                  className={`rounded-[24px] border bg-[var(--shell-surface)] p-4 shadow-[0_12px_36px_rgba(20,32,43,0.06)] ${
                    service.running
                      ? "border-[color:var(--shell-accent)]"
                      : "border-[color:var(--shell-line)]"
                  }`}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-[var(--shell-text)]">
                          {meta.label}
                        </h3>
                        <StatusPill
                          running={service.running}
                          text={service.running ? "Ativo" : "Parado"}
                        />
                        <span className="inline-flex rounded-full bg-[var(--shell-surface-muted)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--shell-muted)]">
                          {formatServiceType(service.type)}
                        </span>
                        <ServiceModePill
                          enabled={enabled}
                          startOnBoot={service.startOnBoot}
                        />
                      </div>

                      <p className="mt-2 text-sm leading-6 text-[var(--shell-muted)]">
                        {meta.description}
                      </p>

                      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3">
                          <dt className="text-[var(--shell-muted)]">Service ID</dt>
                          <dd className="mt-1 font-semibold text-[var(--shell-text)]">
                            {service.id}
                          </dd>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3">
                          <dt className="text-[var(--shell-muted)]">Porta</dt>
                          <dd className="mt-1 font-semibold text-[var(--shell-text)]">
                            {service.running && service.runtime?.port
                              ? `${service.runtime.port} ativa`
                              : `${service.preferredPort} preferida`}
                          </dd>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3">
                          <dt className="text-[var(--shell-muted)]">PID</dt>
                          <dd className="mt-1 font-semibold text-[var(--shell-text)]">
                            {service.runtime?.listenerPid || service.runtime?.rootPid || "Nao salvo"}
                          </dd>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3">
                          <dt className="text-[var(--shell-muted)]">Ultimo start</dt>
                          <dd className="mt-1 font-semibold text-[var(--shell-text)]">
                            {formatDateTime(service.runtime?.startedAt)}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--shell-muted)]">
                        <span className="rounded-full bg-[var(--shell-surface-muted)] px-3 py-1">
                          Prefixo {service.pathPrefix}
                        </span>
                        <span className="rounded-full bg-[var(--shell-surface-muted)] px-3 py-1">
                          Var {service.portEnvironmentVariable}
                        </span>
                      </div>
                    </div>

                    <div className="flex w-full flex-wrap gap-2 xl:w-[320px] xl:justify-end">
                      {hasAccessPath ? (
                        <a
                          href={buildGatewayUrl(meta.accessPath)}
                          className="inline-flex h-10 items-center justify-center rounded-2xl border border-[color:var(--shell-line)] px-3 text-sm font-semibold text-[var(--shell-text)] transition hover:border-[color:var(--shell-line-strong)] hover:bg-[var(--shell-surface-muted)]"
                        >
                          Abrir
                        </a>
                      ) : null}
                      <ServiceActionButton
                        onClick={() => void startService(service)}
                        disabled={startDisabled}
                        tone="accent"
                      >
                        Iniciar
                      </ServiceActionButton>
                      <ServiceActionButton
                        onClick={() => void restartService(service)}
                        disabled={restartDisabled}
                      >
                        Reiniciar
                      </ServiceActionButton>
                      <ServiceActionButton
                        onClick={() => void stopService(service)}
                        disabled={stopDisabled}
                        tone="danger"
                      >
                        Parar
                      </ServiceActionButton>
                    </div>
                  </div>
                  {!enabled ? (
                    <div className="mt-4 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3 text-sm text-[var(--shell-muted)]">
                      Este servico nao entra no boot nem nas acoes em massa do sistema, mas pode ser iniciado manualmente por esta tela quando for necessario.
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-[28px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shell-accent)]">
            Estado do gateway
          </p>

          <dl className="mt-4 space-y-3 text-sm">
            <div className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3">
              <dt className="text-[var(--shell-muted)]">Status do reconcile</dt>
              <dd className="mt-1 font-semibold text-[var(--shell-text)]">{startupState}</dd>
            </div>
            <div className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3">
              <dt className="text-[var(--shell-muted)]">Inicio do reconcile</dt>
              <dd className="mt-1 font-semibold text-[var(--shell-text)]">
                {formatDateTime(startup?.startedAt)}
              </dd>
            </div>
            <div className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3">
              <dt className="text-[var(--shell-muted)]">Fim do reconcile</dt>
              <dd className="mt-1 font-semibold text-[var(--shell-text)]">
                {formatDateTime(startup?.finishedAt)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[28px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shell-accent)]">
            Operacao
          </p>

          <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--shell-muted)]">
            <li className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3">
              O Java cru fica fora do painel. Esta tela opera apenas os processos gerenciados pelo gateway.
            </li>
            <li className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3">
              O comando de desligar para o frontend pode deixar a rota <code>/servidor</code> indisponivel se a pagina for recarregada antes do start seguinte.
            </li>
            <li className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3">
              O source of truth da tela e o gateway em <code>/api/v1/admin/services/overview</code>, nao a leitura manual dos arquivos <code>.pid</code>.
            </li>
          </ul>
        </section>

        <section className="rounded-[28px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shell-accent)]">
            Acao em andamento
          </p>

          <div className="mt-4 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-4">
            <p className="text-sm font-semibold text-[var(--shell-text)]">
              {actionState ? actionState.label : "Nenhuma rotina em execucao"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--shell-muted)]">
              {actionState
                ? `Etapa ${actionState.step} de ${actionState.total}.`
                : "O painel atualiza o overview automaticamente a cada 5 segundos."}
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}

export default function ServerManagerView() {
  return <ServerManagerDashboard />;
}
