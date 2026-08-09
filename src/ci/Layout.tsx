/**
 * Layout do Creative Intelligence — lateral + barra de status, em toda tela.
 *
 * ── A navegação passou a ser agrupada ─────────────────────────────────────
 * A lista era plana e misturava três coisas diferentes: de onde o dado vem
 * (Marcas, Anúncios), o que você aprende com ele (Receitas, Hooks, Produtos,
 * Pessoas) e se dá para confiar nele (Qualidade, Saúde). Oito itens seguidos
 * sem hierarquia obrigam a ler todos toda vez.
 *
 * Agora são três blocos com título. O do meio — ENTENDER — é onde o produto
 * mora, e é o único que fica aberto por padrão na leitura visual: os outros
 * dois têm cabeçalho discreto e servem de apoio.
 *
 * ── O logo ────────────────────────────────────────────────────────────────
 * Estava escrito à mão como texto roxo, enquanto o resto do app tem um
 * componente Logo de verdade — "ad" claro + "brief" em gradiente. Duas marcas
 * no mesmo produto é pior que uma marca feia: quem entra em /ci não reconhece
 * onde está.
 */
import { Logo, LogoMark } from "@/components/Logo";
import { BarraStatus } from "./BarraStatus";
import { T, F, I, Ic } from "@/ci/tema";




type Item = { id: string; pt: string; en: string; icon: string; href: string | null; pronto?: boolean };

/**
 * Os três grupos, na ordem em que se usa o produto: primeiro o que entra,
 * depois o que se aprende, por último se dá para acreditar.
 */
export const GRUPOS_CI: { pt: string; en: string; itens: Item[] }[] = [
  {
    pt: "Entrada", en: "Input",
    itens: [
      { id: "marcas",   pt: "Marcas",   en: "Brands", icon: I.brand, href: "/importar" },
      { id: "anuncios", pt: "Anúncios", en: "Ads",    icon: I.ads,   href: "/shapermint" },
    ],
  },
  {
    pt: "Entender", en: "Understand",
    itens: [
      { id: "overview", pt: "Visão geral", en: "Overview", icon: I.home,    href: "/ci" },
      { id: "receitas", pt: "Receitas",    en: "Recipes",  icon: I.recipe,  href: "/ci/receitas" },
      { id: "hooks",    pt: "Hooks",       en: "Hooks",    icon: I.hook,    href: "/ci/hooks" },
      { id: "produtos", pt: "Produtos",    en: "Products", icon: I.product, href: "/ci/produtos" },
      { id: "pessoas",  pt: "Pessoas",     en: "People",   icon: I.person,  href: "/ci/pessoas" },
    ],
  },
  {
    pt: "Confiar", en: "Trust",
    itens: [
      { id: "qualidade",  pt: "Qualidade",  en: "Quality", icon: I.check,  href: "/ci/qualidade" },
      { id: "saude",      pt: "Saúde",      en: "Health",  icon: I.shield, href: "/ci/saude" },
      { id: "relatorios", pt: "Relatórios", en: "Reports", icon: I.report, href: "/ci/relatorio" },
    ],
  },
];

/** Compatibilidade com quem importava a lista plana. */
export const NAV_CI = GRUPOS_CI.flatMap(g => g.itens);

export function LateralCI({ ativo, en = false }: { ativo: string; en?: boolean }) {
  const rotulo = (n: { pt: string; en: string }) => (en ? n.en : n.pt);

  return (
    <aside style={{
      width: 214, borderRight: `1px solid ${T.b1}`, padding: "20px 12px 16px",
      display: "flex", flexDirection: "column", gap: 22,
      position: "sticky", top: 0, height: "100vh", flexShrink: 0,
      background: T.bg0,
    }}>
      {/* ── Marca ──────────────────────────────────────────────────────── */}
      <a href="/ci" style={{
        display: "flex", alignItems: "center", gap: 10, padding: "0 8px",
        textDecoration: "none",
      }}>
        <LogoMark size={26} />
        <span style={{ display: "grid", gap: 1, lineHeight: 1.1 }}>
          <Logo size="md" />
          <span style={{
            fontSize: 9.6, letterSpacing: ".085em", textTransform: "uppercase",
            color: T.label, fontWeight: 640,
          }}>Creative Intelligence</span>
        </span>
      </a>

      {/* ── Grupos ─────────────────────────────────────────────────────── */}
      <nav style={{ display: "grid", gap: 18, overflowY: "auto" }}>
        {GRUPOS_CI.map(grupo => (
          <div key={grupo.pt} style={{ display: "grid", gap: 2 }}>
            <div style={{
              fontSize: 9.4, letterSpacing: ".1em", textTransform: "uppercase",
              color: T.label, fontWeight: 700, padding: "0 11px 5px",
            }}>{rotulo(grupo)}</div>

            {grupo.itens.map(n => {
              const sel = n.id === ativo;
              const corpo = (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "7px 11px", borderRadius: 8, fontSize: 13.2,
                  background: sel ? "rgba(139,92,246,.13)" : "transparent",
                  color: sel ? T.t1 : n.href ? T.t2 : T.label,
                  cursor: n.href ? "pointer" : "default",
                  position: "relative",
                }}>
                  {/* Barra à esquerda em vez de borda em volta: a borda cheia
                      desalinha o texto do item ativo em 1px em relação aos
                      outros, e o olho percebe mesmo sem saber o quê. */}
                  {sel && (
                    <span style={{
                      position: "absolute", left: 0, top: 6, bottom: 6, width: 2.5,
                      borderRadius: 2, background: T.violet,
                    }} />
                  )}
                  <Ic d={n.icon} s={15.5} c={sel ? T.violet : "currentColor"} />
                  <span style={{ flex: 1 }}>{rotulo(n)}</span>
                  {n.pronto === false && (
                    <span style={{ fontSize: 8.8, color: T.violet, opacity: .8 }}>
                      {en ? "soon" : "em breve"}
                    </span>
                  )}
                </div>
              );
              return n.href
                ? <a key={n.id} href={n.href} style={{ textDecoration: "none" }}>{corpo}</a>
                : <div key={n.id}>{corpo}</div>;
            })}
          </div>
        ))}
      </nav>

      {/* ── O rodapé é a regra do produto ──────────────────────────────── */}
      {/*
        Fica na lateral, visível em toda tela, porque é a frase que impede a
        leitura errada de tudo que está à direita. Num painel cheio de números,
        alguém sempre vai supor que barra grande significa "funcionou melhor".
      */}
      <div style={{
        marginTop: "auto", padding: "12px 11px 0", borderTop: `1px solid ${T.b1}`,
        fontSize: 10.8, color: T.t3, lineHeight: 1.5,
      }}>
        {en
          ? "Public repetition signal. Not spend, impressions or ROAS."
          : "Sinal público de repetição. Não é gasto, impressão nem ROAS."}
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
