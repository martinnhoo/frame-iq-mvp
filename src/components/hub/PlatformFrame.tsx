/**
 * PlatformFrame — mostra o criativo dentro do lugar onde ele vai aparecer.
 *
 * O resultado era uma <img> solta com borda arredondada: um PNG. A landing
 * promete "descreva o anúncio em uma frase, ele sai pronto pra subir", e o
 * que o produto entregava na tela era um arquivo.
 *
 * O mesmo pixel, dentro do frame do feed — avatar, nome, ícones, primeira
 * linha da legenda — deixa de parecer arquivo e passa a parecer anúncio
 * pronto. É a maior mudança de valor percebido por linha de código: nenhum
 * modelo novo, nenhum custo de provider, um wrapper e alguns SVGs.
 *
 * O botão "ver limpo" existe porque na hora de conferir detalhe o frame
 * atrapalha. Enquadrar é pra vender a sensação; conferir é outro momento.
 */

import { useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Eye } from "lucide-react";
import { color, font, radius, space, motion } from "@/lib/design";

type Surface = "feed" | "story" | "wide";

/** 9:16 vira Stories, 16:9 vira player, o resto vira feed. */
function surfaceFor(aspect: string): Surface {
  if (aspect === "9:16") return "story";
  if (aspect === "16:9") return "wide";
  return "feed";
}

