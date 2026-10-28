"use client";

import { Fragment, useId, useRef, useState } from "react";
import { ChevronDown, CircleHelp } from "lucide-react";
import {
  CheckboxField,
  FormField,
  ModalFrame,
  RuleSummaryList,
  SearchableSelect,
  SelectInput,
  TextInput,
} from "@/features/extrator-manager/ui/ExtratorManagerControls";
import { ExtratorPagination } from "@/features/extrator-manager/ui/ExtratorPagination";
import ExtratorDestinationPreview from "@/features/extrator-manager/ui/ExtratorDestinationPreview";
import {
  ExtratorActionButton as ActionButton,
  ExtratorSectionCard as SectionCard,
} from "@/features/extrator-manager/ui/ExtratorPageShell";
import { usePaginatedItems } from "@/features/extrator-manager/model/usePaginatedItems";

const DESTINATION_TEMPLATE_KINDS = [
  {
    fileField: "arquivoTemplateAnual",
    fileLabel: "Arquivo anual",
    folderField: "pastaTemplateAnual",
    folderLabel: "Pasta anual",
    label: "Anual",
    templateKey: "anual",
  },
  {
    fileField: "arquivoTemplateMensal",
    fileLabel: "Arquivo mensal",
    folderField: "pastaTemplateMensal",
    folderLabel: "Pasta mensal",
    label: "Mensal",
    templateKey: "mensal",
  },
  {
    fileField: "arquivoTemplateDiario",
    fileLabel: "Arquivo diario",
    folderField: "pastaTemplateDiario",
    folderLabel: "Pasta diaria",
    label: "Diario",
    templateKey: "diario",
  },
  {
    fileField: "arquivoTemplatePeriodo",
    fileLabel: "Arquivo por periodo",
    folderField: "pastaTemplatePeriodo",
    folderLabel: "Pasta por periodo",
    label: "Periodo",
    templateKey: "periodo",
  },
  {
    fileField: "arquivoTemplateSemPeriodo",
    fileLabel: "Arquivo sem periodo",
    folderField: "pastaTemplateSemPeriodo",
    folderLabel: "Pasta sem periodo",
    label: "Sem periodo",
    templateKey: "sem_periodo",
  },
];

const LISTEN_PERIOD_TEMPLATE_KEY = {
  anual: "anual",
  mensal: "mensal",
  data_dia_especifico: "diario",
  diario: "diario",
  periodo_especifico: "periodo",
  periodo: "periodo",
  sem_periodo: "sem_periodo",
};

function normalizeTokenSearch(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getVisibleTemplateKinds(listenPeriodType) {
  if (!listenPeriodType || listenPeriodType === "todos") {
    return DESTINATION_TEMPLATE_KINDS;
  }

  const templateKey = LISTEN_PERIOD_TEMPLATE_KEY[listenPeriodType];
  if (!templateKey) {
    return DESTINATION_TEMPLATE_KINDS;
  }

  return DESTINATION_TEMPLATE_KINDS.filter(
    (templateKind) => templateKind.templateKey === templateKey,
  );
}

function DestinationListenModeFields({
  form,
  modeOptions,
  setForm,
}) {
  if (form.listenPeriodType === "todos" || !modeOptions.length) {
    return null;
  }

  const selectedModes = form.listenPeriodModes || [];
  const listensAnyMode = selectedModes.length === 0;

  function toggleSpecificMode(modeId, checked) {
    setForm((currentForm) => {
      const currentModes = currentForm.listenPeriodModes || [];
      const nextModes = checked
        ? [...new Set([...currentModes, modeId])]
        : currentModes.filter((item) => item !== modeId);

      return {
        ...currentForm,
        listenPeriodModes: nextModes,
      };
    });
  }

  return (
    <div className="md:col-span-2 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] p-4">
      <p className="text-sm font-semibold text-[var(--shell-text)]">
        Modos de calculo aceitos
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--shell-muted)]">
        Deixe qualquer modo marcado para manter uma escuta ampla, ou selecione
        somente os modos que devem acionar este destino.
      </p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
        <CheckboxField
          checked={listensAnyMode}
          label="Qualquer modo de calculo"
          onChange={(event) =>
            setForm((currentForm) => ({
              ...currentForm,
              listenPeriodModes: event.target.checked
                ? []
                : [modeOptions[0]?.id].filter(Boolean),
            }))
          }
        />
        {modeOptions.map((option) => (
          <CheckboxField
            key={option.id}
            checked={selectedModes.includes(option.id)}
            label={option.label}
            onChange={(event) =>
              toggleSpecificMode(option.id, event.target.checked)
            }
          />
        ))}
      </div>
    </div>
  );
}

