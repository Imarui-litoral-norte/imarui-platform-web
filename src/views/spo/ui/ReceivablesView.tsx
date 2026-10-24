"use client";

import ReceivablesDashboard from "@/features/receivables/ui/ReceivablesDashboard";
import { createReceivablesApi } from "@/features/receivables/api/receivablesApi";
import { receivablesRequest } from "../lib/receivablesTransport";

const api = createReceivablesApi(receivablesRequest);
export default function ReceivablesView() {
  return <ReceivablesDashboard api={api} />;
}

