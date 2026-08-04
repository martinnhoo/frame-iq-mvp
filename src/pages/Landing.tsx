/**
 * Landing de conversão — 03/08/2026
 *
 * Escrita depois da reestruturação do produto, de propósito: uma landing que
 * promete algo que a interface não entrega é a forma mais cara de comprar
 * churn.
 *
 * Estrutura: promessa → dor específica → como funciona em 3 passos → prova →
 * preço → objeções → garantia → CTA. Cada seção existe para derrubar uma
 * objeção concreta, na ordem em que ela aparece na cabeça de quem lê.
 *
 * Preços vêm de src/lib/hubPlans.ts — fonte única, para a landing nunca
 * divergir do que o checkout cobra.
 */
import { useState } from "react";
import * as D from "@/lib/design";
import HeroDemo from "@/components/landing/HeroDemo";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Check, ArrowRight, Sparkles, Clock, Wallet, Layers,
  Mic, Video, ImageIcon, ShieldCheck, Zap, ChevronDown,
} from "lucide-react";
import { HUB_PLANS, CREDIT_COSTS, type PlanKey } from "@/lib/hubPlans";

// Tudo vem do design.ts. Antes a landing tinha o próprio tema — Inter contra
// Plus Jakarta do app, #0ea5e9 contra #3B82F6, outro preto de fundo — e quem
// clicava em "Começar grátis" trocava de marca no meio do caminho.
const T = {
  bg0: D.color.canvas, bg1: D.color.surface, bg2: D.color.raised, bg3: D.color.raised,
  b1: D.color.border, b2: D.color.borderHover,
  t1: D.color.text, t2: D.color.text2, t3: D.color.text3,
  blue: D.color.accent, green: D.color.success, purple: "#A78BFA", amber: D.color.warning,
  label: D.color.text3,
};

const F = D.font.family;
const ORDER: PlanKey[] = ["creator", "pro", "studio"];

