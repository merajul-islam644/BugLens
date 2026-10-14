import { Menu, PanelLeft } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { navItems } from "./navItems";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { BrandMark } from "../../shared/ui/BrandMark";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { can } from "../../features/access/permissions";
import type { RoleSlug } from "../../features/access/permissions";

const COLLAPSED_KEY = "buglens:sidebar-collapsed";
const MOBILE_QUERY = "(max-width: 880px)";

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function AppShell({ activePath, children, investigationCount, onNavigate, role, workspaceName }: {
  activePath: string;
  children: ReactNode;
  investigationCount?: number;
  onNavigate: (path: string) => void;
  role?: RoleSlug;
  workspaceName?: string;
}) {
  const isMobile = useIsMobile();
  const [collapsedPref, setCollapsedPref] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "true");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t } = useT();
  const collapsed = collapsedPref || isMobile;
  const items = navItems.filter((item) => !item.adminOnly || can(role, "manageWorkspace"));
  const activeItem = items.find((item) => activePath === item.href || activePath.startsWith(`${item.href}/`));

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsedPref));
  }, [collapsedPref]);

  function go(path: string) {
    setDrawerOpen(false);
    onNavigate(path);
  }

  const asideClass = [
    collapsed ? "collapsed" : "",
    isMobile && drawerOpen ? "drawer-open" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className="shell">
      {isMobile && drawerOpen ? <div className="drawer-scrim" onClick={() => setDrawerOpen(false)} role="presentation" /> : null}
      <aside className={asideClass}>
        <div className="sidebar-header">
          <a className="brand" href="/" onClick={(event) => { event.preventDefault(); go("/"); }}>
            <BrandMark />
            <span>{t("app.name")}</span>
          </a>
          {isMobile ? (
            <button className="icon-button" onClick={() => setDrawerOpen(false)} aria-label={t("nav.closeMenu")}>
              <Menu size={16} />
            </button>
          ) : (
            <button
              className="icon-button sidebar-collapse-toggle"
              onClick={() => setCollapsedPref((value) => !value)}
              aria-label={collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar")}
            >
              <PanelLeft size={16} />
            </button>
          )}
        </div>
        <nav>
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              data-tooltip={t(item.labelKey)}
              className={activeItem?.href === item.href ? "active" : ""}
              onClick={(event) => {
                event.preventDefault();
                go(item.href);
              }}
            >
              <item.icon size={18} />
              <span>{t(item.labelKey)}</span>
              {item.badge === "investigations" && investigationCount && investigationCount > 0 ? (
                <span className="nav-badge">{investigationCount}</span>
              ) : null}
            </a>
          ))}
        </nav>
      </aside>
      <div className="content">
        <header className="topbar">
          {isMobile ? (
            <button className="icon-button" onClick={() => setDrawerOpen(true)} aria-label={t("nav.openMenu")}>
              <Menu size={18} />
            </button>
          ) : null}
          {activeItem ? (
            <div className="breadcrumb">
              <activeItem.icon size={16} />
              <span>{t(activeItem.labelKey)}</span>
            </div>
          ) : null}
          <div className="topbar-spacer" />
          {workspaceName ? (
            <span className="workspace-chip">
              {t("shell.workspace")}
              <strong>{workspaceName}</strong>
            </span>
          ) : null}
          <NotificationBell />
          <ThemeToggle />
          <UserMenu onNavigate={go} />
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
