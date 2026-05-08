/**
 * HubAnalytics — Analytics de Geração do Hub.
 *
 * Frontend-only: agrega dados do hub_assets (que já existe) sem precisar
 * de nova migration ou edge function. Mostra:
 *   - 4 KPI cards (Total / Imagens / Vídeos / Áudios)
 *   - Breakdown por tipo (bar chart inline SVG)
 *   - Breakdown por marca (com cores)
 *   - Breakdown por mercado (com bandeiras)
 *   - Atividade nos últimos N dias (bar chart por dia)
 *   - Top elementos reusados (do content.elements_used das imagens)
 *
 * Filtro de período: 7d / 30d / 90d / Tudo (default 30d).
 *
 * Storyboards/carrosséis: contam como 1 grupo cada (não cada cena/slide).
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, BarChart3, Image as ImageIcon, Layers, Clapperboard,
  GalleryHorizontal, Mic, Captions, Sparkles, FolderOpen, Calendar,
  TrendingUp,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { HUB_BRANDS, HUB_MARKETS, getBrand, getBrandName, getMarketLabel, type MarketCode, type Lang } from "@/data/hubBrands";

const STR: Record<string, Record<Lang, string>> = {
  back:           { pt: "Voltar ao Hub",           en: "Back to Hub",            es: "Volver al Hub",            zh: "返回中心" },
  title:          { pt: "Analytics",               en: "Analytics",              es: "Analítica",                zh: "数据分析" },
  subtitle:      { pt: "Acompanhe o que foi gerado no Hub.",
                   en: "Track what's been generated in the Hub.",
                   es: "Rastrea lo que se ha generado en el Hub.",
                   zh: "跟踪在中心生成的内容。" },
  // Periods
  p7d:            { pt: "7 dias",                  en: "7 days",                 es: "7 días",                   zh: "7 天" },
  p30d:           { pt: "30 dias",                 en: "30 days",                es: "30 días",                  zh: "30 天" },
  p90d:           { pt: "90 dias",                 en: "90 days",                es: "90 días",                  zh: "90 天" },
  pAll:           { pt: "Tudo",                    en: "All",                    es: "Todo",                     zh: "全部" },
  // KPIs
  kpiTotal:       { pt: "Total",                   en: "Total",                  es: "Total",                    zh: "总计" },
  kpiTotalDesc:   { pt: "criativos gerados",       en: "creatives generated",    es: "creativos generados",      zh: "创意生成" },
  kpiImages:      { pt: "Imagens",                 en: "Images",                 es: "Imágenes",                 zh: "图像" },
  kpiImagesDesc:  { pt: "imagens + PNGs",          en: "images + PNGs",          es: "imágenes + PNGs",          zh: "图像 + PNG" },
  kpiVideos:      { pt: "Sequências",              en: "Sequences",              es: "Secuencias",               zh: "序列" },
  kpiVideosDesc:  { pt: "storyboards + carrosséis",en: "storyboards + carousels",es: "storyboards + carruseles", zh: "故事板 + 轮播" },
  kpiAudios:      { pt: "Áudios",                  en: "Audio",                  es: "Audio",                    zh: "音频" },
  kpiAudiosDesc:  { pt: "vozes + transcrições",    en: "voices + transcripts",   es: "voces + transcripciones",  zh: "语音 + 转录" },
  // Sections
  byType:         { pt: "Por tipo de criativo",    en: "By creative type",       es: "Por tipo de creativo",     zh: "按创意类型" },
  byBrand:        { pt: "Por marca",               en: "By brand",               es: "Por marca",                zh: "按品牌" },
  byMarket:       { pt: "Por mercado",             en: "By market",              es: "Por mercado",              zh: "按市场" },
  activity:       { pt: "Atividade",               en: "Activity",               es: "Actividad",                zh: "活动" },
  activityDesc:   { pt: "Volume diário",           en: "Daily volume",           es: "Volumen diario",           zh: "每日数量" },
  topElements:    { pt: "Top elementos reusados",  en: "Top reused elements",    es: "Top elementos reutilizados",zh: "最常重复使用的元素" },
  topElementsDesc:{ pt: "Quais elementos custom apareceram em mais criativos.",
                   en: "Which custom elements appeared in most creatives.",
                   es: "Qué elementos personalizados aparecieron en más creativos.",
                   zh: "哪些自定义元素出现在最多创意中。" },
  // Type names
  typeImage:      { pt: "Imagens",                 en: "Images",                 es: "Imágenes",                 zh: "图像" },
  typePng:        { pt: "PNGs",                    en: "PNGs",                   es: "PNGs",                     zh: "PNG" },
  typeStoryboard: { pt: "Storyboards",             en: "Storyboards",            es: "Storyboards",              zh: "故事板" },
  typeCarousel:   { pt: "Carrosséis",              en: "Carousels",              es: "Carruseles",               zh: "轮播" },
  typeTranscribe: { pt: "Transcrições",            en: "Transcripts",            es: "Transcripciones",          zh: "转录" },
  typeVoice:      { pt: "Vozes",                   en: "Voices",                 es: "Voces",                    zh: "语音" },
  // Empty / loading
  loading:        { pt: "Carregando…",             en: "Loading…",               es: "Cargando…",                zh: "加载中…" },
  emptyTitle:     { pt: "Sem dados ainda",         en: "No data yet",            es: "Sin datos aún",            zh: "暂无数据" },
  emptyDesc:     { pt: "Comece gerando criativos no Hub — métricas aparecem aqui.",
                   en: "Start generating creatives in the Hub — metrics will appear here.",
                   es: "Comienza generando creativos en el Hub — las métricas aparecerán aquí.",
                   zh: "在中心开始生成创意 — 指标将显示在这里。" },
  noBrand:        { pt: "Sem marca",               en: "No brand",               es: "Sin marca",                zh: "无品牌" },
  noMarket:       { pt: "Sem mercado",             en: "No market",              es: "Sin mercado",              zh: "无市场" },
  noElements:     { pt: "Nenhum elemento reusado ainda.",
                   en: "No reused elements yet.",
                   es: "Ningún elemento reutilizado aún.",
                   zh: "尚未重复使用任何元素。" },
  uses:           { pt: "usos",                    en: "uses",                   es: "usos",                     zh: "使用" },
};

type AssetType = "image" | "png" | "storyboard" | "carousel" | "transcribe" | "voice";

const TYPE_META: Record<AssetType, { kind: string; key: keyof typeof STR; icon: typeof ImageIcon; color: string }> = {
  image:      { kind: "hub_image",      key: "typeImage",      icon: ImageIcon,         color: "#3B82F6" },
  png:        { kind: "hub_png",        key: "typePng",        icon: Layers,            color: "#06B6D4" },
  storyboard: { kind: "hub_storyboard", key: "typeStoryboard", icon: Clapperboard,      color: "#8B5CF6" },
  carousel:   { kind: "hub_carousel",   key: "typeCarousel",   icon: GalleryHorizontal, color: "#EC4899" },
  transcribe: { kind: "hub_transcribe", key: "typeTranscribe", icon: Captions,          color: "#10B981" },
  voice:      { kind: "hub_voice",      key: "typeVoice",      icon: Mic,               color: "#F59E0B" },
};

const PERIODS: { id: "7d" | "30d" | "90d" | "all"; days: number; labelKey: keyof typeof STR }[] = [
  { id: "7d",  days: 7,         labelKey: "p7d"  },
  { id: "30d", days: 30,        labelKey: "p30d" },
  { id: "90d", days: 90,        labelKey: "p90d" },
  { id: "all", days: 365 * 5,   labelKey: "pAll" },
];

interface RawRow {
  id: string;
  kind: string;
  content?: {
    brand_id?: string;
    market?: MarketCode;
    storyboard_id?: string;
    carousel_id?: string;
    elements_used?: Array<{ id: string; name: string }>;
  };
  created_at: string;
}

interface AggregatedStats {
  totalCreatives: number;          // criativos únicos (storyboards/carousels contam como 1)
  byType: Record<AssetType, number>;
  byBrand: Map<string, number>;    // brand_id (null/none) → count
  byMarket: Map<string, number>;   // market code → count
  byDay: Map<string, number>;      // YYYY-MM-DD → count
  topElements: Array<{ id: string; name: string; uses: number }>;
}

export default function HubAnalytics() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const lang: Lang = (["pt", "en", "es", "zh"].includes(language as string) ? language : "pt") as Lang;
  const t = (key: keyof typeof STR) => STR[key]?.[lang] || STR[key]?.en || String(key);

  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AggregatedStats | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if (mounted) { setStats(null); setLoading(false); } return; }

        const days = PERIODS.find(p => p.id === period)!.days;
        const since = new Date(Date.now() - days * 86_400_000).toISOString();

        // PERFORMANCE: antes pegava 'content' completo (jsonb com data
        // URLs embebidos = ~2MB/row, 2000 rows = 4GB payload). Agora
        // projeta SÓ os campos que aggregate() usa de fato:
        //   brand_id, market, storyboard_id, carousel_id, elements_used.
        // Cada row vira ~200 bytes. 2000 rows = 400KB. ~10000x mais leve.
        const { data } = await supabase.from("hub_assets" as never)
          .select(`
            id, kind, created_at,
            brand_id:content->>brand_id,
            market:content->>market,
            storyboard_id:content->>storyboard_id,
            carousel_id:content->>carousel_id,
            elements_used:content->elements_used
          `)
          .eq("user_id", user.id)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(2000);
        if (!mounted) return;

        // Rows vêm com campos achatados — adapta pro shape esperado
        // pelo aggregate() (que espera content como sub-objeto).
        const rows = ((data as Array<{
          id: string;
          kind: string;
          created_at: string;
          brand_id: string | null;
          market: string | null;
          storyboard_id: string | null;
          carousel_id: string | null;
          elements_used: Array<{ id: string; name: string }> | null;
        }>) || []).map(r => ({
          id: r.id,
          kind: r.kind,
          created_at: r.created_at,
          content: {
            brand_id: r.brand_id || undefined,
            market: r.market || undefined,
            storyboard_id: r.storyboard_id || undefined,
            carousel_id: r.carousel_id || undefined,
            elements_used: r.elements_used || undefined,
          },
        })) as RawRow[];
        const aggregated = aggregate(rows);
        setStats(aggregated);
      } catch (e) {
        console.error("[hub-analytics] error:", e);
        if (mounted) setStats(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [period]);

  return (
    <>
      <Helmet><title>{t("title")} — Hub</title></Helmet>

      <div style={{
        minHeight: "calc(100vh - 64px)",
        padding: "20px 18px 40px",
        maxWidth: 1480, margin: "0 auto", color: "#fff",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 16, marginBottom: 22, flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {t("title")}
            </h1>
            <p style={{ fontSize: 13, color: "#D1D5DB", margin: "6px 0 0", lineHeight: 1.5 }}>
              {t("subtitle")}
            </p>
          </div>
          <button onClick={() => navigate("/dashboard/hub")} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "9px 14px", borderRadius: 10,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#D1D5DB", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
            fontFamily: "inherit", flexShrink: 0,
          }}>
            <ArrowLeft size={13} /> {t("back")}
          </button>
        </div>

        {/* Period selector */}
        <div style={{
          display: "inline-flex", gap: 4, padding: 4, marginBottom: 22,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10,
        }}>
          {PERIODS.map(p => {
            const active = period === p.id;
            return (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                style={{
                  padding: "6px 12px", borderRadius: 7,
                  background: active ? "#3B82F6" : "transparent",
                  color: active ? "#fff" : "#9CA3AF",
                  border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                  letterSpacing: "0.02em",
                  transition: "all 0.15s",
                }}>
                {t(p.labelKey)}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 80, color: "#9CA3AF", fontSize: 13 }}>
            {t("loading")}
          </div>
        ) : !stats || stats.totalCreatives === 0 ? (
          <EmptyState title={t("emptyTitle")} desc={t("emptyDesc")} />
        ) : (
          <>
            {/* KPI cards */}
            <div className="hub-analytics-kpis" style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 12, marginBottom: 22,
            }}>
              <KpiCard
                icon={Sparkles} color="#3B82F6"
                label={t("kpiTotal")} desc={t("kpiTotalDesc")}
                value={stats.totalCreatives}
              />
              <KpiCard
                icon={ImageIcon} color="#06B6D4"
                label={t("kpiImages")} desc={t("kpiImagesDesc")}
                value={stats.byType.image + stats.byType.png}
              />
              <KpiCard
                icon={Clapperboard} color="#8B5CF6"
                label={t("kpiVideos")} desc={t("kpiVideosDesc")}
                value={stats.byType.storyboard + stats.byType.carousel}
              />
              <KpiCard
                icon={Mic} color="#F59E0B"
                label={t("kpiAudios")} desc={t("kpiAudiosDesc")}
                value={stats.byType.voice + stats.byType.transcribe}
              />
            </div>

            {/* Two-column grid: by type + activity over time */}
            <div className="hub-analytics-grid" style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 18, marginBottom: 18,
            }}>
              {/* By type */}
              <div style={CARD_STYLE}>
                <div style={SECTION_HEADER}>
                  <BarChart3 size={14} style={{ color: "#3B82F6" }} />
                  <h3 style={SECTION_TITLE}>{t("byType")}</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                  {(Object.keys(TYPE_META) as AssetType[]).map(type => {
                    const meta = TYPE_META[type];
                    const count = stats.byType[type];
                    const pct = stats.totalCreatives === 0 ? 0 : (count / stats.totalCreatives) * 100;
                    const Icon = meta.icon;
                    return (
                      <div key={type}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#fff", fontWeight: 600 }}>
                            <Icon size={12} style={{ color: meta.color }} />
                            <span>{t(meta.key)}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                            {count}
                            <span style={{ color: "#9CA3AF", marginLeft: 6, fontSize: 11 }}>
                              {pct.toFixed(0)}%
                            </span>
                          </span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", width: `${pct}%`,
                            background: meta.color,
                            borderRadius: 3,
                            transition: "width 0.4s",
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Activity over time */}
              <div style={CARD_STYLE}>
                <div style={SECTION_HEADER}>
                  <TrendingUp size={14} style={{ color: "#3B82F6" }} />
                  <h3 style={SECTION_TITLE}>{t("activity")}</h3>
                </div>
                <p style={SECTION_SUB}>{t("activityDesc")}</p>
                <ActivityChart byDay={stats.byDay} days={Math.min(PERIODS.find(p => p.id === period)!.days, 60)} lang={lang} />
              </div>
            </div>

            {/* Two-column: brand + market */}
            <div className="hub-analytics-grid" style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 18, marginBottom: 18,
            }}>
              {/* By brand */}
              <div style={CARD_STYLE}>
                <div style={SECTION_HEADER}>
                  <FolderOpen size={14} style={{ color: "#3B82F6" }} />
                  <h3 style={SECTION_TITLE}>{t("byBrand")}</h3>
                </div>
                <BrandList byBrand={stats.byBrand} total={stats.totalCreatives} lang={lang} t={t} />
              </div>

              {/* By market */}
              <div style={CARD_STYLE}>
                <div style={SECTION_HEADER}>
                  <Calendar size={14} style={{ color: "#3B82F6" }} />
                  <h3 style={SECTION_TITLE}>{t("byMarket")}</h3>
                </div>
                <MarketList byMarket={stats.byMarket} total={stats.totalCreatives} lang={lang} t={t} />
              </div>
            </div>

            {/* Top elements */}
            <div style={CARD_STYLE}>
              <div style={SECTION_HEADER}>
                <Sparkles size={14} style={{ color: "#3B82F6" }} />
                <h3 style={SECTION_TITLE}>{t("topElements")}</h3>
              </div>
              <p style={SECTION_SUB}>{t("topElementsDesc")}</p>
              {stats.topElements.length === 0 ? (
                <p style={{ fontSize: 12, color: "#9CA3AF", margin: "16px 0 0", fontStyle: "italic" }}>
                  {t("noElements")}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
                  {stats.topElements.slice(0, 5).map((el, i) => {
                    const max = stats.topElements[0]?.uses || 1;
                    const pct = (el.uses / max) * 100;
                    return (
                      <div key={el.id}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#fff", fontWeight: 600, minWidth: 0 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 800, color: "#3B82F6",
                              minWidth: 20, fontVariantNumeric: "tabular-nums",
                            }}>#{i + 1}</span>
                            <span style={{
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>{el.name}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                            {el.uses} <span style={{ color: "#9CA3AF", fontSize: 11, fontWeight: 600 }}>{t("uses")}</span>
                          </span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                          <div style={{
                            height: "100%", width: `${pct}%`,
                            background: "#3B82F6", borderRadius: 3,
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        <style>{`
          @media (max-width: 1100px) {
            .hub-analytics-grid { grid-template-columns: 1fr !important; }
            .hub-analytics-kpis { grid-template-columns: repeat(2, 1fr) !important; }
          }
          @media (max-width: 540px) {
            .hub-analytics-kpis { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </>
  );
}

// ── Aggregation logic ─────────────────────────────────────────
function aggregate(rows: RawRow[]): AggregatedStats {
  const byType: Record<AssetType, number> = {
    image: 0, png: 0, storyboard: 0, carousel: 0, transcribe: 0, voice: 0,
  };
  const byBrand = new Map<string, number>();
  const byMarket = new Map<string, number>();
  const byDay = new Map<string, number>();
  const elementCounts = new Map<string, { name: string; uses: number }>();

  // Track storyboard/carousel groups por id pra contar como 1 só
  const storyboardGroups = new Set<string>();
  const carouselGroups = new Set<string>();

  for (const r of rows) {
    const c = r.content || {};
    const day = r.created_at.slice(0, 10); // YYYY-MM-DD

    let countAsCreative = false;
    let assetType: AssetType | null = null;

    if (r.kind === "hub_image") {
      byType.image++;
      assetType = "image";
      countAsCreative = true;
      // count elements_used
      const els = (c.elements_used || []) as Array<{ id: string; name: string }>;
      for (const el of els) {
        if (!el?.id) continue;
        const ex = elementCounts.get(el.id);
        if (ex) ex.uses++;
        else elementCounts.set(el.id, { name: el.name || "—", uses: 1 });
      }
    } else if (r.kind === "hub_png") {
      byType.png++;
      assetType = "png";
      countAsCreative = true;
    } else if (r.kind === "hub_storyboard") {
      const gid = c.storyboard_id || r.id;
      if (!storyboardGroups.has(gid)) {
        storyboardGroups.add(gid);
        byType.storyboard++;
        assetType = "storyboard";
        countAsCreative = true;
      }
    } else if (r.kind === "hub_carousel") {
      const gid = c.carousel_id || r.id;
      if (!carouselGroups.has(gid)) {
        carouselGroups.add(gid);
        byType.carousel++;
        assetType = "carousel";
        countAsCreative = true;
      }
    } else if (r.kind === "hub_transcribe") {
      byType.transcribe++;
      assetType = "transcribe";
      countAsCreative = true;
    } else if (r.kind === "hub_voice") {
      byType.voice++;
      assetType = "voice";
      countAsCreative = true;
    }

    if (countAsCreative) {
      // brand
      const brandKey = c.brand_id && c.brand_id !== "none" ? c.brand_id : "__none__";
      byBrand.set(brandKey, (byBrand.get(brandKey) || 0) + 1);
      // market
      const marketKey = c.market || "__none__";
      byMarket.set(marketKey, (byMarket.get(marketKey) || 0) + 1);
      // day
      byDay.set(day, (byDay.get(day) || 0) + 1);
    }
    // assetType usado pra trackear se necessário no futuro
    void assetType;
  }

  const totalCreatives =
    byType.image + byType.png + byType.storyboard + byType.carousel +
    byType.transcribe + byType.voice;

  const topElements = Array.from(elementCounts.entries())
    .map(([id, v]) => ({ id, name: v.name, uses: v.uses }))
    .sort((a, b) => b.uses - a.uses);

  return { totalCreatives, byType, byBrand, byMarket, byDay, topElements };
}

// ── Sub-components ────────────────────────────────────────────

function KpiCard({ icon: Icon, color, label, desc, value }: {
  icon: typeof ImageIcon; color: string; label: string; desc: string; value: number;
}) {
  return (
    <div style={{
      background: "rgba(17,24,39,0.50)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12, padding: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: `${color}1A`,
          border: `1px solid ${color}40`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={13} style={{ color }} />
        </div>
        <p style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: "0.10em",
          color: "#9CA3AF", margin: 0, textTransform: "uppercase",
        }}>{label}</p>
      </div>
      <p style={{
        fontSize: 28, fontWeight: 800, color: "#fff", margin: 0,
        lineHeight: 1, letterSpacing: "-0.02em",
        fontVariantNumeric: "tabular-nums",
      }}>{value.toLocaleString()}</p>
      <p style={{ fontSize: 11, color: "#9CA3AF", margin: "4px 0 0" }}>{desc}</p>
    </div>
  );
}

function ActivityChart({ byDay, days, lang }: { byDay: Map<string, number>; days: number; lang: Lang }) {
  // Generate last N days backwards from today
  const today = new Date();
  const dayList: { date: string; count: number; label: string; weekday: string }[] = [];
  const weekdayNames = lang === "pt" ? ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"]
    : lang === "es" ? ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"]
    : lang === "zh" ? ["日","一","二","三","四","五","六"]
    : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    dayList.push({
      date,
      count: byDay.get(date) || 0,
      label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      weekday: weekdayNames[d.getDay()],
    });
  }
  const max = Math.max(1, ...dayList.map(d => d.count));
  const total = dayList.reduce((s, d) => s + d.count, 0);
  const activeDays = dayList.filter(d => d.count > 0).length;
  const avgPerActive = activeDays > 0 ? (total / activeDays).toFixed(1) : "0";

  // Média móvel de 7 dias pra suavizar (linha)
  const movingAvg = dayList.map((_, i) => {
    const window = dayList.slice(Math.max(0, i - 6), i + 1);
    const sum = window.reduce((s, d) => s + d.count, 0);
    return sum / window.length;
  });

  // Eixo Y: 4 níveis (0, max/3, 2max/3, max)
  const yLevels = [0, Math.round(max / 3), Math.round((2 * max) / 3), max];

  // X-axis labels: até 5 (primeiro, 25%, 50%, 75%, último)
  const xLabelIndices = days <= 7
    ? dayList.map((_, i) => i)
    : [0, Math.floor(days * 0.25), Math.floor(days * 0.5), Math.floor(days * 0.75), days - 1];

  // Constantes de layout do SVG
  const W = 100;          // viewBox width (% units)
  const H = 100;          // viewBox height (% units)
  const padTop = 4;
  const padBottom = 4;
  const chartH = H - padTop - padBottom;
  const barGap = 1;
  const barW = (W - barGap * (days - 1)) / days;

  // Gera path da linha de média móvel
  const linePath = movingAvg.map((v, i) => {
    const x = i * (barW + barGap) + barW / 2;
    const y = padTop + chartH - (v / max) * chartH;
    return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");

  return (
    <div style={{ marginTop: 14 }}>
      {/* KPIs no topo */}
      <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Total</div>
          <div style={{ fontSize: 16, color: "#fff", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{total}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
            {lang === "pt" ? "Pico" : lang === "en" ? "Peak" : lang === "es" ? "Pico" : "峰值"}
          </div>
          <div style={{ fontSize: 16, color: "#3B82F6", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{max}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
            {lang === "pt" ? "Dias ativos" : lang === "en" ? "Active days" : lang === "es" ? "Días activos" : "活跃天"}
          </div>
          <div style={{ fontSize: 16, color: "#fff", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {activeDays}<span style={{ fontSize: 11, color: "#6B7280" }}>/{days}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
            {lang === "pt" ? "Média ativa" : lang === "en" ? "Active avg" : lang === "es" ? "Media activa" : "平均"}
          </div>
          <div style={{ fontSize: 16, color: "#fff", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{avgPerActive}</div>
        </div>
      </div>

      {/* Chart com grid Y + barras + linha de média */}
      <div style={{ position: "relative", display: "flex" }}>
        {/* Eixo Y labels (esquerda, fora do SVG) */}
        <div style={{
          width: 28, display: "flex", flexDirection: "column", justifyContent: "space-between",
          paddingTop: 2, paddingBottom: 18, fontSize: 9.5, color: "#4B5563",
          textAlign: "right", paddingRight: 6, fontVariantNumeric: "tabular-nums",
        }}>
          {[...yLevels].reverse().map((lv, i) => (
            <span key={i}>{lv}</span>
          ))}
        </div>

        {/* SVG: grid + barras + linha */}
        <div style={{ flex: 1, position: "relative" }}>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            style={{ width: "100%", height: 160, display: "block" }}
          >
            <defs>
              <linearGradient id="actBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.7" />
              </linearGradient>
            </defs>

            {/* Linhas de grid horizontais (sutis) */}
            {yLevels.map((_, i) => {
              const y = padTop + (chartH * i) / (yLevels.length - 1);
              return (
                <line key={i}
                  x1={0} y1={y} x2={W} y2={y}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={0.15}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {/* Barras */}
            {dayList.map((d, i) => {
              const x = i * (barW + barGap);
              const heightPct = d.count > 0 ? Math.max(1.5, (d.count / max) * chartH) : 0;
              const y = padTop + chartH - heightPct;
              return (
                <g key={d.date}>
                  <rect
                    x={x} y={y}
                    width={barW} height={heightPct}
                    fill={d.count > 0 ? "url(#actBarGrad)" : "transparent"}
                    rx={0.4} ry={0.4}
                  >
                    <title>{`${d.weekday} ${d.label}: ${d.count} ${d.count === 1 ? "criativo" : "criativos"}`}</title>
                  </rect>
                </g>
              );
            })}

            {/* Linha de média móvel 7d (overlay) */}
            {total > 0 && (
              <path
                d={linePath}
                fill="none"
                stroke="#A78BFA"
                strokeWidth={0.3}
                strokeOpacity={0.85}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>

          {/* X-axis labels */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            marginTop: 6, fontSize: 9.5, color: "#6B7280",
            fontVariantNumeric: "tabular-nums",
          }}>
            {xLabelIndices.map(i => (
              <span key={i}>{dayList[i]?.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda da linha de média */}
      {total > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          marginTop: 10, fontSize: 10.5, color: "#9CA3AF",
        }}>
          <span style={{ width: 14, height: 2, background: "#A78BFA", borderRadius: 1 }} />
          {lang === "pt" ? "Média móvel 7 dias"
            : lang === "en" ? "7-day moving average"
            : lang === "es" ? "Media móvil 7 días"
            : "7 天移动平均"}
        </div>
      )}
    </div>
  );
}

function BrandList({ byBrand, total, lang, t }: {
  byBrand: Map<string, number>; total: number; lang: Lang;
  t: (key: keyof typeof STR) => string;
}) {
  const sorted = Array.from(byBrand.entries())
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count);

  if (sorted.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
      {sorted.map(({ id, count }) => {
        const brand = id !== "__none__" ? getBrand(id) : null;
        const pct = total === 0 ? 0 : (count / total) * 100;
        const accent = brand ? extractGradientColor(brand.gradient) : "#6B7280";
        return (
          <div key={id}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#fff", fontWeight: 600, minWidth: 0 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 5,
                  background: brand?.logoImage ? "rgba(0,0,0,0.85)" : (brand?.gradient || "rgba(255,255,255,0.06)"),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  overflow: "hidden", flexShrink: 0,
                }}>
                  {brand?.logoImage ? (
                    <img src={brand.logoImage} alt="" style={{ width: "82%", height: "82%", objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: 8, fontWeight: 800, color: "#fff" }}>
                      {brand?.logoInitials || "—"}
                    </span>
                  )}
                </div>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {brand ? getBrandName(brand, lang) : t("noBrand")}
                </span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {count}
                <span style={{ color: "#9CA3AF", marginLeft: 6, fontSize: 11 }}>{pct.toFixed(0)}%</span>
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: accent, borderRadius: 3 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MarketList({ byMarket, total, lang, t }: {
  byMarket: Map<string, number>; total: number; lang: Lang;
  t: (key: keyof typeof STR) => string;
}) {
  const sorted = Array.from(byMarket.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count);

  if (sorted.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
      {sorted.map(({ code, count }) => {
        const market = code !== "__none__" ? HUB_MARKETS[code as MarketCode] : null;
        const pct = total === 0 ? 0 : (count / total) * 100;
        return (
          <div key={code}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#fff", fontWeight: 600 }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>{market?.flag || "—"}</span>
                <span>{market ? getMarketLabel(code as MarketCode, lang) : t("noMarket")}</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
                {count}
                <span style={{ color: "#9CA3AF", marginLeft: 6, fontSize: 11 }}>{pct.toFixed(0)}%</span>
              </span>
            </div>
            <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "#3B82F6", borderRadius: 3 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{
      textAlign: "center", padding: "60px 20px",
      background: "rgba(255,255,255,0.02)",
      border: "1px dashed rgba(255,255,255,0.10)",
      borderRadius: 14,
    }}>
      <BarChart3 size={32} style={{ color: "rgba(255,255,255,0.30)", marginBottom: 12 }} />
      <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", margin: "0 0 6px" }}>{title}</p>
      <p style={{ fontSize: 12, color: "#D1D5DB", margin: 0 }}>{desc}</p>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────
function extractGradientColor(gradient: string): string {
  // pega primeiro hex do "linear-gradient(135deg, #DC2626, #F59E0B)"
  const m = gradient.match(/#[0-9a-fA-F]{6}/);
  return m ? m[0] : "#3B82F6";
}

const CARD_STYLE: React.CSSProperties = {
  background: "rgba(17,24,39,0.50)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 14,
  padding: 18,
};

const SECTION_HEADER: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 14, fontWeight: 800, color: "#fff", margin: 0,
  letterSpacing: "-0.01em",
};

const SECTION_SUB: React.CSSProperties = {
  fontSize: 11.5, color: "#9CA3AF", margin: "4px 0 0",
};