export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div style={{ background: T.bg0, color: T.t1, fontFamily: F, minHeight: "100vh" }}>
      <style>{`
        @media (max-width: 900px) {
          .hero-split { grid-template-columns: 1fr !important; gap: 32px !important; }
        }
      `}</style>
      <Helmet>
        <title>AdBrief — criativo de anúncio pronto em minutos</title>
        <meta name="description" content="Descreva o anúncio em uma frase e receba imagem, vídeo, legenda e variações com a cara da sua marca. A partir de R$ 97/mês." />
        <link rel="canonical" href="https://adbrief.pro/" />
      </Helmet>

      {/* ── Topo ────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(8,11,17,0.82)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.b1}`,
      }}>
        <Wrap style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 22px" }}>
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>AdBrief</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="#precos" style={{ fontSize: 13, color: T.t2, textDecoration: "none" }}>Preços</a>
            <Link to="/login" style={{ fontSize: 13, color: T.t2, textDecoration: "none" }}>Entrar</Link>
            <Link to="/signup" style={btnPrimary}>Começar grátis</Link>
          </div>
        </Wrap>
      </nav>

      {/* ── Herói ───────────────────────────────────────────────────────── */}
      <Section>
        <Wrap style={{ padding: "64px 22px 52px" }}>
          {/* Duas colunas: promessa à esquerda, produto à direita. A versão
              anterior era texto centralizado num maxWidth de 820 — estrutura
              de landing de newsletter, sem nada pra ver. */}
          <div className="hero-split" style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.05fr)",
            gap: 44, alignItems: "center",
          }}>
            <div>
              <Badge>Feito para quem anuncia no Brasil</Badge>

              <h1 style={{
                fontSize: "clamp(30px, 4.4vw, 50px)", fontWeight: 800,
                lineHeight: 1.08, letterSpacing: "-0.035em", margin: "18px 0 0",
              }}>
                Descreva o anúncio em uma frase.<br />
                <span style={{ color: T.blue }}>Ele sai pronto pra subir.</span>
              </h1>

              <p style={{ fontSize: 16.5, color: T.t2, lineHeight: 1.6, margin: "18px 0 0", maxWidth: 520 }}>
                Imagem, vídeo, legenda e variações para teste — com o logo, as cores
                e o jeito de falar da sua marca. Sem briefing, sem designer parado,
                sem esperar três dias.
              </p>

              {/* Um CTA. O "Ver como funciona" tinha o mesmo peso visual do
                  botão de cadastro e só rolava a página — roubava clique do
                  CTA real pra entregar menos. Virou link discreto. */}
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 28, flexWrap: "wrap" }}>
                <Link to="/signup" style={{ ...btnPrimary, padding: "14px 28px", fontSize: 15.5 }}>
                  Criar meu primeiro criativo <ArrowRight size={16} />
                </Link>
                <a href="#como" style={{ fontSize: 14, color: T.t3, textDecoration: "none", borderBottom: `1px solid ${T.b2}`, paddingBottom: 2 }}>
                  ou veja como funciona
                </a>
              </div>

              <p style={{ fontSize: 12.5, color: T.t3, marginTop: 16 }}>
                Grátis para testar · sem cartão · locução ilimitada em todos os planos
              </p>
            </div>

            <HeroDemo />
          </div>
        </Wrap>
      </Section>

      {/* ── A dor ───────────────────────────────────────────────────────── */}
      <Section bg={T.bg1}>
        <Wrap style={{ padding: "58px 22px" }}>
          <H2>Você não precisa de mais uma ferramenta de IA</H2>
          <P center>
            Precisa de criativo novo toda semana. E o que trava não é a ideia —
            é o caminho entre ela e o arquivo pronto.
          </P>

          <Grid min={250} style={{ marginTop: 34 }}>
            <Pain icon={<Clock size={17} />} title="O criativo trava a campanha">
              A campanha está pronta, o público definido, o orçamento aprovado —
              e você esperando a arte. Enquanto isso o concorrente já testou
              três ângulos.
            </Pain>
            <Pain icon={<Wallet size={17} />} title="Designer por peça não escala">
              R$ 80 a R$ 300 por criativo. Testar cinco variações de um anúncio
              custa mais que o próprio anúncio — então você não testa, e roda
              no escuro.
            </Pain>
            <Pain icon={<Layers size={17} />} title="IA genérica não conhece sua marca">
              Você reexplica cor, tom e público a cada prompt. E o resultado
              sai com cara de banco de imagem, não da sua marca.
            </Pain>
          </Grid>
        </Wrap>
      </Section>

      {/* ── Como funciona ───────────────────────────────────────────────── */}
      <Section id="como">
        <Wrap style={{ padding: "62px 22px" }}>
          <H2>Três passos. O primeiro leva dois minutos.</H2>
          <P center>Depois disso, criativo novo é questão de segundos.</P>

          <div style={{ display: "grid", gap: 14, marginTop: 36 }}>
            <Step n={1} title="Cadastre sua marca — uma vez só">
              Nome, logo, cores, tom de voz, o que nunca pode aparecer.
              Suba prints do seu site ou de anúncios que já funcionaram: a IA
              usa como referência visual de verdade, não como descrição.
              <Aside>Feito uma vez, vale em toda geração daí em diante.</Aside>
            </Step>
            <Step n={2} title="Escolha o objetivo">
              Anúncio de produto, oferta, prova social, antes e depois,
              Stories. Um clique preenche o texto, o formato e a qualidade.
              <Aside>Você edita o que quiser — mas não começa da folha em branco.</Aside>
            </Step>
            <Step n={3} title="Gere, ajuste e leve pro anúncio">
              Do resultado, um clique tira o fundo, troca o rosto, transforma
              em vídeo ou escreve a legenda. Tudo continua na mesma tela.
              <Aside>Baixe e suba no Gerenciador. Sem exportar, converter, renomear.</Aside>
            </Step>
          </div>
        </Wrap>
      </Section>

      {/* ── O que entra ─────────────────────────────────────────────────── */}
      <Section bg={T.bg1}>
        <Wrap style={{ padding: "58px 22px" }}>
          <H2>Tudo que um criativo precisa, num lugar só</H2>
          <Grid min={215} style={{ marginTop: 32 }}>
            <Feat icon={<ImageIcon size={16} />} t="Imagem" d="Do rascunho barato pra testar ideia até a arte final em alta." />
            <Feat icon={<Video size={16} />} t="Vídeo" d="Anime uma imagem ou gere do zero. 5 ou 10 segundos, com áudio." />
            <Feat icon={<Mic size={16} />} t="Locução" d="Vozes brasileiras de verdade. Ilimitada, sem consumir crédito." highlight />
            <Feat icon={<Layers size={16} />} t="Fundo transparente" d="PNG recortado pro produto entrar em qualquer arte." />
            <Feat icon={<Sparkles size={16} />} t="Variações A/B" d="Três versões do mesmo anúncio pra descobrir qual converte." />
            <Feat icon={<Zap size={16} />} t="Legenda e roteiro" d="O texto que acompanha o criativo, no tom da sua marca." />
          </Grid>

          <div style={{
            marginTop: 26, padding: "15px 18px", borderRadius: 11,
            background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.22)",
            display: "flex", gap: 12, alignItems: "flex-start",
          }}>
            <Mic size={17} color={T.green} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 13.5, color: T.t2, lineHeight: 1.55 }}>
              <strong style={{ color: T.t1 }}>Locução é ilimitada e não gasta crédito.</strong>{" "}
              Em qualquer plano, inclusive no grátis. Você ouve a voz antes de
              escolher, e narra quantos roteiros quiser.
            </div>
          </div>
        </Wrap>
      </Section>

      {/* ── Preços ──────────────────────────────────────────────────────── */}
      <Section id="precos">
        <Wrap style={{ padding: "62px 22px" }}>
          <H2>Preço que cabe em quem está começando</H2>
          <P center>
            Você gasta crédito só quando gera. Testar ideia em rascunho custa
            uma fração do render final — então dá pra errar à vontade.
          </P>

          <div style={{
            display: "grid", gap: 13, marginTop: 34,
            gridTemplateColumns: "repeat(auto-fit, minmax(255px, 1fr))",
          }}>
            {ORDER.map(key => {
              const p = HUB_PLANS[key];
              const featured = !!p.highlight;
              const videos = Math.floor(p.credits / CREDIT_COSTS.video_final_5s);
              const imgs = Math.floor(p.credits / CREDIT_COSTS.image_standard);
              return (
                // O card em destaque se diferenciava por 1px de borda azul e
                // 2px na esquerda. Num scan de 2 segundos os três eram o mesmo
                // objeto — e o destaque existe justamente pra decidir por quem
                // não quer decidir.
                <div key={key} style={{
                  background: featured ? T.bg2 : T.bg1,
                  border: `1px solid ${featured ? D.color.accentBorder : T.b1}`,
                  borderRadius: D.radius.md,
                  padding: featured ? 28 : 22,
                  position: "relative",
                  boxShadow: featured ? D.shadow.raised : D.shadow.card,
                  transform: featured ? "scale(1.03)" : "none",
                  zIndex: featured ? 1 : 0,
                }}>
                  {featured && (
                    <span style={{
                      position: "absolute", top: -10, left: 22,
                      fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em",
                      textTransform: "uppercase", color: "#fff",
                      background: T.blue, borderRadius: 5, padding: "3px 9px",
                    }}>Mais escolhido</span>
                  )}
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{p.label}</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5, margin: "8px 0 3px" }}>
                    {/* 32px não ancora nada. O preço é a informação que a
                        pessoa veio buscar nesta seção. */}
                    <span style={{
                      fontSize: D.font.size.display, fontWeight: 800,
                      letterSpacing: D.font.tracking.display,
                      fontVariantNumeric: "tabular-nums",
                    }}>
                      R$ {p.brl}
                    </span>
                    <span style={{ fontSize: 13, color: T.t3 }}>/mês</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: T.t3, marginBottom: 17 }}>
                    {p.credits} créditos por mês
                  </div>

                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px" }}>
                    <Li>{videos} vídeos <span style={{ color: T.t3 }}>ou</span> {imgs} imagens</Li>
                    <Li>Locução ilimitada</Li>
                    <Li>{p.brands === -1 ? "Marcas ilimitadas" : `${p.brands} marca${p.brands > 1 ? "s" : ""}`}</Li>
                    <Li>{p.proVideo ? "Vídeo em 1080p" : "Vídeo em 720p"}</Li>
                    <Li>Sem marca d'água</Li>
                    {p.workflows > 0 && <Li>{p.workflows} automações salvas</Li>}
                    {p.workflows === -1 && <Li>Automações ilimitadas</Li>}
                  </ul>

                  <Link to="/signup" style={{
                    ...(featured ? btnPrimary : btnGhost),
                    width: "100%", justifyContent: "center", padding: "11px 14px",
                  }}>
                    Começar
                  </Link>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 12.5, color: T.t3, textAlign: "center", marginTop: 18 }}>
            Plano grátis para testar, sem cartão. Cancele quando quiser, direto no painel.
          </p>

          {/* Tabela de custo — transparência antecipa a objeção "vou gastar sem ver" */}
          <div style={{ maxWidth: 520, margin: "30px auto 0" }}>
            <div style={{ ...labelStyle, textAlign: "center", marginBottom: 10 }}>
              Quanto custa cada coisa
            </div>
            <div style={{ background: T.bg1, border: `1px solid ${T.b1}`, borderRadius: 11, overflow: "hidden" }}>
              {[
                ["Locução, de qualquer tamanho", "grátis"],
                ["Imagem em rascunho", "1 crédito"],
                ["Imagem final", "4 créditos"],
                ["Vídeo de 5 segundos", "40 créditos"],
                ["Tirar fundo · trocar rosto", "5 · 3 créditos"],
                ["Legenda, roteiro, variação", "1 crédito"],
              ].map(([k, v], i) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between", padding: "10px 15px",
                  fontSize: 12.5, borderTop: i === 0 ? "none" : `1px solid ${T.b1}`,
                }}>
                  <span style={{ color: T.t2 }}>{k}</span>
                  <span style={{ color: v === "grátis" ? T.green : T.t1, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </Wrap>
      </Section>

      {/* ── Objeções ────────────────────────────────────────────────────── */}
      <Section bg={T.bg1}>
        <Wrap style={{ padding: "58px 22px", maxWidth: 720 }}>
          <H2>Perguntas que todo mundo faz</H2>
          <div style={{ marginTop: 28 }}>
            {FAQ.map((f, i) => (
              <div key={i} style={{ borderBottom: `1px solid ${T.b1}` }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{
                    width: "100%", display: "flex", justifyContent: "space-between",
                    alignItems: "center", gap: 14, padding: "16px 0",
                    background: "transparent", border: "none", cursor: "pointer",
                    color: T.t1, fontSize: 14.5, fontWeight: 600, textAlign: "left",
                    fontFamily: F,
                  }}
                >
                  {f.q}
                  <ChevronDown
                    size={16} color={T.t3}
                    style={{
                      flexShrink: 0,
                      transform: openFaq === i ? "rotate(180deg)" : "none",
                      transition: "transform .18s",
                    }}
                  />
                </button>
                {openFaq === i && (
                  <p style={{
                    margin: "0 0 17px", fontSize: 13.5, color: T.t2,
                    lineHeight: 1.65, paddingRight: 28,
                  }}>{f.a}</p>
                )}
              </div>
            ))}
          </div>
        </Wrap>
      </Section>

      {/* ── Fechamento ──────────────────────────────────────────────────── */}
      <Section>
        <Wrap style={{ padding: "68px 22px", textAlign: "center", maxWidth: 660 }}>
          <ShieldCheck size={26} color={T.green} />
          <h2 style={{
            fontSize: "clamp(24px, 3.6vw, 34px)", fontWeight: 800,
            letterSpacing: "-0.03em", margin: "16px 0 0", lineHeight: 1.15,
          }}>
            Teste sem colocar cartão
          </h2>
          <p style={{ fontSize: 15.5, color: T.t2, lineHeight: 1.6, margin: "14px auto 0", maxWidth: 500 }}>
            Cadastre sua marca, gere seu primeiro criativo e veja se serve pra
            você. Se assinar e mudar de ideia, tem 7 dias para cancelar e
            receber o valor de volta — é seu direito, e a gente cumpre.
          </p>
          <Link to="/signup" style={{ ...btnPrimary, padding: "14px 30px", fontSize: 15.5, marginTop: 26 }}>
            Criar meu primeiro criativo <ArrowRight size={16} />
          </Link>
          <p style={{ fontSize: 12, color: T.t3, marginTop: 13 }}>
            Leva dois minutos até o primeiro resultado
          </p>
        </Wrap>
      </Section>

      <footer style={{ borderTop: `1px solid ${T.b1}`, padding: "26px 22px" }}>
        <Wrap style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12.5, color: T.t3 }}>© 2026 AdBrief</span>
          <div style={{ display: "flex", gap: 16 }}>
            <Link to="/terms" style={{ fontSize: 12.5, color: T.t3, textDecoration: "none" }}>Termos</Link>
            <Link to="/privacy" style={{ fontSize: 12.5, color: T.t3, textDecoration: "none" }}>Privacidade</Link>
            <a href="mailto:suporte@adbrief.pro" style={{ fontSize: 12.5, color: T.t3, textDecoration: "none" }}>Suporte</a>
          </div>
        </Wrap>
      </footer>
    </div>
  );
}

