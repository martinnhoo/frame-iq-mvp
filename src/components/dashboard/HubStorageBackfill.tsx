/**
 * HubStorageBackfill — Botão + modal pra migrar assets antigos
 * que estão com data URL embebido no banco pra Supabase Storage.
 *
 * Por que isso existe:
 *   Antes da v21 (2026-05-06), os geradores do Hub salvavam imagens
 *   como data URL base64 dentro do content jsonb. Isso fez rows ficarem
 *   ~2MB cada — Analytics e Library lentos, statement timeout em selects.
 *   A v21 já gera direto pro Storage. Este botão migra o histórico.
 *
 * Fluxo:
 *   1. "Verificar" (dry_run) → backend conta quantos rows precisam migrar
 *   2. "Migrar" → loop chamando o edge function em batches de 5
 *   3. Atualiza progresso em tempo real, fala done quando termina
 *   4. Chama onComplete pra Library recarregar e mostrar URLs novas
 *
 * Idempotente: se rodar de novo só processa o que ainda tá em data URL.
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

type Lang = "pt" | "en" | "es" | "zh";
type Phase = "idle" | "checking" | "ready" | "running" | "done" | "error";

const STR: Record<string, Record<Lang, string>> = {
  buttonLabel:    { pt: "Otimizar storage",       en: "Optimize storage",     es: "Optimizar storage",      zh: "优化存储" },
  modalTitle:     { pt: "Otimizar storage",       en: "Optimize storage",     es: "Optimizar storage",      zh: "优化存储" },
  modalDesc:      {
    pt: "Migra imagens antigas do banco pro Storage. Deixa Analytics e Biblioteca mais rápidos.",
    en: "Moves old images from the database to Storage. Makes Analytics and Library faster.",
    es: "Mueve imágenes antiguas de la base de datos al Storage. Hace Analytics y Biblioteca más rápidos.",
    zh: "将旧图像从数据库移至 Storage。让分析和资源库更快。",
  },
  check:          { pt: "Verificar",              en: "Check",                es: "Verificar",              zh: "检查" },
  checking:       { pt: "Verificando…",           en: "Checking…",            es: "Verificando…",           zh: "检查中…" },
  migrate:        { pt: "Migrar",                 en: "Migrate",              es: "Migrar",                 zh: "迁移" },
  migrating:      { pt: "Migrando…",              en: "Migrating…",           es: "Migrando…",              zh: "迁移中…" },
  found:          { pt: "Encontrados",            en: "Found",                es: "Encontrados",            zh: "已找到" },
  toMigrate:      { pt: "assets pra migrar",      en: "assets to migrate",    es: "assets para migrar",     zh: "个待迁移资源" },
  noneFound:      { pt: "Nada pra migrar — tudo já está otimizado.", en: "Nothing to migrate — all optimized.", es: "Nada para migrar — todo optimizado.", zh: "无需迁移 — 全部已优化。" },
  progress:       { pt: "Progresso",              en: "Progress",             es: "Progreso",               zh: "进度" },
  done:           { pt: "Concluído!",             en: "Done!",                es: "¡Listo!",                zh: "完成！" },
  doneDesc:       { pt: "assets migrados.",       en: "assets migrated.",     es: "assets migrados.",       zh: "个资源已迁移。" },
  errorTitle:     { pt: "Erro",                   en: "Error",                es: "Error",                  zh: "错误" },
  close:          { pt: "Fechar",                 en: "Close",                es: "Cerrar",                 zh: "关闭" },
  retry:          { pt: "Tentar de novo",         en: "Retry",                es: "Reintentar",             zh: "重试" },
  errorsLabel:    { pt: "Falhas",                 en: "Errors",               es: "Errores",                zh: "错误" },
  hint:           {
    pt: "Pode rodar de novo se sobrarem mais imagens — só processa o que ainda não foi migrado.",
    en: "Run again if more remain — it only processes what hasn't been migrated yet.",
    es: "Ejecuta de nuevo si quedan más — sólo procesa lo no migrado.",
    zh: "如果还有剩余，再次运行 — 只处理尚未迁移的内容。",
  },
};

interface Props {
  onComplete?: () => void;
}

export default function HubStorageBackfill({ onComplete }: Props) {
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || String(key);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [foundCount, setFoundCount] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [errors, setErrors] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  const reset = () => {
    setPhase("idle");
    setFoundCount(0);
    setProcessed(0);
    setErrors(0);
    setErrorMsg("");
  };

  const close = () => {
    setOpen(false);
    // Reset com delay pra modal não mostrar estado limpo durante anim
    setTimeout(reset, 250);
  };

  // Dry run pra contar quantos rows precisam migrar
  const check = useCallback(async () => {
    setPhase("checking");
    setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("backfill-asset-storage", {
        body: { dry_run: true },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.message || "fail");
      const total = Number(data.candidates_in_window || 0);
      setFoundCount(total);
      setPhase("ready");
    } catch (e) {
      setErrorMsg(String((e as Error)?.message || e));
      setPhase("error");
    }
  }, []);

  // Loop processando batches até done. Refaz dry_run no fim pra confirmar
  // (caso ainda haja rows fora da janela de 200 do primeiro check).
  const migrate = useCallback(async () => {
    setPhase("running");
    setProcessed(0);
    setErrors(0);
    let totalProcessed = 0;
    let totalErrors = 0;
    const MAX_ITER = 250; // 250 * 5 = 1250 assets máx por sessão
    const BATCH = 5;

    for (let i = 0; i < MAX_ITER; i++) {
      try {
        const { data, error } = await supabase.functions.invoke("backfill-asset-storage", {
          body: { batch_size: BATCH },
        });
        if (error) throw new Error(error.message);
        if (!data?.ok) throw new Error(data?.message || "fail");

        totalProcessed += Number(data.processed || 0);
        totalErrors += Array.isArray(data.errors) ? data.errors.length : 0;
        setProcessed(totalProcessed);
        setErrors(totalErrors);

        // Done = backend disse que terminou OU não processou nada nesse batch
        if (data.done || Number(data.processed || 0) === 0) break;
      } catch (e) {
        setErrorMsg(String((e as Error)?.message || e));
        setPhase("error");
        return;
      }
    }

    setPhase("done");
    // Permite que a Library recarregue pra refletir URLs migradas
    if (onComplete) {
      try { onComplete(); } catch { /* silent */ }
    }
  }, [onComplete]);

  // % progresso. Se foundCount era estimativa baixa (janela de 200) e mais
  // foram processados, capa em 100% pra UI não ficar estranha.
  const pct = foundCount > 0
    ? Math.min(100, Math.round((processed / foundCount) * 100))
    : (phase === "done" ? 100 : 0);

  return (
    <>
      <button
        onClick={() => { setOpen(true); reset(); }}
        title={t("buttonLabel")}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 12px", borderRadius: 9,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#D1D5DB",
          fontSize: 12, fontWeight: 600, cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <Database size={13} style={{ color: "#3B82F6" }} />
        {t("buttonLabel")}
      </button>

      {open && (
        <div
          onClick={close}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, padding: 20, backdropFilter: "blur(4px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0a0a0f",
              border: "1px solid rgba(59,130,246,0.30)",
              borderRadius: 14,
              maxWidth: 460, width: "100%",
              padding: "20px 22px",
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "rgba(59,130,246,0.15)",
                  border: "1px solid rgba(59,130,246,0.30)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Database size={16} style={{ color: "#3B82F6" }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{t("modalTitle")}</h3>
                </div>
              </div>
              <button
                onClick={close}
                aria-label={t("close")}
                style={{
                  background: "rgba(255,255,255,0.06)", border: "none",
                  borderRadius: 7, padding: 6, cursor: "pointer",
                  color: "#9CA3AF", display: "flex",
                }}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: "#D1D5DB", margin: "10px 0 16px", lineHeight: 1.55 }}>
              {t("modalDesc")}
            </p>

            {/* Phase: idle — Show check button */}
            {phase === "idle" && (
              <button
                onClick={check}
                style={primaryBtnStyle}
              >
                {t("check")}
              </button>
            )}

            {/* Phase: checking */}
            {phase === "checking" && (
              <div style={infoBoxStyle}>
                <Loader2 size={14} style={{ color: "#3B82F6", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 12.5, color: "#D1D5DB" }}>{t("checking")}</span>
              </div>
            )}

            {/* Phase: ready — found N, click Migrate */}
            {phase === "ready" && (
              <>
                {foundCount === 0 ? (
                  <div style={{ ...infoBoxStyle, color: "#10B981" }}>
                    <CheckCircle2 size={15} style={{ color: "#10B981" }} />
                    <span style={{ fontSize: 12.5, color: "#D1D5DB" }}>{t("noneFound")}</span>
                  </div>
                ) : (
                  <>
                    <div style={infoBoxStyle}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                        <span style={{ fontSize: 11.5, color: "#9CA3AF", fontWeight: 600 }}>{t("found")}:</span>
                        <span style={{ fontSize: 22, fontWeight: 800, color: "#3B82F6" }}>{foundCount}</span>
                        <span style={{ fontSize: 11.5, color: "#9CA3AF" }}>{t("toMigrate")}</span>
                      </div>
                    </div>
                    <button onClick={migrate} style={primaryBtnStyle}>
                      {t("migrate")}
                    </button>
                  </>
                )}
              </>
            )}

            {/* Phase: running — progress bar */}
            {phase === "running" && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#9CA3AF", marginBottom: 6 }}>
                    <span>{t("progress")}</span>
                    <span style={{ color: "#3B82F6", fontWeight: 700 }}>
                      {processed}{foundCount > 0 ? ` / ${foundCount}` : ""}
                    </span>
                  </div>
                  <div style={{
                    width: "100%", height: 7, borderRadius: 999,
                    background: "rgba(255,255,255,0.06)", overflow: "hidden",
                  }}>
                    <div style={{
                      width: `${pct}%`, height: "100%",
                      background: "linear-gradient(90deg, #3B82F6, #60A5FA)",
                      transition: "width 0.3s",
                    }} />
                  </div>
                </div>
                <div style={infoBoxStyle}>
                  <Loader2 size={14} style={{ color: "#3B82F6", animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 12.5, color: "#D1D5DB" }}>{t("migrating")}</span>
                </div>
              </>
            )}

            {/* Phase: done */}
            {phase === "done" && (
              <>
                <div style={{ ...infoBoxStyle, borderColor: "rgba(16,185,129,0.40)", background: "rgba(16,185,129,0.08)" }}>
                  <CheckCircle2 size={15} style={{ color: "#10B981" }} />
                  <span style={{ fontSize: 12.5, color: "#D1D5DB" }}>
                    <strong style={{ color: "#10B981" }}>{t("done")}</strong> {processed} {t("doneDesc")}
                  </span>
                </div>
                {errors > 0 && (
                  <p style={{ fontSize: 11.5, color: "#FCA5A5", margin: "8px 0 0" }}>
                    {t("errorsLabel")}: {errors}
                  </p>
                )}
                <p style={{ fontSize: 11, color: "#9CA3AF", margin: "10px 0 0", lineHeight: 1.5 }}>
                  {t("hint")}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={check} style={secondaryBtnStyle}>{t("check")}</button>
                  <button onClick={close} style={primaryBtnStyle}>{t("close")}</button>
                </div>
              </>
            )}

            {/* Phase: error */}
            {phase === "error" && (
              <>
                <div style={{ ...infoBoxStyle, borderColor: "rgba(239,68,68,0.40)", background: "rgba(239,68,68,0.08)" }}>
                  <AlertCircle size={15} style={{ color: "#EF4444" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <span style={{ fontSize: 12.5, color: "#FCA5A5", fontWeight: 700 }}>{t("errorTitle")}</span>
                    <span style={{
                      fontSize: 11.5, color: "#D1D5DB",
                      overflow: "hidden", textOverflow: "ellipsis",
                      display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
                    }}>
                      {errorMsg || "—"}
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={check} style={primaryBtnStyle}>{t("retry")}</button>
                  <button onClick={close} style={secondaryBtnStyle}>{t("close")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Spinner keyframes — inline pra não depender de CSS global */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#3B82F6",
  color: "#fff",
  border: "none",
  borderRadius: 9,
  fontSize: 13, fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(255,255,255,0.06)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 9,
  fontSize: 13, fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};

const infoBoxStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "10px 12px",
  background: "rgba(59,130,246,0.06)",
  border: "1px solid rgba(59,130,246,0.20)",
  borderRadius: 9,
  marginBottom: 12,
};
