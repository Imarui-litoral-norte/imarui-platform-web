"use client";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import type { Area } from "@/features/iam/model/types";
import { createIiamApi } from "@/features/iam/api/iiamApi";
import IiamConsole from "@/features/iam/ui/IiamConsole";
import { authApi, authRequest } from "@/features/auth/lib/authApi";
import { clearAuthSession } from "@/features/auth/lib/authSession";
import { useSessionStore } from "@/features/auth/store/useSessionStore";
function Console({ area }: { area: Area }) {
  const params = useSearchParams();
  const api = useMemo(() => createIiamApi(authRequest), []);
  const profile = useSessionStore((state) => state.profile);
  return (
    <IiamConsole
      key={`${area}:${params.toString()}`}
      area={area}
      api={api}
      profile={profile}
      clearSession={clearAuthSession}
      initialIdentityId={params.get("identityId") || ""}
      initialSection={params.get("section") || ""}
      initialScope={params.get("scopeId") || ""}
      refreshSession={async () => {
        await authApi.refresh();
        const result = await useSessionStore.getState().syncSession();
        if (!result)
          throw new Error("Não foi possível atualizar os dados da sessão.");
      }}
    />
  );
}
export default function IamView({ area }: { area: Area }) {
  return (
    <Suspense fallback={<p role="status">Preparando a gestão de acessos…</p>}>
      <Console area={area} />
    </Suspense>
  );
}
