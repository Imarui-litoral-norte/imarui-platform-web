export const EMPTY_OPERATION_FORM = Object.freeze({
  base: "",
  periodType: "",
  periodMode: "",
  monthReference: "",
  yearReference: "",
  date: "",
  startDate: "",
  endDate: "",
});

export const EMPTY_BATCH_DRAFT = Object.freeze({
  id: "",
  nome: "",
  senha: "",
  items: [],
});

export function buildHistoryRefreshOptions(clientHistoryPayload) {
  return {
    historyPage: clientHistoryPayload?.page || 1,
    historyPageSize: clientHistoryPayload?.page_size || 8,
  };
}
