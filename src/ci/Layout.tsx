/**
 * Layout do Creative Intelligence — lateral + barra de status, em toda tela.
 *
 * ── Por que existe ────────────────────────────────────────────────────────
 * A lateral existia só em /ci. Abrir Receitas, Qualidade ou Saúde jogava o
 * usuário numa página solta com um "← Visão geral" no canto — sem saber onde
 * estava, o que mais havia, nem se o worker estava trabalhando. Navegar exigia
 * voltar ao começo toda vez.
 *
 * ── A decisão de manter os "em breve" visíveis ────────────────────────────
 * Hooks, Pessoas, Produtos e Relatórios aparecem na lista mesmo sem existir,
 * marcados. Esconder o que falta faria o produto parecer completo e, pior,
 * esconderia de mim mesmo o que ainda não entreguei. A lista é o mapa combinado;
 * o selo diz onde ele ainda não virou estrada.
 */
import { BarraStatus } from "./BarraStatus";

const T = {
  bg0: "#080B11", bg1: "#0D1117",
  b1: "rgba(240,246,252,0.07)",
  t1: "#F0F6FC", t2: "rgba(240,246,252,0.72)", t3: "rgba(240,246,252,0.48)",
  label: "rgba(240,246,252,0.40)",
  violet: "#8B5CF6",
};
const F = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";

const I = {
  home: "M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  brand: "M4 4h16v16H4zM8 8h8v8H8z",
  ads: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5v8m-4-4h8",
  recipe: "M4 6h16M4 12h16M4 18h10",
  hook: "M13 2 4 14h6l-1 8 9-12h-6z",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0",
  product: "M20 7 12 3 4 7v10l8 4 8-4z",
  report: "M4 20V10m5 10V4m5 16v-7m5 7V8",
  check: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm-4-9 3 3 5-5",
  shield: "M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z",
};

const Ic = ({ d, s = 16, c = "currentColor" }: { d: string; s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.6}
       strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d={d} /></svg>
);

/** `pronto: false` = ainda não construído. Fica na lista, marcado. */
export const NAV_CI = [
  { id: "overview", pt: "Visão geral", en: "Overview",  icon: I.home,    href: "/ci",           pronto: true },
  { id: "marcas",   pt: "Marcas",      en: "Brands",    icon: I.brand,   href: "/importar",     pronto: true },
  { id: "anuncios", pt: "Anúncios",    en: "Ads",       icon: I.ads,     href: "/shapermint",   pronto: true },
  { id: "receitas", pt: "Receitas",    en: "Recipes",   icon: I.recipe,  href: "/ci/receitas",  pronto: true },
  { id: "hooks",    pt: "Hooks",       en: "Hooks",     icon: I.hook,    href: "/ci/hooks",     pronto: true },
  { id: "pessoas",  pt: "Pessoas",     en: "People",    icon: I.person,  href: null,            pronto: false },
  { id: "produtos", pt: "Produtos",    en: "Products",  icon: I.product, href: "/ci/produtos",  pronto: true },
  { id: "relatorios", pt: "Relatórios", en: "Reports",  icon: I.report,  href: "/ci/relatorio", pronto: true },
];

const RODAPE = [
  { id: "qualidade", pt: "Qualidade", en: "Quality", icon: I.check,  href: "/ci/qualidade" },
  { id: "saude",     pt: "Saúde",     en: "Health",  icon: I.shield, href: "/ci/saude" },
];

export function LateralCI({ ativo, en = false }: { ativo: string; en?: boolean }) {
  const rotulo = (n: { pt: string; en: string }) => (en ? n.en : n.pt);
  return (
    <aside style={{
      width: 215, borderRight: `1px solid ${T.b1}`, padding: "22px 13px",
      display: "flex", flexDirection: "column", position: "sticky", top: 0,
      height: "100vh", flexShrink: 0,
    }}>
      <a href="/ci" style={{ padding: "0 9px 20px", textDecoration: "none", color: T.t1 }}>
        <div style={{ fontSize: 22, fontWeight: 730, letterSpacing: "-.025em" }}>AdBrief</div>
        <div style={{ fontSize: 11.5, color: "#A78BFA", fontWeight: 570, marginTop: 1 }}>
          Creative Intelligence
        </div>
      </a>

      <nav style={{ display: "grid", gap: 3 }}>
        {NAV_CI.map(n => {
          const sel = n.id === ativo;
          const corpo = (
            <div style={{
              display: "flex", alignItems: "center", gap: 11, padding: "9px 11px",
              borderRadius: 9, fontSize: 13.5,
              background: sel ? "rgba(139,92,246,.13)" : "transparent",
              border: `1px solid ${sel ? "rgba(139,92,246,.28)" : "transparent"}`,
              color: sel ? T.t1 : n.pronto ? T.t2 : T.label,
              cursor: n.href ? "pointer" : "default",
            }}>
              <Ic d={n.icon} s={16} c={sel ? "#A78BFA" : "currentColor"} />
              <span style={{ flex: 1 }}>{rotulo(n)}</span>
              {!n.pronto && (
                <span style={{ fontSize: 9, color: "#A78BFA", opacity: .8 }}>
                  {en ? "soon" : "em breve"}
                </span>
              )}
            </div>
          );
          return n.href
            ? <a key={n.id} href={n.href} style={{ textDecoration: "none" }}>{corpo}</a>
            : <div key={n.id} title={en
                ? "Not built yet — it stays on the list so the gap is visible."
                : "Ainda não construído — fica na lista para o buraco ficar visível."}>{corpo}</div>;
        })}
      </nav>

      <div style={{ marginTop: "auto", display: "grid", gap: 7 }}>
        {RODAPE.map(n => {
          const sel = n.id === ativo;
          return (
            <a key={n.id} href={n.href} style={{
              display: "flex", alignItems: "center", gap: 9, padding: "8px 11px",
              borderRadius: 8, fontSize: 12.6, textDecoration: "none",
              color: sel ? T.t1 : T.t3,
              border: `1px solid ${sel ? "rgba(139,92,246,.28)" : T.b1}`,
              background: sel ? "rgba(139,92,246,.10)" : "transparent",
            }}>
              <Ic d={n.icon} s={14} c={sel ? "#A78BFA" : T.t3} /> {rotulo(n)}
            </a>
          );
        })}
      </div>
    </aside>
  );
}

/**
 * Envelope de página: lateral fixa, barra de status no topo do conteúdo.
 *
 * `larguraMax` porque as telas têm densidades diferentes — a de saúde é uma
 * lista estreita, a visão geral usa a largura toda. Forçar a mesma medida em
 * todas deixaria umas apertadas e outras com texto largo demais para ler.
 */
export function LayoutCI({ ativo, brandId, en = false, larguraMax = 1180, children }: {
  ativo: string;
  brandId?: string | null;
  en?: boolean;
  larguraMax?: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      minHeight: "100vh", background: T.bg0, color: T.t1, fontFamily: F, display: "flex",
    }}>
      <LateralCI ativo={ativo} en={en} />
      <main style={{ flex: 1, minWidth: 0 }}>
        <BarraStatus brandId={brandId} en={en} />
        <div style={{ maxWidth: larguraMax, margin: "0 auto", padding: "6px 22px 40px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
