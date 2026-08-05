import { NavLink, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SidebarItem } from "./sidebarConfig";

export function isItemActive(pathname: string, item: SidebarItem): boolean {
  if (item.exact) return pathname === item.href || pathname === item.href + "/";
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

interface Props {
  item: SidebarItem;
  collapsed: boolean;
  locked?: boolean;
  lockedHint?: string;
  onNavigate?: () => void;
  onLockedClick?: () => void;
}

export function SidebarNavItem({ item, collapsed, locked, lockedHint, onNavigate, onLockedClick }: Props) {
  const { pathname } = useLocation();
  const active = isItemActive(pathname, item);
  const Icon = item.icon;

  const inner = (
    <>
      <Icon className="sb-item-icon" size={18} strokeWidth={1.75} aria-hidden />
      <span className="sb-item-label">{item.label}</span>
      {locked && (
        <span className="sb-item-badge" aria-hidden>
          <Lock size={13} strokeWidth={1.75} />
        </span>
      )}
    </>
  );

  const node = locked ? (
    <button
      type="button"
      className="sb-item"
      data-locked="true"
      aria-label={`${item.label} — ${lockedHint ?? ""}`.trim()}
      onClick={() => { onLockedClick?.(); onNavigate?.(); }}
    >
      {inner}
    </button>
  ) : (
    <NavLink
      to={item.href}
      end={item.exact}
      className="sb-item"
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      {inner}
    </NavLink>
  );

  if (!collapsed) {
    if (!locked) return node;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="right">{lockedHint}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{node}</TooltipTrigger>
      <TooltipContent side="right">
        {item.label}{locked && lockedHint ? ` — ${lockedHint}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}
