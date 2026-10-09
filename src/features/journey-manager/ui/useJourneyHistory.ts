"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { journeyApi } from "../api/journeyApi";
import type { AnalysisRole, JourneyHistory, JourneyQuery } from "../model/types";
import type { LiveScope } from "../lib/journeyPresentation";

export function useJourneyHistory(enabled: boolean, query: JourneyQuery, role: AnalysisRole,
  search: string, scope: LiveScope) {
  const key = JSON.stringify([query, role, search.trim(), scope]);
  const [state, setState] = useState<{ key: string; data: JourneyHistory | null; loading: boolean;
    refreshing: boolean; error: string | null; notice: string | null }>({ key: "", data: null,
    loading: false, refreshing: false, error: null, notice: null });
  const requestRef = useRef<AbortController | null>(null);
  const previousRef = useRef<{ key: string; data: JourneyHistory } | null>(null);
  const lastSuccess = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!enabled || requestRef.current) return;
    const controller = new AbortController(); requestRef.current = controller;
    const previous = previousRef.current?.key === key ? previousRef.current.data : null;
    setState(current => ({ key, data: previous, loading: !previous, refreshing: !!previous,
      error: null, notice: current.key === key ? current.notice : null }));
    try {
      const response = await journeyApi.history(query, role, search, scope, controller.signal, !silent || !previous);
      if (controller.signal.aborted) return;
      const data = silent && previous ? { ...response, previousYearDaily: previous.previousYearDaily } : response;
      previousRef.current = { key, data }; lastSuccess.current = Date.now();
      setState({ key, data, loading: false, refreshing: false, error: null, notice: null });
    } catch (failure) {
      if (controller.signal.aborted) return;
      const message = failure instanceof Error ? failure.message : "Não foi possível carregar a análise.";
      setState({ key, data: previous, loading: false, refreshing: false,
        error: previous ? null : message, notice: previous ? `Atualização não concluída: ${message}` : null });
    } finally { if (requestRef.current === controller) requestRef.current = null; }
  }, [enabled, key, query, role, search, scope]);

  useEffect(() => {
    requestRef.current?.abort(); requestRef.current = null;
    // Instant search needs no confirmation; debounce only the analytical network read.
    const timer = window.setTimeout(() => void load(), 300);
    return () => { window.clearTimeout(timer); requestRef.current?.abort(); requestRef.current = null; };
  }, [load]);

  const data = state.key === key ? state.data : null;
  useEffect(() => {
    if (!enabled || !data || (!data.summary.pending && !data.team?.some(row => row.counts.pending > 0))) return;
    const tick = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSuccess.current >= 60_000) void load(true);
    };
    const interval = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", tick); };
  }, [enabled, data, load]);

  return { data, loading: enabled && (state.key !== key || state.loading),
    refreshing: state.key === key && state.refreshing,
    error: state.key === key ? state.error : null, notice: state.key === key ? state.notice : null,
    reload: () => void load() };
}
