/**
 * HeroDemo — a primeira dobra mostrando o produto, não descrevendo ele.
 *
 * A landing tinha 519 linhas e ZERO imagem ou vídeo. Um produto que gera
 * imagem e vídeo vendia sua promessa só em texto e ícones de 16px. O headline
 * diz "descreva o anúncio em uma frase, ele sai pronto pra subir" e o leitor
 * não via nenhum anúncio.
 *
 * Em vez de inventar um criativo de cliente — que seria prova falsa — isto
 * roda os três momentos reais da tela: a frase entrando, os estágios da
 * geração, e o resultado enquadrado no feed. O que aparece é a interface de
 * verdade, e é exatamente o que a pessoa vai encontrar depois de assinar.
 *
 * O slot da imagem final lê de SHOWCASE. Enquanto não houver criativos reais
 * ali, ele desenha um espaço que se identifica como tal — melhor um espaço
 * declarado vazio do que uma foto de banco de imagens fingindo ser saída do
 * produto.
 */

import { useEffect, useState } from "react";
import { Check, Loader, Heart, MessageCircle, Send, Bookmark, Sparkles } from "lucide-react";

/**
 * Criativos reais gerados pelo produto. Coloque os arquivos em
 * public/showcase/ e liste aqui — o hero passa a mostrar saída de verdade,
 * que é a prova que mais converte num produto visual.
 */
export const SHOWCASE: { src: string; goal: string }[] = [
  // { src: "/showcase/oferta.png",  goal: "Oferta / desconto" },
  // { src: "/showcase/produto.png", goal: "Anúncio de produto" },
];

const C = {
  panel: "#0F1218",
  inset: "#0A0C11",
  line: "rgba(255,255,255,0.08)",
  text: "#F2F4F8",
  text3: "rgba(255,255,255,0.42)",
  accent: "#3B82F6",
  success: "#34D399",
};

const PHRASE = "Anúncio de oferta do meu curso de inglês, urgência, espaço pro preço embaixo";
const STAGES = ["Preparando", "Gerando a imagem", "Aplicando marca e texto legal", "Salvando na sua biblioteca"];

export default function HeroDemo() {
  const [typed, setTyped] = useState(0);
  const [stage, setStage] = useState(-1);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));

    function cycle() {
      if (cancelled) return;
      setTyped(0); setStage(-1); setDone(false);

      let i = 0;
      const typing = window.setInterval(() => {
        i += 1;
        setTyped(i);
        if (i >= PHRASE.length) {
          window.clearInterval(typing);
          at(400, () => setStage(0));
          at(1400, () => setStage(1));
          at(3000, () => setStage(2));
          at(4000, () => setStage(3));
          at(4800, () => { setStage(4); setDone(true); });
          at(11000, cycle);
        }
      }, 28);
      timers.push(typing);
    }
    cycle();
    return () => { cancelled = true; timers.forEach(t => { window.clearTimeout(t); window.clearInterval(t); }); };
  }, []);

  const shot = SHOWCASE[0];

  return (
    <div className="hero-demo" style={{
      background: C.panel,
      border: `1px solid ${C.line}`,
      borderRadius: 16,
      boxShadow: "0 32px 80px -24px rgba(0,0,0,0.8)",
      overflow: "hidden",
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) minmax(0,300px)",
      minHeight: 380,
      textAlign: "left",
    }}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, borderRight: `1px solid ${C.line}` }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: "0.08em",
            textTransform: "uppercase", color: C.text3, marginBottom: 8,
          }}>
            Descreva o criativo
          </div>
          <div style={{
            background: C.inset, border: `1px solid ${C.line}`, borderRadius: 8,
            padding: 12, minHeight: 84, fontSize: 13.5, lineHeight: 1.55, color: C.text,
          }}>
            {PHRASE.slice(0, typed)}
            {typed < PHRASE.length && (
              <span style={{
                display: "inline-block", width: 2, height: 15, background: C.accent,
                verticalAlign: "text-bottom", animation: "heroCaret 1s steps(2) infinite",
              }} />
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 7, minHeight: 96 }}>
          {STAGES.map((label, i) => {
            const isDone = stage > i;
            const now = stage === i;
            if (stage < 0) return <div key={label} style={{ height: 18 }} />;
            return (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 12.5,
                color: now ? C.text : C.text3,
                opacity: !isDone && !now ? 0.4 : 1,
                transition: "opacity 260ms, color 260ms",
              }}>
                <span style={{ width: 15, display: "inline-flex", justifyContent: "center" }}>
                  {isDone ? <Check size={12} color={C.success} />
                    : now ? <Loader size={12} color={C.accent} style={{ animation: "spin 1s linear infinite" }} />
                    : <span style={{ width: 4, height: 4, borderRadius: 999, background: C.text3 }} />}
                </span>
                {label}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 8,
            background: C.accent, color: "#fff",
            fontSize: 13, fontWeight: 800,
          }}>
            <Sparkles size={13} /> Gerar imagem
            <span style={{ fontWeight: 600, opacity: 0.75 }}>· 4 créditos</span>
          </span>
        </div>
      </div>

      <div style={{
        padding: 20, display: "flex", alignItems: "center", justifyContent: "center",
        background: C.inset,
      }}>
        <div style={{
          width: "100%", maxWidth: 240,
          background: "#000", borderRadius: 12, overflow: "hidden",
          border: `1px solid ${C.line}`,
          opacity: done ? 1 : 0.28,
          filter: done ? "none" : "blur(6px)",
          transform: done ? "none" : "scale(0.985)",
          transition: "opacity 400ms, filter 400ms, transform 400ms",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: 8 }}>
            <span style={{
              width: 24, height: 24, borderRadius: 999,
              background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.42)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: C.accent,
            }}>M</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>suamarca</div>
              <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.5)" }}>Patrocinado</div>
            </div>
          </div>

          {shot ? (
            <img src={shot.src} alt={shot.goal} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{
              width: "100%", aspectRatio: "1 / 1",
              background: "linear-gradient(145deg, #16202E, #0D1420)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "rgba(255,255,255,0.30)", fontSize: 11, textAlign: "center", padding: 16,
              lineHeight: 1.5,
            }}>
              seu criativo aqui
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 10px" }}>
            <Heart size={15} color="#fff" />
            <MessageCircle size={15} color="#fff" />
            <Send size={15} color="#fff" />
            <span style={{ flex: 1 }} />
            <Bookmark size={15} color="#fff" />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes heroCaret { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
        @media (max-width: 860px) {
          .hero-demo { grid-template-columns: 1fr !important; }
          .hero-demo > div:first-child { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.08) !important; }
        }
      `}</style>
    </div>
  );
}
