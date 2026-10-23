"use client";

import { create } from "zustand";
import { authApi } from "@/features/auth/lib/authApi";
import {
  clearAuthSession,
  readAuthSession,
  updateAuthSessionProfile,
} from "@/features/auth/lib/authSession";
import { APP_ROUTES } from "@/shared/config/routes";

const REFRESH_BUFFER_MS = 60_000;

function hasStoredSession(session) {
  return Boolean(session?.accessToken);
}

function shouldRefreshSoon(session) {
  if (!session?.accessToken || !session?.expiresAt) {
    return false;
  }

  const expiresAt = Date.parse(session.expiresAt);

  if (!Number.isFinite(expiresAt)) {
    return false;
  }

  return expiresAt - Date.now() <= REFRESH_BUFFER_MS;
}

function redirectToLogin(router) {
  if (router) {
    router.replace(APP_ROUTES.LOGIN);
  }
}

export const useSessionStore = create((set, get) => ({
  status: "loading",
  error: "",
  session: null,
  profile: null,
  isRefreshing: false,
  isLoggingOut: false,

  async syncSession(router, { forceRefresh = false } = {}) {
    const storedSession = readAuthSession();

    set({
      session: storedSession,
      profile: storedSession?.profile ?? null,
    });

    try {
      if (!hasStoredSession(storedSession) || forceRefresh || shouldRefreshSoon(storedSession)) {
        set({ isRefreshing: true });
        await authApi.refresh();
      }

      const nextProfile = await authApi.me();
      const nextSession =
        updateAuthSessionProfile(nextProfile) || readAuthSession();

      set({
        status: "ready",
        error: "",
        session: nextSession,
        profile: nextProfile,
      });

      return {
        session: nextSession,
        profile: nextProfile,
      };
    } catch (syncError) {
      clearAuthSession();
      set({
        status: "unauthenticated",
        error: syncError?.message || "Sua sessao expirou.",
        session: null,
        profile: null,
      });
      redirectToLogin(router);
      return null;
    } finally {
      set({ isRefreshing: false });
    }
  },

  async logout(router) {
    set({ isLoggingOut: true });

    try {
      await authApi.logout();
    } catch {
      // Se o backend rejeitar a sessao atual, ainda limpamos o navegador.
    } finally {
      clearAuthSession();
      set({
        status: "unauthenticated",
        session: null,
        profile: null,
        isLoggingOut: false,
      });
      redirectToLogin(router);
    }
  },
}));
