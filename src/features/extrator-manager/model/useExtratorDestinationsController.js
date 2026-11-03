"use client";

import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/features/extrator-manager/model/useDebouncedValue";
import { extratorApi } from "@/features/extrator-manager/api/extratorApi";
import {
  buildDestinationDefaultForm,
  buildDestinationFormFromRule,
  DEFAULT_DESTINATION_FILTERS,
  serializeDestinationForm,
  normalizeDestinationListeners,
} from "@/features/extrator-manager/lib/extratorDestinations";
import { formatDateTime } from "@/features/extrator-manager/lib/extratorFormat";
import {
  FILTER_ALL_VALUE,
  formatCountLabel,
  toBooleanLabel,
} from "@/features/extrator-manager/lib/extratorOptions";
import { buildHistoryRefreshOptions } from "@/features/extrator-manager/lib/extratorOperations";

export function useExtratorDestinationsController({
  active,
  clientHistoryPayload,
  destinationsPayload,
  loadDestinations,
  loadingAction,
  openPasswordAction,
  runAction,
  status,
}) {
  const [formDraft, setFormDraft] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_DESTINATION_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const debouncedFilters = useDebouncedValue(filters);
  const destinationMeta = destinationsPayload?.destination_meta || null;
  const defaultForm = destinationMeta
    ? buildDestinationDefaultForm(destinationMeta)
    : null;
  const formCandidate = formDraft || defaultForm;
  const listenOptions =
    destinationMeta?.listen_period_options_by_base?.[formCandidate?.base] || [];
  const form = formCandidate
    ? normalizeDestinationListeners(formCandidate, destinationMeta)
    : null;
  const hasPayload = Boolean(destinationsPayload);

  useEffect(() => {
    if (!active || !hasPayload) {
      return;
    }
    void loadDestinations({
      page,
      pageSize,
      filters: debouncedFilters,
    }).catch(() => {});
  }, [active, debouncedFilters, hasPayload, loadDestinations, page, pageSize]);

  function setForm(nextValue) {
    setFormDraft((currentDraft) => {
      const currentForm = currentDraft || defaultForm;
      if (!currentForm) {
        return currentDraft;
      }
      const draftUpdate =
        typeof nextValue === "function" ? nextValue(currentForm) : nextValue;
      const mergedForm = { ...currentForm, ...(draftUpdate || {}) };
      return normalizeDestinationListeners(mergedForm, destinationMeta);
    });
  }

  function openCreateModal() {
    setForm(buildDestinationDefaultForm(destinationMeta));
    setIsModalOpen(true);
  }

  function openEditModal(rule) {
    setForm(buildDestinationFormFromRule(rule));
    setIsModalOpen(true);
  }

  function resetFilters() {
    setPage(1);
    setFilters(DEFAULT_DESTINATION_FILTERS);
  }

  function updateFilters(updater) {
    setPage(1);
    setFilters(updater);
  }

  async function handleSaveRule() {
    openPasswordAction({
      title: form.id ? "Atualizar destino" : "Salvar destino",
      subtitle: form.id
        ? `Informe a senha cadastrada para atualizar o destino '${form.nome || form.base}'.`
        : `Defina a senha que vai proteger o destino '${form.nome || form.base}'.`,
      label: "Senha do destino",
      placeholder: form.id
        ? "Obrigatoria para alterar o destino"
        : "Obrigatoria para salvar o destino",
      submitLabel: form.id ? "Salvar alteracao" : "Salvar destino",
      requiredMessage: "Informe a senha do destino antes de salvar.",
      run: async (password) => {
        await runAction(
          "salvar destino",
          () =>
            extratorApi.saveDestinationRule(
              serializeDestinationForm(form, password),
            ),
          buildHistoryRefreshOptions(clientHistoryPayload),
        );
        setForm(buildDestinationDefaultForm(destinationMeta));
        setIsModalOpen(false);
      },
    });
  }

  async function handleDeleteRule(ruleId) {
    const rule = (destinationsPayload?.rules || []).find(
      (item) => item.id === ruleId,
    );
    openPasswordAction({
      title: "Remover destino personalizado",
      subtitle: `Informe a senha cadastrada para remover o destino '${rule?.nome || rule?.base || ruleId}'.`,
      label: "Senha do destino",
      placeholder: "Obrigatoria para remover o destino",
      submitLabel: "Remover destino",
      requiredMessage: "Informe a senha desta regra antes de remover o destino.",
      run: async (password) => {
        await runAction(
          "excluir destino",
          () => extratorApi.deleteDestinationRule({ id: ruleId, senha: password }),
          buildHistoryRefreshOptions(clientHistoryPayload),
        );
      },
    });
  }

  const ownerFilterOptions = [
    { id: FILTER_ALL_VALUE, label: "Todos os criadores" },
    ...(destinationMeta?.owner_options || []),
  ];
  const baseFilterOptions = [
    { id: FILTER_ALL_VALUE, label: "Todas as rotinas" },
    ...(destinationMeta?.base_options || []),
  ];
  const periodFilterOptions = [
    { id: FILTER_ALL_VALUE, label: "Todas as atualizacoes" },
    ...(destinationMeta?.period_filter_options || []),
  ];
  const sourceFilterOptions = [
    { id: FILTER_ALL_VALUE, label: "Todas as origens" },
    { id: "interface", label: "Criado na interface" },
    { id: "sql", label: "Migrado do SQL" },
  ];

  return {
    isReady: Boolean(form),
    sectionProps: {
      destinationBaseFilterOptions: baseFilterOptions,
      destinationFilters: filters,
      destinationForm: form,
      destinationGroups: destinationsPayload?.groups || [],
      destinationOwnerFilterOptions: ownerFilterOptions,
      destinationPagination: destinationsPayload?.pagination,
      destinationPeriodFilterOptions: periodFilterOptions,
      destinationSourceFilterOptions: sourceFilterOptions,
      destinationsPayload,
      filterAllValue: FILTER_ALL_VALUE,
      formatCountLabel,
      formatDateTime,
      handleDeleteDestinationRule: handleDeleteRule,
      handleSaveDestinationRule: handleSaveRule,
      isDestinationHelpOpen: isHelpOpen,
      isDestinationModalOpen: isModalOpen,
      loadingAction,
      openDestinationCreateModal: openCreateModal,
      openDestinationEditModal: openEditModal,
      onRefresh: () =>
        loadDestinations({ page, pageSize, filters: debouncedFilters }),
      resetDestinationFilters: resetFilters,
      selectedDestinationListenOptions: listenOptions,
      setDestinationFilters: updateFilters,
      setDestinationForm: setForm,
      setDestinationPage: setPage,
      setDestinationPageSize: (nextPageSize) => {
        setPage(1);
        setPageSize(nextPageSize);
      },
      setIsDestinationHelpOpen: setIsHelpOpen,
      setIsDestinationModalOpen: setIsModalOpen,
      status,
      toBooleanLabel,
    },
  };
}
