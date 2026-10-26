"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormManagerConfig } from "@/features/dpo/model/formManagerConfig";
import { parseDtoDate } from "@/features/dpo/lib/dtoFormatters";
import type {
  DtoConfigurationUpdate,
  DtoFormConfiguration,
  DtoFormDetail,
  DtoFormReference,
  DtoFormResource,
  DtoFormResourceMap,
  DtoFormsResponse,
  DtoRefreshJob,
  DtoRefreshRequest,
} from "@/features/dpo/model/dtoTypes";

const DETAIL_CONCURRENCY = 3;
const REFRESH_CHECK_INTERVAL_MS = 2_000;
const REFRESH_MAX_CHECKS = 45;

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function waitForNextCheck(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Operação cancelada", "AbortError"));
      return;
    }
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, REFRESH_CHECK_INTERVAL_MS);
    const onAbort = () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Operação cancelada", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function createIdleResource(): DtoFormResource {
  return {
    status: "idle",
    data: null,
    error: null,
    isRefreshing: false,
  };
}

function validateFormsPayload(
  payload: DtoFormsResponse,
  singular: string,
  plural: string,
): DtoFormsResponse {
  if (!payload || !Array.isArray(payload.forms)) {
    throw new Error(`O serviço retornou uma lista de ${plural} inválida.`);
  }

  payload.forms.forEach((form) => {
    if (!form || !String(form.id ?? "").trim() || !String(form.name ?? "").trim()) {
      throw new Error(`Uma ${singular} descoberta não possui identificador ou nome válido.`);
    }
  });

  return {
    ...payload,
    count: Number.isFinite(Number(payload.count))
      ? Number(payload.count)
      : payload.forms.length,
    discovered_at: payload.discovered_at || null,
    cached: Boolean(payload.cached),
  };
}

function validateFormDetail(payload: DtoFormDetail, singular: string): DtoFormDetail {
  if (
    !payload ||
    !payload.form ||
    !Array.isArray(payload.columns) ||
    !Array.isArray(payload.records) ||
    !payload.configuration ||
    !Array.isArray(payload.configuration.fields)
  ) {
    throw new Error(`O serviço retornou dados inválidos para esta ${singular}.`);
  }

  return {
    ...payload,
    configuration: {
      ...payload.configuration,
      tracking: {
        mode: payload.configuration.tracking?.mode || "COLLABORATOR",
        environment_source:
          payload.configuration.tracking?.environment_source || "FIELD",
        collaborator_source:
          payload.configuration.tracking?.collaborator_source || null,
        roster_field_key: payload.configuration.tracking?.roster_field_key || null,
        realization_date_field_key:
          payload.configuration.tracking?.realization_date_field_key || null,
        interval_days: payload.configuration.tracking?.interval_days || null,
        applicable_functions:
          payload.configuration.tracking?.applicable_functions || [],
        applicant_employee_keys:
          payload.configuration.tracking?.applicant_employee_keys || [],
        excluded_employee_keys:
          payload.configuration.tracking?.excluded_employee_keys || [],
        new_employee_window_days:
          payload.configuration.tracking?.new_employee_window_days || null,
        new_employee_first_due_days:
          payload.configuration.tracking?.new_employee_first_due_days || null,
        excluded_collaborators:
          payload.configuration.tracking?.excluded_collaborators || [],
        manual_collaborators:
          payload.configuration.tracking?.manual_collaborators || [],
      },
    },
    quality_issues: Array.isArray(payload.quality_issues)
      ? payload.quality_issues
      : [],
    loaded_at: payload.loaded_at || null,
    cached: Boolean(payload.cached),
  };
}

