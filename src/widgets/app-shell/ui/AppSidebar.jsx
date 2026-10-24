import Link from "next/link";
import { buildGatewayUrl } from "@/shared/network/gatewayUrl";
import ShellIconButton from "@/widgets/app-shell/ui/ShellIconButton";
import {
  CalendarIcon,
  ChartIcon,
  ChevronRightIcon,
  ClipboardIcon,
  HouseIcon,
  ServiceIcon,
  StarIcon,
} from "@/widgets/app-shell/ui/ShellIcons";

function renderSidebarItemIcon(icon) {
  switch (icon) {
    case "star":
      return <StarIcon />;
    case "house":
      return <HouseIcon />;
    case "chart":
      return <ChartIcon />;
    case "calendar":
      return <CalendarIcon />;
    case "clipboard":
      return <ClipboardIcon />;
    case "service":
      return <ServiceIcon />;
    default:
      return <ChevronRightIcon />;
  }
}

function isNavigationItemActive(item, pathname, activeSidebarPanel) {
  if (item.type === "panel") {
    return activeSidebarPanel === item.id || Boolean(item.activePath && (pathname === item.activePath || pathname.startsWith(`${item.activePath}/`)));
  }

  const activePath = item.activePath || item.href;
  return pathname === activePath || pathname.startsWith(`${activePath}/`);
}

function SidebarPanelItem({ active, expanded, item, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={`sidebar-panel-${item.id}`}
      className={`flex w-full items-start justify-between gap-3 rounded-[22px] border px-3.5 py-3 text-left transition ${
        active
          ? "border-[color:var(--shell-accent)] bg-[var(--shell-accent-soft)]"
          : "border-[color:var(--shell-line)] bg-[var(--shell-surface)] hover:border-[color:var(--shell-line-strong)]"
      }`}
    >
      <span className="min-w-0">
        <span className="inline-flex items-center gap-2.5 text-sm font-semibold text-[var(--shell-text)]">
          {renderSidebarItemIcon(item.icon)}
          {item.label}
        </span>
        <span className="mt-1.5 block text-[13px] leading-5 text-[var(--shell-muted)]">
          {item.description}
        </span>
      </span>
      <span className="mt-0.5 shrink-0 text-[var(--shell-muted)]">
        <ChevronRightIcon />
      </span>
    </button>
  );
}

function SidebarLinkItem({ active, item, onNavigate }) {
  const NavigationLink = item.type === "document" ? "a" : Link;

  return (
    <NavigationLink
      href={item.href}
      onClick={onNavigate}
      className={`flex items-start justify-between gap-3 rounded-[22px] border px-3.5 py-3 text-left transition ${
        active
          ? "border-[color:var(--shell-accent)] bg-[var(--shell-accent-soft)]"
          : "border-[color:var(--shell-line)] bg-[var(--shell-surface)] hover:border-[color:var(--shell-line-strong)]"
      }`}
    >
      <span className="min-w-0">
        <span className="inline-flex items-center gap-2.5 text-sm font-semibold text-[var(--shell-text)]">
          {renderSidebarItemIcon(item.icon)}
          {item.label}
        </span>
        <span className="mt-1.5 block text-[13px] leading-5 text-[var(--shell-muted)]">
          {item.description}
        </span>
      </span>
      <span className="mt-0.5 shrink-0 text-[var(--shell-muted)]">
        <ChevronRightIcon />
      </span>
    </NavigationLink>
  );
}

function ServicePanelLink({ description, href, label }) {
  return (
    <a
      href={buildGatewayUrl(href)}
      className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-3.5 py-3 text-sm font-semibold text-[var(--shell-text)] transition hover:border-[color:var(--shell-line-strong)] hover:bg-[var(--shell-surface)]"
    >
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {description ? (
          <span className="mt-1 block text-[12px] font-normal leading-5 text-[var(--shell-muted)]">
            {description}
          </span>
        ) : null}
      </span>
      <span className="shrink-0 text-[var(--shell-muted)]">
        <ChevronRightIcon />
      </span>
    </a>
  );
}