export default function PlatformFrame({
  src,
  aspectRatio,
  brandName,
  brandLogoUrl,
  caption,
}: {
  src: string;
  aspectRatio: string;
  brandName?: string | null;
  brandLogoUrl?: string | null;
  caption?: string | null;
}) {
  const [clean, setClean] = useState(false);
  const surface = surfaceFor(aspectRatio);
  const handle = (brandName || "sua marca").toLowerCase().replace(/\s+/g, "");

  if (clean) {
    return (
      <Wrapper onToggle={() => setClean(false)} cleanMode>
        <img
          src={src}
          alt="Criativo gerado"
          style={{
            width: "100%", maxHeight: "58vh", objectFit: "contain",
            borderRadius: radius.md, display: "block",
          }}
        />
      </Wrapper>
    );
  }

  if (surface === "story") {
    return (
      <Wrapper onToggle={() => setClean(true)}>
        <div style={{
          position: "relative", width: "100%", maxWidth: 300, margin: "0 auto",
          aspectRatio: "9 / 16", borderRadius: 22, overflow: "hidden",
          background: "#000", boxShadow: "0 20px 50px -20px rgba(0,0,0,0.8)",
        }}>
          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          {/* Barra de progresso do Stories */}
          <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", gap: 3 }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{
                flex: 1, height: 2, borderRadius: radius.full,
                background: i === 0 ? "#fff" : "rgba(255,255,255,0.35)",
              }} />
            ))}
          </div>
          <div style={{
            position: "absolute", top: 22, left: 10, right: 10,
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <Avatar url={brandLogoUrl} name={brandName} size={26} />
            <span style={{ fontSize: font.size.caption, fontWeight: font.weight.medium, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
              {handle}
            </span>
          </div>
          <div style={{
            position: "absolute", bottom: 14, left: 12, right: 12,
            padding: `${space[2]}px ${space[3]}px`,
            borderRadius: radius.full,
            border: "1px solid rgba(255,255,255,0.45)",
            color: "rgba(255,255,255,0.85)",
            fontSize: font.size.caption,
            backdropFilter: "blur(4px)",
          }}>
            Envie uma mensagem
          </div>
        </div>
      </Wrapper>
    );
  }

  if (surface === "wide") {
    return (
      <Wrapper onToggle={() => setClean(true)}>
        <div style={{
          borderRadius: radius.md, overflow: "hidden", background: "#000",
          boxShadow: "0 20px 50px -20px rgba(0,0,0,0.8)",
        }}>
          <img src={src} alt="" style={{ width: "100%", display: "block", aspectRatio: "16 / 9", objectFit: "cover" }} />
          <div style={{ height: 3, background: "rgba(255,255,255,0.18)" }}>
            <div style={{ width: "34%", height: "100%", background: color.danger }} />
          </div>
          <div style={{
            padding: `${space[3]}px ${space[3]}px`,
            display: "flex", alignItems: "center", gap: space[2],
            background: "#0b0b0b",
          }}>
            <Avatar url={brandLogoUrl} name={brandName} size={28} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: font.size.body, fontWeight: font.weight.medium, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {caption?.slice(0, 60) || "Seu anúncio"}
              </div>
              <div style={{ fontSize: font.size.label, color: "rgba(255,255,255,0.5)" }}>
                {brandName || "Sua marca"} · Patrocinado
              </div>
            </div>
          </div>
        </div>
      </Wrapper>
    );
  }

  // Feed (1:1 e 4:5)
  const [w, h] = aspectRatio.split(":").map(Number);
  return (
    <Wrapper onToggle={() => setClean(true)}>
      <div style={{
        maxWidth: 380, margin: "0 auto",
        background: "#000", borderRadius: radius.md, overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 20px 50px -20px rgba(0,0,0,0.8)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: space[2], padding: space[2] }}>
          <Avatar url={brandLogoUrl} name={brandName} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: font.size.caption, fontWeight: font.weight.medium, color: "#fff" }}>{handle}</div>
            <div style={{ fontSize: font.size.label, color: "rgba(255,255,255,0.5)" }}>Patrocinado</div>
          </div>
          <MoreHorizontal size={16} color="rgba(255,255,255,0.6)" />
        </div>
        <img src={src} alt="" style={{
          width: "100%", display: "block",
          aspectRatio: w && h ? `${w} / ${h}` : "1 / 1",
          objectFit: "cover",
        }} />
        <div style={{ display: "flex", alignItems: "center", gap: space[3], padding: `${space[2]}px ${space[3]}px` }}>
          <Heart size={19} color="#fff" />
          <MessageCircle size={19} color="#fff" />
          <Send size={19} color="#fff" />
          <span style={{ flex: 1 }} />
          <Bookmark size={19} color="#fff" />
        </div>
        {caption && (
          <div style={{
            padding: `0 ${space[3]}px ${space[3]}px`,
            fontSize: font.size.caption, color: "rgba(255,255,255,0.82)",
            lineHeight: font.leading.snug,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            <strong style={{ color: "#fff", fontWeight: font.weight.medium }}>{handle}</strong>{" "}
            {caption}
          </div>
        )}
      </div>
    </Wrapper>
  );
}

function Wrapper({ children, onToggle, cleanMode }: {
  children: React.ReactNode; onToggle: () => void; cleanMode?: boolean;
}) {
  return (
    <div style={{ position: "relative" }}>
      {children}
      <button
        onClick={onToggle}
        style={{
          position: "absolute", top: space[2], right: space[2],
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: `5px ${space[2]}px`, borderRadius: radius.full,
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.18)",
          color: "rgba(255,255,255,0.85)",
          fontSize: font.size.label, fontFamily: font.family, fontWeight: font.weight.medium,
          cursor: "pointer", backdropFilter: "blur(6px)",
          transition: `background ${motion.fast}`,
        }}
      >
        <Eye size={11} /> {cleanMode ? "ver no feed" : "ver limpo"}
      </button>
    </div>
  );
}

function Avatar({ url, name, size }: { url?: string | null; name?: string | null; size: number }) {
  if (url) {
    return (
      <img src={url} alt="" style={{
        width: size, height: size, borderRadius: radius.full,
        objectFit: "cover", flexShrink: 0,
        border: "1px solid rgba(255,255,255,0.20)",
      }} />
    );
  }
  return (
    <span style={{
      width: size, height: size, borderRadius: radius.full, flexShrink: 0,
      background: color.accentSoft, border: `1px solid ${color.accentBorder}`,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.42, fontWeight: font.weight.bold, color: color.accent,
    }}>
      {(name || "M").slice(0, 1).toUpperCase()}
    </span>
  );
}