export function useDtoForms() {
  const { api, plural, singular } = useFormManagerConfig();
  const [formsPayload, setFormsPayload] = useState<DtoFormsResponse | null>(null);
  const [resources, setResources] = useState<DtoFormResourceMap>({});
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshCompletedAt, setRefreshCompletedAt] = useState<string | null>(null);
  const formsPayloadRef = useRef<DtoFormsResponse | null>(null);
  const generationRef = useRef(0);
  const formRequestSequenceRef = useRef<Record<string, number>>({});
  const controllersRef = useRef(new Set<AbortController>());

  const createController = useCallback(() => {
    const controller = new AbortController();
    controllersRef.current.add(controller);
    return controller;
  }, []);

  const releaseController = useCallback((controller: AbortController) => {
    controllersRef.current.delete(controller);
  }, []);

  const abortPendingRequests = useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
  }, []);

  const loadFormDetail = useCallback(
    async (form: DtoFormReference, generation: number) => {
      const requestSequence =
        (formRequestSequenceRef.current[form.id] || 0) + 1;
      formRequestSequenceRef.current[form.id] = requestSequence;

      setResources((current) => {
        const previous = current[form.id] || createIdleResource();
        return {
          ...current,
          [form.id]: {
            ...previous,
            status: previous.data ? previous.status : "loading",
            error: null,
            isRefreshing: Boolean(previous.data),
          },
        };
      });

      const controller = createController();

      try {
        const detail = validateFormDetail(
          await api.getForm(form.id, controller.signal),
          singular,
        );

        if (
          generation !== generationRef.current ||
          requestSequence !== formRequestSequenceRef.current[form.id]
        ) {
          return;
        }

        setResources((current) => ({
          ...current,
          [form.id]: {
            status: detail.records.length > 0 ? "ready" : "empty",
            data: detail,
            error: null,
            isRefreshing: false,
          },
        }));
      } catch (loadError) {
        if (
          isAbortError(loadError) ||
          generation !== generationRef.current ||
          requestSequence !== formRequestSequenceRef.current[form.id]
        ) {
          return;
        }

        setResources((current) => {
          const previous = current[form.id] || createIdleResource();
          const message = toErrorMessage(
            loadError,
            `Não foi possível carregar ${form.name}.`,
          );

          return {
            ...current,
            [form.id]: previous.data
              ? {
                  ...previous,
                  error: message,
                  isRefreshing: false,
                }
              : {
                  status: "error",
                  data: null,
                  error: message,
                  isRefreshing: false,
                },
          };
        });
      } finally {
        releaseController(controller);
      }
    },
    [api, createController, releaseController, singular],
  );

  const loadAllDetails = useCallback(
    async (forms: DtoFormReference[], generation: number) => {
      let nextIndex = 0;
      const workerCount = Math.min(DETAIL_CONCURRENCY, forms.length);

      async function worker() {
        while (generation === generationRef.current) {
          const currentIndex = nextIndex;
          nextIndex += 1;

          if (currentIndex >= forms.length) {
            return;
          }

          await loadFormDetail(forms[currentIndex], generation);
        }
      }

      await Promise.all(
        Array.from({ length: workerCount }, () => worker()),
      );
    },
    [loadFormDetail],
  );

  const discoverForms = useCallback(
    async ({ forceRefresh = false }: { forceRefresh?: boolean } = {}) => {
      abortPendingRequests();
      const generation = generationRef.current + 1;
      generationRef.current = generation;

      if (forceRefresh) {
        setRefreshing(true);
        setRefreshError(null);
      } else {
        setStatus("loading");
        setError(null);
      }

      const controller = createController();

      try {
        const payload = validateFormsPayload(
          forceRefresh
            ? await api.refreshForms(controller.signal)
            : await api.listForms(controller.signal),
          singular,
          plural,
        );

        if (generation !== generationRef.current) {
          return;
        }

        formsPayloadRef.current = payload;
        setFormsPayload(payload);
        setResources((current) => {
          const nextResources: DtoFormResourceMap = {};
          payload.forms.forEach((form) => {
            nextResources[form.id] = current[form.id] || createIdleResource();
          });
          return nextResources;
        });
        setError(null);
        setStatus(payload.forms.length > 0 ? "ready" : "empty");

        await loadAllDetails(payload.forms, generation);

        if (generation === generationRef.current && forceRefresh) {
          setRefreshCompletedAt(new Date().toISOString());
        }
      } catch (discoveryError) {
        if (isAbortError(discoveryError) || generation !== generationRef.current) {
          return;
        }

        const message = toErrorMessage(
          discoveryError,
          `Não foi possível descobrir os formulários ${singular} no SAVI.`,
        );

        if (forceRefresh && formsPayloadRef.current) {
          setRefreshError(message);
        } else {
          setError(message);
          setStatus("error");
        }
      } finally {
        releaseController(controller);
        if (generation === generationRef.current && forceRefresh) {
          setRefreshing(false);
        }
      }
    },
    [
      abortPendingRequests,
      api,
      createController,
      loadAllDetails,
      plural,
      releaseController,
      singular,
    ],
  );

  useEffect(() => {
    void discoverForms();

    return () => {
      generationRef.current += 1;
      abortPendingRequests();
    };
  }, [abortPendingRequests, discoverForms]);

  const retryForm = useCallback(
    async (formId: string) => {
      const form = formsPayload?.forms.find((item) => item.id === formId);
      if (!form) {
        return;
      }
      await loadFormDetail(form, generationRef.current);
    },
    [formsPayload, loadFormDetail],
  );

  const saveConfiguration = useCallback(
    async (
      formId: string,
      update: DtoConfigurationUpdate,
    ): Promise<DtoFormConfiguration> => {
      const form = formsPayloadRef.current?.forms.find((item) => item.id === formId);
      if (!form) {
        throw new Error(`O formulário ${singular} não está mais disponível.`);
      }
      const controller = createController();
      try {
        const configuration = await api.updateConfiguration(
          formId,
          update,
          controller.signal,
        );
        await loadFormDetail(form, generationRef.current);
        return configuration;
      } finally {
        releaseController(controller);
      }
    },
    [api, createController, loadFormDetail, releaseController, singular],
  );

  const refreshFormData = useCallback(
    async (
      formId: string,
      period: DtoRefreshRequest,
      onProgress?: (job: DtoRefreshJob) => void,
      signal?: AbortSignal,
    ): Promise<DtoFormDetail> => {
      const form = formsPayloadRef.current?.forms.find((item) => item.id === formId);
      if (!form) {
        throw new Error(`O formulário ${singular} não está mais disponível.`);
      }
      setResources((current) => {
        const previous = current[formId] || createIdleResource();
        return {
          ...current,
          [formId]: { ...previous, error: null, isRefreshing: true },
        };
      });

      try {
        let job = await api.startFormRefresh(formId, period, signal);
        onProgress?.(job);
        for (let attempt = 0; attempt < REFRESH_MAX_CHECKS; attempt += 1) {
          if (job.status === "failed") {
            throw new Error(job.error_message || "O SAVI não conseguiu gerar a exportação.");
          }
          if (job.status === "completed") {
            if (!job.detail) {
              throw new Error("A exportação terminou sem devolver os dados atualizados.");
            }
            const detail = validateFormDetail(job.detail, singular);
            setResources((current) => ({
              ...current,
              [formId]: {
                status: detail.records.length > 0 ? "ready" : "empty",
                data: detail,
                error: null,
                isRefreshing: false,
              },
            }));
            return detail;
          }
          await waitForNextCheck(signal);
          job = await api.checkFormRefresh(formId, job.job_id, signal);
          onProgress?.(job);
        }
        throw new Error(
          "A exportação continua em processamento no SAVI. A espera automática foi encerrada após 90 segundos; tente atualizar novamente mais tarde.",
        );
      } catch (refreshFormError) {
        setResources((current) => {
          const previous = current[formId] || createIdleResource();
          return {
            ...current,
            [formId]: {
              ...previous,
              error: isAbortError(refreshFormError)
                ? previous.error
                : toErrorMessage(refreshFormError, "Não foi possível atualizar os dados."),
              isRefreshing: false,
            },
          };
        });
        throw refreshFormError;
      }
    },
    [api, singular],
  );

  const lastUpdatedAt = useMemo(() => {
    const candidates = [
      formsPayload?.discovered_at,
      ...Object.values(resources).map((resource) => resource.data?.loaded_at),
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => ({ value, date: parseDtoDate(value) }))
      .filter(
        (candidate): candidate is { value: string; date: Date } =>
          candidate.date !== null,
      )
      .sort((left, right) => right.date.getTime() - left.date.getTime());

    return candidates[0]?.value || formsPayload?.discovered_at || null;
  }, [formsPayload, resources]);

  return {
    error,
    forms: formsPayload?.forms || [],
    formsPayload,
    lastUpdatedAt,
    refreshCompletedAt,
    refreshError,
    refreshing,
    resources,
    refreshFormData,
    saveConfiguration,
    retryDiscovery: () => discoverForms(),
    retryForm,
    status,
    refresh: () => discoverForms({ forceRefresh: true }),
  };
}
