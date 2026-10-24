import {
  authApi,
  clearAuthSession,
  getOrCreateDeviceId,
  readAuthSession,
} from "@/features/auth";
import { buildGatewayUrl } from "@/shared/network/gatewayUrl";

const AUTHORIZATION_BASE_PATH = "/api/v1/authorization";

function buildUrl(path) {
  return buildGatewayUrl(path);
}

async function parseResponseBody(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? text : null;
}

function extractErrorMessage(body, response) {
  if (typeof body === "string" && body.trim()) {
    return body;
  }

  if (body && typeof body === "object") {
    const candidates = [
      body.mensagem,
      body.message,
      body.error,
      body.detail,
      body.title,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }
  }

  return `Nao foi possivel concluir a solicitacao (${response.status}).`;
}

async function request(path, options = {}) {
  const {
    method = "GET",
    body,
    retryOnAuthFailure = true,
  } = options;

  const session = readAuthSession();

  if (!session?.accessToken) {
    throw new Error("Sessao autenticada nao encontrada. Entre novamente.");
  }

  const headers = {
    Accept: "application/json",
    Authorization: `Bearer ${session.accessToken}`,
    "X-Device-Id": getOrCreateDeviceId(),
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(buildUrl(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new Error("Nao foi possivel conectar ao core-api de autorizacao.");
  }

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    if (response.status === 401 && retryOnAuthFailure) {
      await authApi.refresh();
      return request(path, {
        ...options,
        retryOnAuthFailure: false,
      });
    }

    if (response.status === 401) {
      clearAuthSession();
      throw new Error("Sua sessao expirou. Entre novamente.");
    }

    throw new Error(extractErrorMessage(payload, response));
  }

  return payload;
}

export const authorizationApi = {
  findAllRoles() {
    return request(`${AUTHORIZATION_BASE_PATH}/roles`);
  },
  findAllPermissions() {
    return request(`${AUTHORIZATION_BASE_PATH}/permissions`);
  },
  createRole(payload) {
    return request(`${AUTHORIZATION_BASE_PATH}/roles`, {
      method: "POST",
      body: payload,
    });
  },
  updateRole(roleId, payload) {
    return request(`${AUTHORIZATION_BASE_PATH}/roles/${roleId}`, {
      method: "PUT",
      body: payload,
    });
  },
  activateRole(roleId) {
    return request(`${AUTHORIZATION_BASE_PATH}/roles/${roleId}/activate`, {
      method: "PATCH",
    });
  },
  deactivateRole(roleId) {
    return request(`${AUTHORIZATION_BASE_PATH}/roles/${roleId}/deactivate`, {
      method: "PATCH",
    });
  },
  deleteRole(roleId) {
    return request(`${AUTHORIZATION_BASE_PATH}/roles/${roleId}`, {
      method: "DELETE",
    });
  },
  findPermissionsByRole(roleId) {
    return request(`${AUTHORIZATION_BASE_PATH}/roles/${roleId}/permissions`);
  },
  assignPermissionToRole(roleId, permissionId) {
    return request(`${AUTHORIZATION_BASE_PATH}/roles/${roleId}/permissions/${permissionId}`, {
      method: "POST",
    });
  },
  removePermissionFromRole(roleId, permissionId) {
    return request(`${AUTHORIZATION_BASE_PATH}/roles/${roleId}/permissions/${permissionId}`, {
      method: "DELETE",
    });
  },
  findRolesByUser(userId) {
    return request(`${AUTHORIZATION_BASE_PATH}/users/${userId}/roles`);
  },
  replaceUserRoles(userId, roleIds) {
    return request(`${AUTHORIZATION_BASE_PATH}/users/${userId}/roles`, {
      method: "PUT",
      body: { roleIds },
    });
  },
};
