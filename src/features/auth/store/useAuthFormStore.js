"use client";

import { create } from "zustand";
import { visibleAuthFields } from "@/features/auth/lib/document";
import { AUTH_PAGE_CONTENT } from "@/features/auth/lib/constants";
import { formatCpf } from "@/features/auth/lib/cpf";
import { validateAuthForm } from "@/features/auth/lib/validators";
import { getAuthService } from "@/features/auth/services";

const IDLE_FEEDBACK = {
  type: "idle",
  message: "",
};

function buildInitialValues(fields) {
  return fields.reduce((accumulator, field) => {
    accumulator[field.name] =
      field.defaultValue ?? (field.type === "checkbox" ? false : "");
    return accumulator;
  }, {});
}

function removeFieldError(currentErrors, fieldName) {
  if (!currentErrors[fieldName]) {
    return currentErrors;
  }

  const nextErrors = { ...currentErrors };
  delete nextErrors[fieldName];
  return nextErrors;
}

function formatInputValue(field, value) {
  if (field?.format === "cpf") {
    return formatCpf(value);
  }

  return value;
}

export const useAuthFormStore = create((set, get) => ({
  pageKey: "",
  content: null,
  values: {},
  errors: {},
  feedback: IDLE_FEEDBACK,
  result: null,
  isSubmitting: false,

  setPage(pageKey) {
    const content = AUTH_PAGE_CONTENT[pageKey];

    if (!content) {
      throw new Error(`Unknown auth page key: ${pageKey}`);
    }

    if (get().pageKey === pageKey) {
      return;
    }

    set({
      pageKey,
      content,
      values: buildInitialValues(content.fields),
      errors: {},
      feedback: IDLE_FEEDBACK,
      result: null,
      isSubmitting: false,
    });
  },

  handleChange(event) {
    const { content, feedback, result } = get();
    const fields = content?.fields ?? [];
    const { name } = event.target;
    const field = fields.find((candidate) => candidate.name === name);
    const rawValue =
      field?.type === "checkbox" ? event.target.checked : event.target.value;
    const formattedValue = formatInputValue(field, rawValue);

    set((current) => ({
      values: {
        ...current.values,
        [name]: formattedValue,
      },
      errors: removeFieldError(current.errors, name),
      feedback: feedback.message ? IDLE_FEEDBACK : current.feedback,
      result: result ? null : current.result,
    }));
  },

  async submit() {
    const { content, values } = get();

    if (!content) {
      return;
    }

    const nextErrors = validateAuthForm(visibleAuthFields(content.fields, values), values);
    set({ errors: nextErrors });

    if (Object.keys(nextErrors).length > 0) {
      set({
        result: null,
        feedback: {
          type: "error",
          message: "Revise os campos destacados antes de continuar.",
        },
      });
      return;
    }

    set({
      isSubmitting: true,
      feedback: IDLE_FEEDBACK,
      result: null,
    });

    try {
      const response = await getAuthService(content.mode)(values);

      set({
        feedback: {
          type: "success",
          message:
            response?.message ||
            `${content.successPrefix} Operacao concluida.`,
        },
        result: response?.result ?? null,
        values: response?.resetForm
          ? buildInitialValues(content.fields)
          : get().values,
      });

      if (response?.redirectTo) {
        window.location.assign(response.redirectTo);
      }
    } catch (error) {
      set({
        feedback: {
          type: "error",
          message: error?.message || "Nao foi possivel concluir a acao agora.",
        },
      });
    } finally {
      set({ isSubmitting: false });
    }
  },
}));
