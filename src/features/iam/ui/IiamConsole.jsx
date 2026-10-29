"use client";
import Link from "next/link";
import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import IdentityWorkspace from "./IdentityWorkspace";
import AuthenticationWorkspace from "./AuthenticationWorkspace";
import AuthorizationWorkspace from "./AuthorizationWorkspace";
import s from "./iam.module.css";

const areas = [
  {
    id: "identity",
    title: "Identidades",
    href: "/iam/identidade",
    icon: Fingerprint,
    description:
      "Da solicitação ao acesso: acompanhe cada pessoa, empresa e serviço.",
  },
  {
    id: "authentication",
    title: "Autenticação",
    href: "/iam/autenticacao",
    icon: KeyRound,
    description:
      "Acompanhe sessões, controle renovações de acesso e proteja as contas.",
  },
  {
    id: "authorization",
    title: "Autorização",
    href: "/iam/autorizacao",
    icon: ShieldCheck,
    description:
      "Defina quem pode fazer o quê, em qual contexto e com qual responsabilidade.",
  },
];
export default function IiamConsole({
  area,
  api,
  profile,
  refreshSession,
  clearSession,
  initialIdentityId = "",
  initialSection = "",
  initialScope = "",
}) {
  const current = areas.find((item) => item.id === area) || areas[0];
  return (
    <div className={s.root}>
      <header className={s.header}>
        <div className={s.row}>
          <p className={s.eyebrow}>Administração / Identidades e acessos</p>
          <span className={s.operator}>
            Operador ·{" "}
            {profile?.userName || profile?.username || "Conta autenticada"}
          </span>
        </div>
        <div className={s.titleRow}>
          <span className={s.heroIcon}>
            <current.icon size={27} />
          </span>
          <div>
            <h1>{current.title}</h1>
            <p>{current.description}</p>
          </div>
        </div>
        <nav className={s.tabs} aria-label="Módulos de identidades e acessos">
          {areas.map(({ id, title, href, icon: Icon }) => (
            <Link
              key={id}
              href={href}
              aria-current={id === area ? "page" : undefined}
            >
              <Icon size={18} />
              {title}
            </Link>
          ))}
        </nav>
      </header>
      {area === "identity" ? (
        <IdentityWorkspace
          api={api}
          profile={profile}
          initialIdentityId={initialIdentityId}
          initialSection={initialSection}
        />
      ) : null}
      {area === "authentication" ? (
        <AuthenticationWorkspace
          api={api}
          profile={profile}
          refreshSession={refreshSession}
          clearSession={clearSession}
          initialSection={initialSection}
          initialIdentityId={initialIdentityId}
        />
      ) : null}
      {area === "authorization" ? (
        <AuthorizationWorkspace
          api={api}
          profile={profile}
          initialSection={initialSection}
          initialIdentityId={initialIdentityId}
          initialScope={initialScope}
        />
      ) : null}
    </div>
  );
}
