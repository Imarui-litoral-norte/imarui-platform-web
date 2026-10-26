import { authRequest } from "@/features/auth/lib/authApi";

const EXTRATOR_API_PREFIX = "/api/extrator";

function buildExtratorPath(path) {
  const normalizedPath = String(path || "").startsWith("/") ? path : `/${path}`;
  return `${EXTRATOR_API_PREFIX}${normalizedPath}`;
}

function buildQueryString(params) {
  const query = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "__all__") {
      return;
    }
    query.set(key, String(value));
  });

  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

async function request(path, options = {}) {
  const { method = "GET", body } = options;
  return authRequest(buildExtratorPath(path), { method, body, authenticated: true });
}

export const extratorApi = {
  getStatus() {
    return request("/status");
  },
  submitBeesVerificationCode(code) {
    return request("/bees-auth/verify", {
      method: "POST",
      body: { code },
    });
  },
  getClientLog() {
    return request("/client-log");
  },
  getClientHistory({ page = 1, pageSize = 8 } = {}) {
    return request(`/client-history?page=${page}&page_size=${pageSize}`);
  },
  getScheduler({ page = 1, pageSize = 10, filters = {} } = {}) {
    return request(
      `/scheduler${buildQueryString({
        page,
        page_size: pageSize,
        search: filters.search,
        base: filters.base,
        period: filters.period,
        schedule_type: filters.scheduleType,
        enabled: filters.enabled,
      })}`,
    );
  },
  getDestinations({ page = 1, pageSize = 10, filters = {} } = {}) {
    return request(
      `/destinations${buildQueryString({
        page,
        page_size: pageSize,
        search: filters.search,
        owner: filters.owner,
        base: filters.base,
        period: filters.period,
        enabled: filters.enabled,
        source: filters.source,
      })}`,
    );
  },
  getBatches() {
    return request("/batches");
  },
  getRequests({ page = 1, pageSize = 10 } = {}) {
    return request(
      `/solicitacoes${buildQueryString({
        page,
        page_size: pageSize,
      })}`,
    );
  },
  getGlobalQueue({ historyPage = 1, historyPageSize = 10 } = {}) {
    return request(
      `/global-queue?history_page=${historyPage}&history_page_size=${historyPageSize}`,
    );
  },
  enqueue(body) {
    return request("/enqueue", {
      method: "POST",
      body: {
        ...body,
        ...(body?.period_args || {}),
      },
    });
  },
  enqueueBatch(body) {
    return request("/enqueue-batch", { method: "POST", body });
  },
  enqueueAll(body) {
    return request("/enqueue-all", { method: "POST", body });
  },
  cancelTask(body) {
    return request("/cancel-task", { method: "POST", body });
  },
  cancelGlobalTask(body) {
    return request("/global-cancel-task", { method: "POST", body });
  },
  saveSchedulerRule(body) {
    return request("/scheduler/save", { method: "POST", body });
  },
  setSchedulerRuleEnabled(body) {
    return request("/scheduler/enabled", { method: "POST", body });
  },
  deleteSchedulerRule(body) {
    return request("/scheduler/delete", { method: "POST", body });
  },
  saveDestinationRule(body) {
    return request("/destinations/save", { method: "POST", body });
  },
  deleteDestinationRule(body) {
    return request("/destinations/delete", { method: "POST", body });
  },
  saveBatch(body) {
    return request("/batches/save", { method: "POST", body });
  },
  deleteBatch(body) {
    return request("/batches/delete", { method: "POST", body });
  },
  saveRequest(body) {
    return request("/solicitacoes/save", { method: "POST", body });
  },
  updateRequestStatus(body) {
    return request("/solicitacoes/status", { method: "POST", body });
  },
};