/* ── Conteúdo ──────────────────────────────────────────────────────────── */

const FAQ = [
  {
    q: "Preciso saber escrever prompt?",
    a: "Não. Você escolhe um objetivo — anúncio de produto, oferta, prova social — e o texto já vem pronto. Se quiser mexer, mexe; se não quiser, é só gerar. A maior parte das pessoas nunca edita.",
  },
  {
    q: "O criativo sai com a cara da minha marca ou genérico?",
    a: "Você cadastra a marca uma vez: logo, cores, tom de voz, o que nunca pode aparecer, e prints de anúncios que já funcionaram. Esses prints entram como referência visual de verdade na geração — é isso que separa o resultado de uma IA genérica.",
  },
  {
    q: "Se eu gerar e não gostar, perco o crédito?",
    a: "Se a geração falhar, o crédito volta automático. Se ela funcionar mas você não gostar do resultado, o crédito foi usado — por isso o rascunho existe e custa 1 crédito. Teste barato, finalize caro.",
  },
  {
    q: "Quantos vídeos eu consigo fazer por mês?",
    a: "No Creator, 12. No Pro, 30. No Studio, 65. Há também um limite diário para o serviço não cair quando alguém dispara tudo de uma vez — sua fila nunca fica atrás da de outro cliente.",
  },
  {
    q: "As vozes são em português mesmo?",
    a: "Sim, e brasileiras. Você ouve uma amostra antes de escolher, sem gastar nada. A locução não consome crédito em nenhum plano — inclusive no grátis.",
  },
  {
    q: "Posso usar os criativos comercialmente?",
    a: "Sim, em qualquer plano pago. O plano grátis gera em qualidade de rascunho e com marca d'água, para você avaliar antes de decidir.",
  },
  {
    q: "E se eu quiser cancelar?",
    a: "Cancela no painel, sem falar com ninguém. O acesso continua até o fim do período já pago. E se cancelar em até 7 dias da assinatura, devolvemos o valor integral — Código de Defesa do Consumidor, artigo 49.",
  },
];

