/**
 * AppTopbarBreadcrumb — slim inline breadcrumb for the global topbar.
 *
 * Auto-derived from `useLocation().pathname`. Shows "Comando › Feed",
 * "Comando › Estrategista", etc. Click on the parent (Comando)
 * navigates to the feed root. Last segment is non-clickable (current
 * page).
 *
 * Lives in dash-topbar between the logo/hamburger and the credit meter
 * spacer. Always desktop-visible; on mobile it auto-hides under 640px
 * to save horizontal space (sidebar toggle covers nav anyway).
 */
import { useLocation, Link } from "react-router-dom";

const F = "'Plus Jakarta Sans', Inter, system-ui, sans-serif";

// Routes the user actually sees. Anything not in here renders the raw
// segment (sentence-case) so we don't have to maintain every page.
const LABELS: Record<string, string> = {
  feed: "Feed",
  ai: "Estrategista",
  history: "Histórico",
  accounts: "Contas",
  settings: "Configurações",
  billing: "Faturamento",
  // Tools / generators
  hooks: "Hooks",
  script: "Roteiro",
  brief: "Brief",
  competitor: "Concorrente",
  translate: "Traduzir",
  boards: "Boards",
  campaigns: "Campanhas",
  performance: "Performance",
  templates: "Templates",
  intelligence: "Inteligência",
  diary: "Diário",
  preflight: "Preflight",
};

const ROOT_LABEL = "Comando";
const ROOT_PATH = "/dashboard/feed";

function pretty(seg: string): string {
  if (LABELS[seg]) return LABELS[seg];
  // Fallback: replace dashes, sentence-case
  const s = seg.replace(/-/g, " ").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AppTopbarBreadcrumb() {
  const { pathname } = useLocation();
  // Strip the leading /dashboard/. If path is /dashboard or /dashboard/
  // (root), show only "Comando".
  const segments = pathname
    .replace(/^\/dashboard\/?/, "")
    .split("/")
    .filter(Boolean);

  // No segments → not on a sub-route, hide breadcrumb (keeps topbar quiet).
  if (segments.length === 0) return null;

  const sep = (
    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, padding: "0 1px", lineHeight: 1 }}>›</span>
  );

  const last = segments[segments.length - 1];
  const intermediate = segments.slice(0, -1);

  return (
    <nav
      aria-label="Breadcrumb"
      className="hidden sm:flex"
      style={{
        alignItems: "center",
        gap: 6,
        fontFamily: F,
        fontSize: 12.5,
        flexShrink: 1,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <Link
        to={ROOT_PATH}
        style={{
          color: "rgba(255,255,255,0.55)",
          textDecoration: "none",
          fontWeight: 500,
          transition: "color 0.12s",
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.85)"}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"}
      >
        {ROOT_LABEL}
      </Link>
      {intermediate.map((seg, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {sep}
          <span style={{ color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>{pretty(seg)}</span>
        </span>
      ))}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        {sep}
        <span
          style={{
            color: "rgba(255,255,255,0.92)",
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >{pretty(last)}</span>
      </span>
    </nav>
  );
}
