"use client";

import { useId, useState } from "react";
import { ExtratorActionButton as ActionButton } from "@/features/extrator-manager/ui/ExtratorPageShell";
import { buildDefaultPeriodState } from "@/features/extrator-manager/lib/extratorPeriod";

function normalizeFilterText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeOption(option) {
  if (typeof option === "string") {
    return { id: option, label: option };
  }

  return {
    id: String(option?.id ?? option?.value ?? ""),
    label: String(option?.label ?? option?.id ?? option?.value ?? ""),
  };
}

function getOptionLabel(options, value, fallback = "") {
  const normalizedValue = String(value ?? "");
  return (
    (options || [])
      .map(normalizeOption)
      .find((option) => option.id === normalizedValue)?.label ||
    fallback ||
    normalizedValue
  );
}

export function ChevronIcon({ expanded = false }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-4 w-4 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
      fill="none"
    >
      <path
        d="M5 7.5 10 12.5 15 7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function FormField({ children, label, hint }) {
  return (
    <label className="space-y-2">
      <span className="block text-sm font-semibold text-[var(--shell-text)]">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="block text-xs leading-5 text-[var(--shell-muted)]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-strong)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none transition placeholder:text-[var(--shell-muted)] focus:border-[color:var(--shell-accent)] ${props.className || ""}`}
    />
  );
}

export function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-strong)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none transition placeholder:text-[var(--shell-muted)] focus:border-[color:var(--shell-accent)] ${props.className || ""}`}
    />
  );
}

export function SelectInput({ children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-strong)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none transition focus:border-[color:var(--shell-accent)] ${props.className || ""}`}
    >
      {children}
    </select>
  );
}

export function CheckboxField({ checked, label, onChange }) {
  return (
    <label className="inline-flex items-center gap-3 text-sm font-semibold text-[var(--shell-text)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-[color:var(--shell-line)] text-[var(--shell-accent)]"
      />
      {label}
    </label>
  );
}