/* ── Componentes ───────────────────────────────────────────────────────── */

function Wrap({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ maxWidth: 1080, margin: "0 auto", ...style }}>{children}</div>;
}

function Section({ children, bg, id }: { children: React.ReactNode; bg?: string; id?: string }) {
  return <section id={id} style={{ background: bg || "transparent" }}>{children}</section>;
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: "clamp(24px, 3.4vw, 34px)", fontWeight: 800,
      letterSpacing: "-0.03em", lineHeight: 1.15, textAlign: "center", margin: 0,
    }}>{children}</h2>
  );
}

function P({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <p style={{
      fontSize: 15.5, color: T.t2, lineHeight: 1.6,
      textAlign: center ? "center" : "left",
      margin: "13px auto 0", maxWidth: 580,
    }}>{children}</p>
  );
}

function Grid({ children, min, style }: { children: React.ReactNode; min: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      display: "grid", gap: 13,
      gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
      ...style,
    }}>{children}</div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-block", fontSize: 11, fontWeight: 700,
      letterSpacing: "0.05em", textTransform: "uppercase", color: T.blue,
      background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.26)",
      borderRadius: 100, padding: "6px 13px",
    }}>{children}</span>
  );
}

function Pain({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.b1}`, borderRadius: 12, padding: 19 }}>
      <div style={{ color: T.amber, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 7 }}>{title}</div>
      <div style={{ fontSize: 13, color: T.t2, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", gap: 16, background: T.bg1,
      border: `1px solid ${T.b1}`, borderLeft: `2px solid ${T.blue}`,
      borderRadius: 12, padding: "20px 22px",
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        background: "rgba(14,165,233,0.14)", color: T.blue,
        display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800,
      }}>{n}</div>
      <div>
        <div style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 13.5, color: T.t2, lineHeight: 1.62 }}>{children}</div>
      </div>
    </div>
  );
}

function Aside({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, color: T.t3, marginTop: 8, fontStyle: "italic" }}>
      {children}
    </div>
  );
}

function Feat({ icon, t, d, highlight }: { icon: React.ReactNode; t: string; d: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? "rgba(74,222,128,0.05)" : T.bg2,
      border: `1px solid ${highlight ? "rgba(74,222,128,0.2)" : T.b1}`,
      borderRadius: 11, padding: 17,
    }}>
      <div style={{ color: highlight ? T.green : T.blue, marginBottom: 9 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 5 }}>{t}</div>
      <div style={{ fontSize: 12.5, color: T.t2, lineHeight: 1.55 }}>{d}</div>
    </div>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      fontSize: 13, color: T.t2, marginBottom: 9, lineHeight: 1.45,
    }}>
      <Check size={13} color={T.green} style={{ marginTop: 3, flexShrink: 0 }} />
      <span>{children}</span>
    </li>
  );
}

/* ── Estilos ───────────────────────────────────────────────────────────── */

const btnPrimary: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7,
  padding: "9px 17px", borderRadius: 9, border: "none",
  background: T.blue, color: "#fff", fontSize: 13.5, fontWeight: 700,
  textDecoration: "none", cursor: "pointer", fontFamily: F,
};

const btnGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7,
  padding: "9px 17px", borderRadius: 9,
  border: `1px solid ${T.b2}`, background: "transparent",
  color: T.t1, fontSize: 13.5, fontWeight: 600,
  textDecoration: "none", cursor: "pointer", fontFamily: F,
};

const labelStyle: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: T.label,
};
