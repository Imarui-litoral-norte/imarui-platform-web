"use client";

import ReceivablesDashboard from "@/features/receivables/ui/ReceivablesDashboard";
import { createReceivablesApi } from "@/features/receivables/api/receivablesApi";
import { receivablesDownload, receivablesRequest } from "../lib/receivablesTransport";

const api = createReceivablesApi(receivablesRequest, receivablesDownload);
export default function ReceivablesView() {
  return <ReceivablesDashboard api={api} />;
}