export function SearchableSelect({
  disabled = false,
  onChange,
  options,
  placeholder = "Pesquisar",
  sideAction = null,
  value,
}) {
  const normalizedOptions = (options || []).map(normalizeOption);
  const selectedLabel = getOptionLabel(normalizedOptions, value, "");
  const valueKey = String(value ?? "");
  const [inputState, setInputState] = useState({
    query: selectedLabel,
    valueKey,
  });
  const [isOpen, setIsOpen] = useState(false);
  const listboxId = useId();
  const query = inputState.valueKey === valueKey ? inputState.query : selectedLabel;

  const normalizedQuery = normalizeFilterText(query);
  const visibleOptions = normalizedQuery
    ? normalizedOptions.filter((option) =>
        normalizeFilterText(`${option.label} ${option.id}`).includes(
          normalizedQuery,
        ),
      )
    : normalizedOptions;

  return (
    <div className="relative">
      <div
        className={`flex rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-strong)] transition focus-within:border-[color:var(--shell-accent)] ${
          disabled ? "opacity-75" : ""
        }`}
      >
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setInputState({
              query: event.target.value,
              valueKey,
            });
            setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) {
              setIsOpen(true);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setIsOpen(false);
              setInputState({
                query: getOptionLabel(normalizedOptions, value, ""),
                valueKey,
              });
            }, 120);
          }}
          onKeyDown={(event) => {
            if (disabled) {
              return;
            }

            if (event.key === "Escape") {
              setIsOpen(false);
              setInputState({
                query: selectedLabel,
                valueKey,
              });
            }

            if (event.key === "Enter" && visibleOptions[0]) {
              event.preventDefault();
              onChange(visibleOptions[0].id);
              setInputState({
                query: visibleOptions[0].label,
                valueKey: visibleOptions[0].id,
              });
              setIsOpen(false);
            }
          }}
          placeholder={placeholder}
          readOnly={disabled}
          className="min-w-0 flex-1 rounded-l-2xl bg-transparent px-4 py-3 text-sm text-[var(--shell-text)] outline-none placeholder:text-[var(--shell-muted)]"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={isOpen}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen((current) => !current)}
          className="flex h-auto w-10 items-center justify-center text-sm font-semibold text-[var(--shell-muted)] transition hover:text-[var(--shell-text)] disabled:cursor-not-allowed"
          aria-label="Abrir opcoes"
        >
          v
        </button>
        {sideAction}
      </div>

      {isOpen && !disabled ? (
        <div
          id={listboxId}
          className="shell-scrollbar absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-72 overflow-auto rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.32)]"
          role="listbox"
        >
          {visibleOptions.length ? (
            visibleOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.id);
                  setInputState({
                    query: option.label,
                    valueKey: option.id,
                  });
                  setIsOpen(false);
                }}
                className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                  option.id === String(value ?? "")
                    ? "bg-[var(--shell-accent-soft)] text-[var(--shell-accent)]"
                    : "text-[var(--shell-text)] hover:bg-[var(--shell-surface-muted)]"
                }`}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[color:var(--shell-line)] px-3 py-4 text-sm text-[var(--shell-muted)]">
              Nenhuma opcao encontrada.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function StatusPill({ label, note, tone = "default", value }) {
  const toneClass =
    tone === "accent"
      ? "text-[var(--shell-accent)]"
      : tone === "danger"
        ? "text-[var(--shell-danger)]"
        : "text-[var(--shell-text)]";

  return (
    <div className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--shell-muted)]">
        {label}
      </p>
      <p className={`mt-2 text-lg font-semibold ${toneClass}`}>{value}</p>
      {note ? (
        <p className="mt-1 text-xs leading-5 text-[var(--shell-muted)]">{note}</p>
      ) : null}
    </div>
  );
}

export function ModalFrame({
  children,
  closeOnBackdrop = true,
  headerActions = null,
  maxWidth = "max-w-3xl",
  onClose,
  title,
  subtitle,
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-auto bg-[var(--shell-overlay)] px-4 py-8 backdrop-blur-md"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`w-full ${maxWidth} rounded-[24px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.38)] sm:p-6`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--shell-text)]">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-2 text-sm leading-7 text-[var(--shell-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {headerActions}
            <ActionButton onClick={onClose}>Fechar</ActionButton>
          </div>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function PasswordActionModal({
  config,
  error,
  inputRef,
  onChange,
  onClose,
  onSubmit,
  submitting,
  value,
}) {
  if (!config?.isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[var(--shell-overlay)] px-4 py-6 backdrop-blur-md"
      onClick={submitting ? undefined : onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-[24px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.38)] sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--shell-text)]">
              {config.title || "Confirmar acao"}
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--shell-muted)]">
              {config.subtitle || "Informe a senha para continuar."}
            </p>
          </div>
          <ActionButton disabled={submitting} onClick={onClose}>
            Fechar
          </ActionButton>
        </div>

        <div className="mt-5">
          <FormField label={config.label || "Senha"}>
            <input
              ref={inputRef}
              type="password"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              placeholder={config.placeholder || "Obrigatoria para continuar"}
              className="w-full rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-strong)] px-4 py-3 text-sm text-[var(--shell-text)] outline-none transition placeholder:text-[var(--shell-muted)] focus:border-[color:var(--shell-accent)]"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onSubmit();
                }
              }}
            />
          </FormField>

          {error ? (
            <div className="mt-4 rounded-2xl border border-[color:var(--shell-danger)] bg-[var(--shell-danger-bg)] px-4 py-3 text-sm text-[var(--shell-danger)]">
              {error}
            </div>
          ) : null}

          <div className="mt-5">
            <ActionButton
              disabled={submitting}
              onClick={() => void onSubmit()}
              tone="danger"
            >
              {submitting ? "Confirmando..." : config.submitLabel || "Confirmar"}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BeesVerificationModal({
  code,
  error,
  inputRef,
  isOpen,
  onChange,
  onClose,
  onSubmit,
  status,
  submitting,
}) {
  if (!isOpen) {
    return null;
  }

  const recoverable = Boolean(status?.recoverable);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[var(--shell-overlay)] px-4 py-6 backdrop-blur-md"
      onClick={submitting ? undefined : onClose}
      role="presentation"
    >
      <div
        aria-labelledby="bees-verification-title"
        aria-modal="true"
        className="w-full max-w-[520px] rounded-[24px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-5 shadow-[0_28px_80px_rgba(0,0,0,0.38)] sm:p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shell-accent)]">
              Autenticacao Bees
            </p>
            <h2
              id="bees-verification-title"
              className="mt-2 text-2xl font-semibold text-[var(--shell-text)]"
            >
              Codigo enviado por e-mail
            </h2>
            <p className="mt-2 text-sm leading-7 text-[var(--shell-muted)]">
              O Bees enviou um codigo para o e-mail principal da conta. Esta e a
              mesma tentativa de login iniciada pelo report; usuario e senha nao
              serao enviados novamente.
            </p>
          </div>
          <ActionButton disabled={submitting} onClick={onClose}>
            Fechar
          </ActionButton>
        </div>

        <div className="mt-5 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--shell-muted)]">
          {status?.message || "A tentativa permanece aguardando o codigo."}
          {status?.created_at ? (
            <span className="mt-1 block text-xs">
              Tentativa iniciada em {status.created_at}.
            </span>
          ) : null}
        </div>

        {recoverable ? (
          <div className="mt-5">
            <FormField label="Codigo de verificacao">
              <input
                ref={inputRef}
                autoComplete="one-time-code"
                autoFocus
                inputMode="numeric"
                maxLength={32}
                type="text"
                value={code}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Informe o codigo recebido"
                className="w-full rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-strong)] px-4 py-3 text-sm tracking-[0.12em] text-[var(--shell-text)] outline-none transition placeholder:tracking-normal placeholder:text-[var(--shell-muted)] focus:border-[color:var(--shell-accent)]"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void onSubmit();
                  }
                }}
              />
            </FormField>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-[color:var(--shell-danger)] bg-[var(--shell-danger-bg)] px-4 py-3 text-sm leading-6 text-[var(--shell-danger)]">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          {recoverable ? (
            <ActionButton
              disabled={submitting || !String(code || "").trim()}
              onClick={() => void onSubmit()}
              tone="accent"
            >
              {submitting ? "Validando codigo..." : "Concluir login"}
            </ActionButton>
          ) : null}
          <ActionButton disabled={submitting} onClick={onClose}>
            Cancelar
          </ActionButton>
        </div>

        <p className="mt-4 text-xs leading-5 text-[var(--shell-muted)]">
          Fechar este modal nao cancela a tentativa. Enquanto ela estiver
          pendente, novas rotinas Bees permanecem bloqueadas sem repetir o login.
        </p>
      </div>
    </div>
  );
}

export function PeriodInputs({
  base,
  onChange,
  periodMeta,
  showBase = true,
  state,
}) {
  if (!periodMeta) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--shell-line)] px-4 py-4 text-sm text-[var(--shell-muted)]">
        Selecione uma rotina valida para escolher o periodo.
      </div>
    );
  }

  const periodPreset = periodMeta.presets?.[state.periodType] || {};
  const modeOptions = periodPreset.opcoes || [];

  return (
    <div
      className={`grid gap-4 md:grid-cols-2 ${showBase ? "xl:grid-cols-3" : "xl:grid-cols-2"}`}
    >
      {showBase ? (
        <FormField label="Rotina">
          <TextInput value={base} disabled />
        </FormField>
      ) : null}

      <FormField label="Periodo">
        <SelectInput
          value={state.periodType}
          onChange={(event) =>
            onChange((currentState) => ({
              ...buildDefaultPeriodState({
                padrao: event.target.value,
                presets: periodMeta.presets,
                opcoes: periodMeta.opcoes,
              }),
              periodType: event.target.value,
            }))
          }
        >
          {(periodMeta.opcoes || []).map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FormField>

      <FormField label="Modo de calculo">
        <SelectInput
          value={state.periodMode}
          onChange={(event) =>
            onChange((currentState) => ({
              ...currentState,
              periodMode: event.target.value,
            }))
          }
        >
          {modeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </FormField>

      {state.periodMode === "ano_referencia" ? (
        <FormField label="Ano de referencia">
          <TextInput
            type="number"
            min="1"
            max="9999"
            step="1"
            placeholder="2026"
            value={state.yearReference}
            onChange={(event) =>
              onChange({ yearReference: event.target.value })
            }
          />
        </FormField>
      ) : null}

      {state.periodMode === "mes_referencia" ? (
        <FormField label="Mes de referencia">
          <TextInput
            type="month"
            value={state.monthReference}
            onChange={(event) =>
              onChange({ monthReference: event.target.value })
            }
          />
        </FormField>
      ) : null}

      {state.periodMode === "data_especifica" ? (
        <FormField label="Data">
          <TextInput
            type="date"
            value={state.date}
            onChange={(event) => onChange({ date: event.target.value })}
          />
        </FormField>
      ) : null}

      {state.periodMode === "periodo_especifico" ? (
        <>
          <FormField label="Data inicial">
            <TextInput
              type="date"
              value={state.startDate}
              onChange={(event) =>
                onChange({ startDate: event.target.value })
              }
            />
          </FormField>
          <FormField label="Data final">
            <TextInput
              type="date"
              value={state.endDate}
              onChange={(event) => onChange({ endDate: event.target.value })}
            />
          </FormField>
        </>
      ) : null}
    </div>
  );
}

export function RuleSummaryList({ children, emptyMessage }) {
  if (!children || (Array.isArray(children) && !children.length)) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--shell-line)] px-4 py-5 text-sm text-[var(--shell-muted)]">
        {emptyMessage}
      </div>
    );
  }

  return <div className="space-y-3">{children}</div>;
}
