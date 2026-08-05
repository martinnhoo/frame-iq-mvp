/**
 * AppSidebar — sidebar única do produto (desktop fixa + drawer mobile).
 * Toda a navegação vem de sidebarConfig; nada de item escrito à mão.
 */
import { useCallback, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Logo, LogoMark } from "@/components/Logo";
import { normalizePlan } from "@/lib/hubPlans";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarCreditsCard } from "./SidebarCreditsCard";
import {
  CREATE_CTA_HREF,
  getSidebarCopy,
  getSidebarSections,
  type SidebarItem,
} from "./sidebarConfig";
import "@/styles/sidebar.css";

const PLAN_RANK: Record<string, number> = {
  free: 0,
  creator: 1,
  pro: 2,
  studio: 3,
};

interface Props {
  lang: string;
  plan: string | null | undefined;
  isMobile: boolean;
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onLogout: () => void;
}

export function AppSidebar({
  lang,
  plan,
  isMobile,
  open,
  onClose,
  collapsed,
  onToggleCollapsed,
  onLogout,
}: Props) {
  const navigate = useNavigate();
  const copy = getSidebarCopy(lang);
  const sections = getSidebarSections(lang);
  const asideRef = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  const isCollapsed = !isMobile && collapsed;
  const userRank = PLAN_RANK[normalizePlan(plan)] ?? 0;

  const isLocked = (item: SidebarItem) =>
    !!item.requiredPlan &&
    userRank < (PLAN_RANK[item.requiredPlan] ?? 0);

  // Drawer mobile: Escape fecha, scroll do fundo trava, foco entra e volta.
  useEffect(() => {
    if (!isMobile || !open) return;

    restoreFocus.current = document.activeElement as HTMLElement | null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    asideRef.current
      ?.querySelector<HTMLElement>("a, button")
      ?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocus.current?.focus?.();
    };
  }, [isMobile, open, onClose]);

  const handleNavigate = useCallback(() => {
    if (isMobile) {
      onClose();
    }
  }, [isMobile, onClose]);

  const collapseButton = (
    <button
      type="button"
      className="sb-iconbtn"
      onClick={onToggleCollapsed}
      aria-label={collapsed ? copy.expand : copy.collapse}
      aria-expanded={!collapsed}
    >
      {collapsed ? (
        <PanelLeftOpen
          size={18}
          strokeWidth={1.75}
          aria-hidden
        />
      ) : (
        <PanelLeftClose
          size={18}
          strokeWidth={1.75}
          aria-hidden
        />
      )}
    </button>
  );

  return (
    <>
      {isMobile && open && (
        <div
          className="sb-backdrop"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        ref={asideRef}
        className="sb-root"
        data-collapsed={isCollapsed ? "true" : "false"}
        data-mobile={isMobile ? "true" : "false"}
        data-open={open ? "true" : "false"}
        aria-label="Navegação principal"
        aria-hidden={isMobile && !open ? true : undefined}
      >
        {/* Topo */}
        <div className="sb-head">
          <div className="sb-topline">
            <button
              type="button"
              className="sb-logo"
              onClick={() => {
                navigate("/dashboard/hub");
                handleNavigate();
              }}
              aria-label="AdBrief — início"
            >
              {isCollapsed ? (
                <LogoMark size={28} />
              ) : (
                <Logo size="lg" />
              )}
            </button>

            {!isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  {collapseButton}
                </TooltipTrigger>

                <TooltipContent side="right">
                  {collapsed ? copy.expand : copy.collapse}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to={CREATE_CTA_HREF}
                  className="sb-cta"
                  aria-label={copy.cta}
                  onClick={handleNavigate}
                >
                  <Plus
                    size={18}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </NavLink>
              </TooltipTrigger>

              <TooltipContent side="right">
                {copy.cta}
              </TooltipContent>
            </Tooltip>
          ) : (
            <NavLink
              to={CREATE_CTA_HREF}
              className="sb-cta"
              onClick={handleNavigate}
            >
              <Plus
                size={18}
                strokeWidth={1.75}
                aria-hidden
              />

              <span>{copy.cta}</span>
            </NavLink>
          )}
        </div>

        {/* Navegação */}
        <nav className="sb-nav">
          {sections.map((section) => (
            <div
              className="sb-section"
              key={section.label}
            >
              <p className="sb-section-label">
                {section.label}
              </p>

              {section.items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  collapsed={isCollapsed}
                  locked={isLocked(item)}
                  lockedHint={copy.lockedPlan}
                  onNavigate={handleNavigate}
                  onLockedClick={() =>
                    navigate("/dashboard/plans")
                  }
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Rodapé */}
        <div className="sb-foot">
          <SidebarCreditsCard copy={copy} />

          {(() => {
            const logoutButton = (
              <button
                type="button"
                className="sb-item"
                onClick={onLogout}
                aria-label={copy.logout}
              >
                <LogOut
                  className="sb-item-icon"
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden
                />

                <span className="sb-item-label">
                  {copy.logout}
                </span>
              </button>
            );

            return isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  {logoutButton}
                </TooltipTrigger>

                <TooltipContent side="right">
                  {copy.logout}
                </TooltipContent>
              </Tooltip>
            ) : (
              logoutButton
            );
          })()}
        </div>
      </aside>
    </>
  );
}

export default AppSidebar;
