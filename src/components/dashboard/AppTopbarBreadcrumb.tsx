/**
 * AppTopbarBreadcrumb — slim inline breadcrumb for the global topbar.
 *
 * Auto-derived from `useLocation().pathname`. Hub mode mostra
 * "Central › Imagens", "Central › Biblioteca". Click no parent
 * volta pro hub root. Último segmento é não-clicável (página atual).
 *
 * Tudo traduzido — LABELS é função do idioma atual (pt/en/es/zh).
 */
import { useLocation, Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const F = "'Plus Jakarta Sans', Inter, system-ui, sans-serif";

type Lang = "pt" | "en" | "es" | "zh";

// Labels traduzidos por idioma. Anything not here renders the raw
// segment (sentence-case) so we don't have to maintain every page.
function buildLabels(lang: Lang): Record<string, string> {
  const T: Record<string, [string, string, string, string]> = {
    feed:        ["Feed",         "Feed",         "Feed",         "动态"],
    ai:          ["Estrategista", "Strategist",   "Estratega",    "策略师"],
    history:     ["Histórico",    "History",      "Historial",    "历史"],
    accounts:    ["Contas",       "Accounts",     "Cuentas",      "账户"],
    settings:    ["Configurações","Settings",     "Configuración","设置"],
    billing:     ["Faturamento",  "Billing",      "Facturación",  "账单"],
    hooks:       ["Hooks",        "Hooks",        "Hooks",        "Hook"],
    script:      ["Roteiro",      "Script",       "Guión",        "脚本"],
    brief:       ["Brief",        "Brief",        "Brief",        "简报"],
    competitor:  ["Concorrente",  "Competitor",   "Competidor",   "竞品"],
    translate:   ["Traduzir",     "Translate",    "Traducir",     "翻译"],
    boards:      ["Boards",       "Boards",       "Tableros",     "看板"],
    campaigns:   ["Campanhas",    "Campaigns",    "Campañas",     "活动"],
    performance: ["Performance",  "Performance",  "Rendimiento",  "表现"],
    templates:   ["Templates",    "Templates",    "Plantillas",   "模板"],
    intelligence:["Inteligência", "Intelligence", "Inteligencia", "情报"],
    diary:       ["Diário",       "Diary",        "Diario",       "日记"],
    preflight:   ["Preflight",    "Preflight",    "Preflight",    "预检"],
    // Hub-native
    hub:         ["Central",      "Central",      "Central",      "中心"],
    image:       ["Imagens",      "Images",       "Imágenes",     "图像"],
    library:     ["Biblioteca",   "Library",      "Biblioteca",   "资料库"],
  };
  const idx = lang === "en" ? 1 : lang === "es" ? 2 : lang === "zh" ? 3 : 0;
  const out: Record<string, string> = {};
  Object.entries(T).forEach(([k, v]) => { out[k] = v[idx]; });
  return out;
}

function rootLabel(lang: Lang): string {
  return lang === "en" ? "Command" : lang === "es" ? "Comando" : lang === "zh" ? "指挥台" : "Comando";
}

function rootPathFor(pathname: string): string {
  if (pathname.startsWith("/dashboard/hub")) return "/dashboard/hub";
  return "/dashboard/feed";
}

function pretty(seg: string, labels: Record<string, string>): string {
  if (labels[seg]) return labels[seg];
  const s = seg.replace(/-/g, " ").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AppTopbarBreadcrumb() {
  const { pathname } = useLocation();
  const { language } = useLanguage();
  const lang = (language as Lang) || "pt";
  const LABELS = buildLabels(lang);
  const ROOT = rootLabel(lang);

  const segments = pathname
    .replace(/^\/dashboard\/?/, "")
    .split("/")
    .filter(Boolean);

  // Hub root = `/dashboard/hub`. Quando segmentos = ["hub"] não mostra
  // breadcrumb. Outras rotas sem segmentos também escondem.
  if (segments.length === 0) return null;
  if (segments.length === 1 && segments[0] === "hub") return null;

  // Pra rotas /dashboard/hub/*, o "hub" segment é redundante (root já
  // aponta pra /dashboard/hub). Tira ele do crumb.
  const filtered = pathname.startsWith("/dashboard/hub")
    ? segments.filter((s, i) => !(i === 0 && s === "hub"))
    : segments;

  if (filtered.length === 0) return null;

  const sep = (
    <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, padding: "0 1px", lineHeight: 1 }}>›</span>
  );

  const last = filtered[filtered.length - 1];
  const intermediate = filtered.slice(0, -1);

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
        to={rootPathFor(pathname)}
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
        {ROOT}
      </Link>
      {intermediate.map((seg, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {sep}
          <span style={{ color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>{pretty(seg, LABELS)}</span>
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
        >{pretty(last, LABELS)}</span>
      </span>
    </nav>
  );
}