function TemplateTokenInput({ label, onChange, tokens, value }) {
  const inputId = useId();
  const listboxId = useId();
  const inputRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [search, setSearch] = useState(null);
  const normalizedQuery = normalizeTokenSearch(search?.query);
  const filteredTokens = (tokens || []).filter((token) => {
    if (!normalizedQuery) {
      return true;
    }

    return normalizeTokenSearch(`${token.id} ${token.label}`).includes(
      normalizedQuery,
    );
  });

  function syncSearch(nextValue, caretPosition) {
    const beforeCaret = String(nextValue).slice(0, caretPosition);
    const openingBraceIndex = beforeCaret.lastIndexOf("{");
    const closingBraceIndex = beforeCaret.lastIndexOf("}");

    if (openingBraceIndex <= closingBraceIndex) {
      setSearch(null);
      return;
    }

    setSearch({
      end: caretPosition,
      query: beforeCaret.slice(openingBraceIndex + 1),
      start: openingBraceIndex,
    });
    setActiveIndex(0);
  }

  function handleChange(event) {
    const nextValue = event.target.value;
    onChange(nextValue);
    syncSearch(nextValue, event.target.selectionStart ?? nextValue.length);
  }

  function insertToken(token) {
    if (!search) {
      return;
    }

    const nextValue = `${value.slice(0, search.start)}{${token.id}}${value.slice(search.end)}`;
    const nextCaretPosition = search.start + token.id.length + 2;
    onChange(nextValue);
    setSearch(null);

    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  }

  function handleKeyDown(event) {
    if (!search) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setSearch(null);
      return;
    }

    if (!filteredTokens.length) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % filteredTokens.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (current) => (current - 1 + filteredTokens.length) % filteredTokens.length,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      insertToken(filteredTokens[activeIndex] || filteredTokens[0]);
    }
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className="block text-sm font-semibold text-[var(--shell-text)]"
      >
        {label}
      </label>
      <div className="relative">
        <TextInput
          ref={inputRef}
          id={inputId}
          value={value}
          onBlur={() => setSearch(null)}
          onChange={handleChange}
          onClick={(event) =>
            syncSearch(
              event.currentTarget.value,
              event.currentTarget.selectionStart ?? event.currentTarget.value.length,
            )
          }
          onKeyDown={handleKeyDown}
          onKeyUp={(event) => {
            if (
              ["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)
            ) {
              return;
            }
            syncSearch(
              event.currentTarget.value,
              event.currentTarget.selectionStart ?? event.currentTarget.value.length,
            );
          }}
          aria-autocomplete="list"
          aria-controls={search ? listboxId : undefined}
          aria-expanded={Boolean(search)}
          aria-activedescendant={
            search && filteredTokens[activeIndex]
              ? `${listboxId}-${filteredTokens[activeIndex].id}`
              : undefined
          }
          role="combobox"
        />
        {search ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-72 overflow-y-auto rounded-2xl border border-[color:var(--shell-line-strong)] bg-[var(--shell-surface)] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.34)]"
          >
            {filteredTokens.length ? (
              filteredTokens.map((token, index) => (
                <button
                  key={token.id}
                  id={`${listboxId}-${token.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    insertToken(token);
                  }}
                  className={`flex w-full items-start justify-between gap-4 rounded-xl px-3 py-2 text-left transition ${
                    index === activeIndex
                      ? "bg-[var(--shell-accent-soft)]"
                      : "hover:bg-[var(--shell-surface-muted)]"
                  }`}
                >
                  <span>
                    <span className="block font-mono text-sm font-semibold text-[var(--shell-text)]">
                      {`{${token.id}}`}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--shell-muted)]">
                      {token.label}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-[var(--shell-muted)]">
                    {token.example || "-"}
                  </span>
                </button>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[color:var(--shell-line)] px-3 py-4 text-sm text-[var(--shell-muted)]">
                Nenhum token encontrado para &quot;{search.query}&quot;.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DestinationRoutineGroup({
  formatDateTime,
  group,
  handleDeleteDestinationRule,
  openDestinationEditModal,
  toBooleanLabel,
}) {
  const pagination = usePaginatedItems(group?.items || [], 5);

  return (
    <details className="group rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-strong)]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shell-accent)]">
            Rotina
          </p>
          <h4 className="mt-1 text-lg font-semibold text-[var(--shell-text)]">
            {group.label}
          </h4>
          <p className="mt-1 text-sm text-[var(--shell-muted)]">
            {group.item_count || group.items?.length || 0} regra(s) de destino
          </p>
        </div>
        <ChevronDown
          aria-hidden="true"
          className="mt-1 h-5 w-5 shrink-0 text-[var(--shell-muted)] transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="space-y-3 px-4 pb-4">
        {pagination.items.map((rule) => (
          <div
            key={rule.id}
            className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--shell-text)]">
                  {rule.listen_period_label}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--shell-muted)]">
                  {toBooleanLabel(rule.enabled)}
                </p>
                <p className="mt-1 text-xs text-[var(--shell-muted)]">
                  {rule.listen_period_mode_label || "Qualquer modo de calculo"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton onClick={() => openDestinationEditModal(rule)}>
                  Carregar para editar
                </ActionButton>
                <ActionButton
                  onClick={() => void handleDeleteDestinationRule(rule.id)}
                  tone="danger"
                >
                  Excluir
                </ActionButton>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[var(--shell-muted)]">
              {rule.caminho}
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--shell-muted)]">
              Atualizado em {formatDateTime(rule.updated_at)}
            </p>
          </div>
        ))}
      </div>

      {pagination.totalPages > 1 ? (
        <div className="mx-4 mb-4">
          <ExtratorPagination
            itemLabel="regras"
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            showPageSize={false}
          />
        </div>
      ) : null}
    </details>
  );
}

function DestinationOwnerGroup({
  formatDateTime,
  group,
  handleDeleteDestinationRule,
  openDestinationEditModal,
  toBooleanLabel,
}) {
  const pagination = usePaginatedItems(group?.routine_groups || [], 5);

  return (
    <details className="group rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shell-accent)]">
        Responsavel
      </p>
      <h3 className="mt-1 text-xl font-semibold text-[var(--shell-text)]">
        {group.label}
      </h3>
      <p className="mt-1 text-sm text-[var(--shell-muted)]">
        {group.routine_count || 0} rotina(s) · {group.rule_count || 0} regra(s)
      </p>

        </div>
        <ChevronDown
          aria-hidden="true"
          className="mt-1 h-5 w-5 shrink-0 text-[var(--shell-muted)] transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="space-y-3 px-4 pb-4">
        {pagination.items.map((routineGroup) => (
          <DestinationRoutineGroup
            key={routineGroup.id}
            formatDateTime={formatDateTime}
            group={routineGroup}
            handleDeleteDestinationRule={handleDeleteDestinationRule}
            openDestinationEditModal={openDestinationEditModal}
            toBooleanLabel={toBooleanLabel}
          />
        ))}
      </div>

      {pagination.totalPages > 1 ? (
        <div className="mx-4 mb-4">
          <ExtratorPagination
            itemLabel="rotinas"
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            showPageSize={false}
          />
        </div>
      ) : null}
    </details>
  );
}

export default function ExtratorDestinationsSection({
  destinationBaseFilterOptions,
  destinationForm,
  destinationGroups,
  destinationOwnerFilterOptions,
  destinationPeriodFilterOptions,
  destinationSourceFilterOptions,
  destinationFilters,
  destinationPagination,
  destinationsPayload,
  filterAllValue,
  formatCountLabel,
  formatDateTime,
  handleDeleteDestinationRule,
  handleSaveDestinationRule,
  isDestinationHelpOpen,
  isDestinationModalOpen,
  loadingAction,
  openDestinationCreateModal,
  openDestinationEditModal,
  onRefresh,
  resetDestinationFilters,
  selectedDestinationListenOptions,
  setDestinationFilters,
  setDestinationForm,
  setDestinationPage,
  setDestinationPageSize,
  setIsDestinationHelpOpen,
  setIsDestinationModalOpen,
  status,
  toBooleanLabel,
}) {
  const templateTokenOptions =
    destinationsPayload?.destination_meta?.template_token_options || [];
  const visibleTemplateKinds = getVisibleTemplateKinds(
    destinationForm.listenPeriodType,
  );
  const selectedListenModeOptions =
    destinationsPayload?.destination_meta
      ?.listen_period_mode_options_by_base?.[destinationForm.base]?.[
        destinationForm.listenPeriodType
      ] || [];

  return (
          <div className="space-y-4">
            {isDestinationModalOpen ? (
              <ModalFrame
                title={destinationForm.id ? "Editar destino" : "Novo destino"}
                subtitle="Defina o caminho base e monte nome/pasta final com templates por periodo."
                onClose={() => setIsDestinationModalOpen(false)}
                closeOnBackdrop={false}
                headerActions={
                  <ActionButton onClick={() => setIsDestinationHelpOpen(true)}>
                    <span className="inline-flex items-center gap-2">
                      <CircleHelp aria-hidden="true" className="h-4 w-4" />
                      Ajuda
                    </span>
                  </ActionButton>
                }
                maxWidth="max-w-6xl"
              >
            <SectionCard
              eyebrow="Destinos"
              title="Novo destino ou edicao"
              actions={
                <>
                  <ActionButton
                    onClick={() => void handleSaveDestinationRule()}
                    disabled={Boolean(loadingAction)}
                    tone="accent"
                  >
                    {destinationForm.id ? "Atualizar destino" : "Salvar destino"}
                  </ActionButton>
                  <ActionButton
                    onClick={() => openDestinationCreateModal()}
                  >
                    Limpar
                  </ActionButton>
                </>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Rotina">
                  <SearchableSelect
                    value={destinationForm.base}
                    onChange={(value) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        base: value,
                        listenPeriodType:
                          destinationsPayload?.destination_meta
                            ?.listen_period_options_by_base?.[
                            value
                          ]?.[0]?.id || "todos",
                        listenPeriodModes: [],
                      }))
                    }
                    options={destinationsPayload?.destination_meta?.base_options || []}
                    placeholder="Busque a rotina"
                  />
                </FormField>
                <FormField label="Responsavel">
                  <TextInput
                    value={destinationForm.nome}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        nome: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label="Escuta de periodo">
                  <SelectInput
                    value={destinationForm.listenPeriodType}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        listenPeriodType: event.target.value,
                        listenPeriodModes: [],
                      }))
                    }
                  >
                    {selectedDestinationListenOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <DestinationListenModeFields
                  form={destinationForm}
                  modeOptions={selectedListenModeOptions}
                  setForm={setDestinationForm}
                />
                <div className="md:col-span-2">
                  <FormField label="Caminho base">
                    <TextInput
                      value={destinationForm.caminho}
                      onChange={(event) =>
                        setDestinationForm((currentForm) => ({
                          ...currentForm,
                          caminho: event.target.value,
                        }))
                      }
                      placeholder="Ex.: D:\\Relatorios\\Promax\\03_11_40"
                    />
                  </FormField>
                </div>
                <FormField label="Extensao do arquivo">
                  <TextInput
                    value={destinationForm.extensaoArquivo}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        extensaoArquivo: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label="Separador do nome">
                  <SelectInput
                    value={destinationForm.separator}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        separator: event.target.value,
                      }))
                    }
                  >
                    {(
                      destinationsPayload?.destination_meta?.separator_options || []
                    ).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Separador da rotina">
                  <TextInput
                    value={destinationForm.rotinaSeparador}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        rotinaSeparador: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label="Formato do mes">
                  <SelectInput
                    value={destinationForm.mesFormato}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        mesFormato: event.target.value,
                      }))
                    }
                  >
                    {(
                      destinationsPayload?.destination_meta?.mes_formato_options ||
                      []
                    ).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Caixa do mes">
                  <SelectInput
                    value={destinationForm.mesCaixa}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        mesCaixa: event.target.value,
                      }))
                    }
                  >
                    {(
                      destinationsPayload?.destination_meta?.mes_caixa_options || []
                    ).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Tamanho da abreviacao">
                  <TextInput
                    type="number"
                    min="1"
                    max="12"
                    value={destinationForm.mesAbreviacaoTamanho}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        mesAbreviacaoTamanho: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label="Ordem da data">
                  <SelectInput
                    value={destinationForm.dataOrdem}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        dataOrdem: event.target.value,
                      }))
                    }
                  >
                    {(
                      destinationsPayload?.destination_meta?.data_ordem_options || []
                    ).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </SelectInput>
                </FormField>
                <FormField label="Separador da data">
                  <TextInput
                    value={destinationForm.dataSeparador}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        dataSeparador: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <div className="md:col-span-2 flex flex-wrap gap-4">
                  <CheckboxField
                    checked={destinationForm.enabled}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        enabled: event.target.checked,
                      }))
                    }
                    label="Destino habilitado"
                  />
                  <CheckboxField
                    checked={destinationForm.includeRotina}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        includeRotina: event.target.checked,
                      }))
                    }
                    label="Incluir rotina no nome"
                  />
                  <CheckboxField
                    checked={destinationForm.stackPath}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        stackPath: event.target.checked,
                      }))
                    }
                    label="Empilhar pastas"
                  />
                  <CheckboxField
                    checked={destinationForm.mesSemAcento}
                    onChange={(event) =>
                      setDestinationForm((currentForm) => ({
                        ...currentForm,
                        mesSemAcento: event.target.checked,
                      }))
                    }
                    label="Mes sem acento"
                  />
                </div>

                <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                  {visibleTemplateKinds.map((templateKind) => (
                    <Fragment key={templateKind.templateKey}>
                      <TemplateTokenInput
                        label={templateKind.fileLabel}
                        value={destinationForm[templateKind.fileField]}
                        tokens={templateTokenOptions}
                        onChange={(value) =>
                          setDestinationForm((currentForm) => ({
                            ...currentForm,
                            [templateKind.fileField]: value,
                          }))
                        }
                      />
                      <FormField label={templateKind.folderLabel}>
                        <TextInput
                          value={destinationForm[templateKind.folderField]}
                          onChange={(event) =>
                            setDestinationForm((currentForm) => ({
                              ...currentForm,
                              [templateKind.folderField]: event.target.value,
                            }))
                          }
                        />
                      </FormField>
                    </Fragment>
                  ))}
                </div>

                <div className="md:col-span-2">
                  <ExtratorDestinationPreview
                    form={destinationForm}
                    templateKinds={visibleTemplateKinds}
                  />
                </div>
              </div>
            </SectionCard>
              </ModalFrame>
            ) : null}

            <SectionCard
              eyebrow="Destinos"
              title="Destinos salvos"
              actions={
                <>
                  <ActionButton
                    onClick={() => void onRefresh()}
                    disabled={status === "loading" || Boolean(loadingAction)}
                  >
                    Recarregar destinos
                  </ActionButton>
                  <ActionButton onClick={openDestinationCreateModal} tone="accent">
                    Novo destino
                  </ActionButton>
                </>
              }
            >
              <div className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] p-4">
                <p className="text-sm leading-7 text-[var(--shell-muted)]">
                  Pesquise por criador, rotina, caminho ou tipo de escuta antes
                  de carregar uma regra para edicao.
                </p>

                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <div className="min-w-[240px] flex-1">
                    <FormField label="Pesquisar">
                      <TextInput
                        value={destinationFilters.search}
                        onChange={(event) =>
                          setDestinationFilters((current) => ({
                            ...current,
                            search: event.target.value,
                          }))
                        }
                        placeholder="Busque por criador, rotina, caminho ou tipo de escuta"
                      />
                    </FormField>
                  </div>
                  <ActionButton onClick={resetDestinationFilters}>
                    Limpar filtros
                  </ActionButton>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <FormField label="Criador">
                    <SelectInput
                      value={destinationFilters.owner}
                      onChange={(event) =>
                        setDestinationFilters((current) => ({
                          ...current,
                          owner: event.target.value,
                        }))
                      }
                    >
                      {destinationOwnerFilterOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>
                  <FormField label="Rotina">
                    <SearchableSelect
                      value={destinationFilters.base}
                      onChange={(value) =>
                        setDestinationFilters((current) => ({
                          ...current,
                          base: value,
                        }))
                      }
                      options={destinationBaseFilterOptions}
                      placeholder="Todas as rotinas"
                    />
                  </FormField>
                  <FormField label="Atualizacao">
                    <SelectInput
                      value={destinationFilters.period}
                      onChange={(event) =>
                        setDestinationFilters((current) => ({
                          ...current,
                          period: event.target.value,
                        }))
                      }
                    >
                      {destinationPeriodFilterOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>
                  <FormField label="Status">
                    <SelectInput
                      value={destinationFilters.enabled}
                      onChange={(event) =>
                        setDestinationFilters((current) => ({
                          ...current,
                          enabled: event.target.value,
                        }))
                      }
                    >
                      <option value={filterAllValue}>Todos os status</option>
                      <option value="true">Ativos</option>
                      <option value="false">Pausados</option>
                    </SelectInput>
                  </FormField>
                  <FormField label="Origem">
                    <SelectInput
                      value={destinationFilters.source}
                      onChange={(event) =>
                        setDestinationFilters((current) => ({
                          ...current,
                          source: event.target.value,
                        }))
                      }
                    >
                      {destinationSourceFilterOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </SelectInput>
                  </FormField>
                </div>

                <div className="mt-4 text-sm text-[var(--shell-muted)]">
                  {(destinationPagination?.total_items || 0) > 0
                    ? `Exibindo ${formatCountLabel(destinationPagination.total_items, "responsavel", "responsaveis")} agrupados.`
                    : "Nenhum destino disponivel para filtrar."}
                </div>
              </div>

              <RuleSummaryList emptyMessage="Nenhum destino encontrou correspondencia com os filtros atuais.">
                {destinationGroups.map((group) => (
                  <DestinationOwnerGroup
                    key={group.id}
                    formatDateTime={formatDateTime}
                    group={group}
                    handleDeleteDestinationRule={handleDeleteDestinationRule}
                    openDestinationEditModal={openDestinationEditModal}
                    toBooleanLabel={toBooleanLabel}
                  />
                ))}
              </RuleSummaryList>

              <div className="mt-4">
                <ExtratorPagination
                  itemLabel="responsaveis"
                  page={destinationPagination?.page || 1}
                  pageSize={destinationPagination?.page_size || 10}
                  totalItems={destinationPagination?.total_items || 0}
                  totalPages={destinationPagination?.total_pages || 1}
                  onPageChange={setDestinationPage}
                  onPageSizeChange={setDestinationPageSize}
                />
              </div>
            </SectionCard>

            {isDestinationHelpOpen ? (
              <ModalFrame
                title="Tokens disponiveis"
                subtitle="Use os tokens nos templates de arquivo e pasta. A pre-visualizacao do destino atualiza conforme os campos mudam."
                onClose={() => setIsDestinationHelpOpen(false)}
                maxWidth="max-w-4xl"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {(destinationsPayload?.destination_meta?.template_token_options || []).map(
                    (token) => (
                      <div
                        key={token.id}
                        className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] p-4"
                      >
                        <p className="font-mono text-sm font-semibold text-[var(--shell-text)]">
                          {`{${token.id}}`}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[var(--shell-muted)]">
                          {token.label}
                        </p>
                        <p className="mt-2 text-xs text-[var(--shell-muted)]">
                          Exemplo: {token.example || "-"}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </ModalFrame>
            ) : null}
          </div>
  );
}
