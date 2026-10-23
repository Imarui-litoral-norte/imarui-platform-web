"use client";
import { useMemo } from "react";
import type { Area } from "@/features/iam/model/types";
import { createIiamApi } from "@/features/iam/api/iiamApi";
import IiamConsole from "@/features/iam/ui/IiamConsole";
import { authApi, authRequest } from "@/features/auth/lib/authApi";
import { clearAuthSession } from "@/features/auth/lib/authSession";
import { useSessionStore } from "@/features/auth/store/useSessionStore";
export default function IamView({ area }: { area: Area }) {
  const api=useMemo(()=>createIiamApi(authRequest),[]);
  const profile=useSessionStore(state=>state.profile);
  return <IiamConsole area={area} api={api} profile={profile} clearSession={clearAuthSession}
    refreshSession={async()=>{await authApi.refresh();const result=await useSessionStore.getState().syncSession();if(!result)throw new Error("Não foi possível atualizar os dados da sessão.");}}/>;
}
