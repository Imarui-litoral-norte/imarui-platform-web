"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { resolveSessionRoles } from "@/features/auth/lib/sessionView";
import { useSessionStore } from "@/features/auth/store/useSessionStore";
import { APP_ROUTES } from "@/shared/config/routes";
import { readAuthSession } from "@/features/auth/lib/authSession";

export function useAuthenticatedSession() {
  const router = useRouter();
  const error = useSessionStore((state) => state.error);
  const isLoggingOut = useSessionStore((state) => state.isLoggingOut);
  const logoutAction = useSessionStore((state) => state.logout);
  const profile = useSessionStore((state) => state.profile);
  const session = useSessionStore((state) => state.session);
  const status = useSessionStore((state) => state.status);
  const syncSession = useSessionStore((state) => state.syncSession);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void syncSession(router);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [router, syncSession]);

  useEffect(() => {
    function syncVisibleSession() {
      if (document.visibilityState === "visible") {
        void syncSession(router);
      }
    }

    function handleWindowFocus() {
      void syncSession(router);
    }
    function handleSessionMessage(event) {
      if (event.detail?.type === "logout") {
        useSessionStore.setState({ status: "unauthenticated", session: null, profile: null });
        router.replace(APP_ROUTES.LOGIN);
      } else void syncSession(router);
    }

    document.addEventListener("visibilitychange", syncVisibleSession);
    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("iiam-session-change", handleSessionMessage);
    const refreshTimer = window.setInterval(() => {
      const expiresAt = Date.parse(readAuthSession()?.expiresAt || "");
      if (document.visibilityState === "visible" && Number.isFinite(expiresAt) && expiresAt - Date.now() <= 60_000) {
        void syncSession(router, { forceRefresh: true });
      }
    }, 30_000);

    return () => {
      document.removeEventListener("visibilitychange", syncVisibleSession);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("iiam-session-change", handleSessionMessage);
      window.clearInterval(refreshTimer);
    };
  }, [router, syncSession]);

  const roles = useMemo(() => resolveSessionRoles(profile), [profile]);

  return {
    error,
    isLoggingOut,
    logout: () => logoutAction(router),
    profile,
    roles,
    session,
    status,
  };
}
