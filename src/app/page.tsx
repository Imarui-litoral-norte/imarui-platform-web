import Link from "next/link";
import { APP_ROUTES } from "@/shared/config/routes";
import styles from "./landing.module.css";
export const metadata = { title: "Bem-vindo" };
export default function LandingPage() {
  return <div className="flex min-h-dvh flex-col bg-[#f4f5f0] text-slate-950">
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-7 sm:px-10">
      <Link href="/" aria-label="Logimarui, página inicial" className="text-xl font-semibold tracking-tight">logimarui<span className="text-emerald-700">.</span></Link>
      <Link href={APP_ROUTES.LOGIN} className={`${styles.user} rounded-full border border-slate-950 px-5 py-2.5 text-sm font-medium transition hover:bg-slate-950 focus-visible:outline-2 focus-visible:outline-offset-4`}>Sou usuário <span aria-hidden="true">↗</span></Link>
    </header>
    <main className="mx-auto flex w-full max-w-6xl flex-1 items-center px-6 py-16 sm:px-10 sm:py-24">
      <div className="max-w-3xl"><p className="mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-800">Portal Logimarui</p>
        <h1 className="text-5xl font-medium leading-[1.06] tracking-tight sm:text-7xl">Sua operação.<br/><span className="text-emerald-800">Um só acesso.</span></h1>
        <p className="mt-8 max-w-lg text-lg leading-8 text-slate-600">Acesse as ferramentas de trabalho e encontre o que você precisa para acompanhar a operação.</p>
        <div className="mt-10 flex flex-wrap items-center gap-6"><Link href={APP_ROUTES.LOGIN} className={`${styles.primary} rounded-full bg-emerald-900 px-7 py-3.5 font-medium transition hover:bg-emerald-800`}>Entrar na plataforma</Link><Link href={APP_ROUTES.REGISTER} className="text-sm font-medium underline underline-offset-4">Solicitar meu acesso</Link></div>
      </div>
    </main>
    <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-slate-950/10 px-6 py-6 text-xs text-slate-500 sm:px-10"><span>Logimarui · Ferramentas para sua operação</span><Link href={APP_ROUTES.REGISTER_SERVICE} className="underline-offset-4 hover:text-slate-900 hover:underline">Adicionar serviço</Link></footer>
  </div>;
}
