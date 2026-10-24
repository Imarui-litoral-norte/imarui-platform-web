import { isValidDocument } from "@/features/auth/lib/document";
import { isValidCpf } from "@/features/auth/lib/cpf";
import {
  isTestCpfValue,
  isTestPasswordValue,
} from "@/features/auth/lib/testAuth";

function isBlank(value) {
  return String(value ?? "").trim() === "";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

export function validateAuthForm(fields, values) {
  const errors = {};

  for (const field of fields) {
    const value = values[field.name];
    const rules = field.validation || {};

    if (field.required && isBlank(value)) {
      errors[field.name] = "Preencha este campo para continuar.";
      continue;
    }

    if (isBlank(value)) {
      continue;
    }

    if (rules.allowTestValue === "cpf" && isTestCpfValue(value)) {
      continue;
    }

    if (rules.allowTestValue === "password" && isTestPasswordValue(value)) {
      continue;
    }

    if (rules.isEmail && !isValidEmail(value)) {
      errors[field.name] = "Informe um e-mail valido.";
      continue;
    }

    if (rules.isDocument && !isValidDocument(value)) { errors[field.name] = "Informe um CPF ou CNPJ válido."; continue; }
    if (rules.isCpf && !isValidCpf(value)) {
      errors[field.name] = "Informe um CPF valido.";
      continue;
    }

    if (rules.minLength && String(value).trim().length < rules.minLength) {
      errors[field.name] = `Use pelo menos ${rules.minLength} caracteres.`;
      continue;
    }

    if (rules.matchesField && value !== values[rules.matchesField]) {
      errors[field.name] = "Os valores informados nao coincidem.";
    }
    if (rules.maxUtf8Bytes && new TextEncoder().encode(String(value)).length > rules.maxUtf8Bytes) {
      errors[field.name] = `Use no máximo ${rules.maxUtf8Bytes} bytes UTF-8.`;
    }
  }

  return errors;
}