function ServicePanel({ items }) {
  return (
    <div className="mt-4 space-y-2">
      {items.map((serviceItem) =>
        serviceItem.children ? (
          <div
            key={serviceItem.id}
            className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] p-3.5"
          >
            <p className="text-sm font-semibold text-[var(--shell-text)]">
              {serviceItem.label}
            </p>
            <p className="mt-1 text-[12px] leading-5 text-[var(--shell-muted)]">
              {serviceItem.description}
            </p>
            <div className="mt-3 space-y-2">
              {serviceItem.children.map((childItem) => (
                <ServicePanelLink
                  key={childItem.id}
                  href={childItem.href}
                  label={childItem.label}
                />
              ))}
            </div>
          </div>
        ) : (
          <ServicePanelLink
            key={serviceItem.id}
            href={serviceItem.href}
            label={serviceItem.label}
          />
        ),
      )}
    </div>
  );
}

export default function AppSidebar({
  activeSidebarPanel,
  items,
  onClose,
  onNavigate,
  onTogglePanel,
  pathname,
  serviceItems,
}) {
  const activePanelItem = items.find(
    (item) => item.id === activeSidebarPanel && item.type === "panel",
  );

  return (
    <aside aria-label="Navegação principal" className="fixed bottom-4 left-4 top-4 z-[60] flex w-[min(88vw,330px)] flex-col rounded-[28px] border border-[color:var(--shell-line)] bg-[var(--shell-surface-strong)] p-5 shadow-[0_24px_80px_rgba(20,32,43,0.22)] sm:bottom-6 sm:left-6 sm:top-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--shell-accent)]">
            Navegacao
          </p>
          <h2 className="mt-2 font-serif text-2xl text-[var(--shell-text)]">
            Modulos iniciais
          </h2>
        </div>

        <ShellIconButton label="Fechar menu" onClick={onClose}>
          <ChevronRightIcon />
        </ShellIconButton>
      </div>

      <div className="relative mt-5 min-h-0 flex-1">
        <div className="shell-scrollbar h-full space-y-2.5 overflow-x-hidden overflow-y-auto pr-2 pb-2">
          {items.map((item) => {
            const isActive = isNavigationItemActive(
              item,
              pathname,
              activeSidebarPanel,
            );

            return item.type === "panel" ? (
              <SidebarPanelItem
                key={item.id}
                active={isActive}
                expanded={activeSidebarPanel === item.id}
                item={item}
                onClick={() => onTogglePanel(item.id)}
              />
            ) : (
              <SidebarLinkItem
                key={item.id}
                active={isActive}
                item={item}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>

        {activePanelItem?.panel ? (
          <div id={`sidebar-panel-${activePanelItem.id}`} className={activePanelItem.children ? "shell-scrollbar absolute inset-0 z-[61] max-h-full overflow-y-auto rounded-[24px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4 shadow-[0_18px_60px_rgba(20,32,43,0.16)] sm:inset-auto sm:left-full sm:top-0 sm:ml-4 sm:max-h-[calc(100dvh-160px)] sm:w-[290px]" : "absolute left-0 top-full z-[61] mt-3 w-full rounded-[24px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4 shadow-[0_18px_60px_rgba(20,32,43,0.16)] sm:left-full sm:top-0 sm:ml-4 sm:mt-0 sm:w-[290px]"}>
            {activePanelItem.children ? <button type="button" onClick={() => onTogglePanel(activePanelItem.id)} className="mb-4 text-sm text-[var(--shell-accent)]">← Voltar aos módulos</button> : null}
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--shell-accent)]">
              {activePanelItem.panel.eyebrow}
            </p>
            <h3 className="mt-2 font-serif text-2xl text-[var(--shell-text)]">
              {activePanelItem.panel.title}
            </h3>
            <p className="mt-3 text-sm leading-6 text-[var(--shell-muted)]">
              {activePanelItem.panel.body}
            </p>

            {activePanelItem.showServices ? (
              <ServicePanel items={serviceItems} />
            ) : null}
            {activePanelItem.children ? <nav aria-label="Submenu IAM" className="mt-4 space-y-2">{activePanelItem.children.map(child => <SidebarLinkItem key={child.id} item={child} active={pathname === child.href || pathname.startsWith(`${child.href}/`)} onNavigate={onNavigate}/>)}</nav> : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
