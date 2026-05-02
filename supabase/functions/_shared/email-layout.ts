// _shared/email-layout.ts — single source of truth pra HTML dos emails AdBrief.
//
// Antes desse arquivo cada send-*-email duplicava DOCTYPE/header/footer/CSS,
// e cada um tinha tido um redesign diferente em momentos diferentes — daí o
// visual misturado, emojis em uns, gradientes coloridos em outros, ciano
// light em todos. Recall do brief do dono:
//   - Sem emojis. Sem icon-badges coloridos.
//   - Logo de verdade (ab-avatar.png) + wordmark "AdBrief" em texto branco.
//   - Sem ciano-bebê em subtítulos. Branco neutro 72%.
//   - Paleta espelhando o produto (dark navy, emerald discreto pra accent).
//   - Sem faixa colorida no topo do card (estética "tutorial app" rejeitada).
//
// Esse helper aceita conteúdo (kicker, headline, sub, body, bullets, cta) e
// retorna HTML completo Resend-ready. Todas as 9 funções de email passam
// pelo mesmo build — qualquer ajuste futuro de visual atinge as 9 de uma só.

const F = "'Inter','Plus Jakarta Sans','Segoe UI',-apple-system,system-ui,sans-serif";

/** Bullet/step item — usado em welcome e algumas outras com listas numeradas. */
export interface EmailBullet {
  /** Number rendered as "01" / "02" / "03" — never an emoji. */
  index?: string;
  title: string;
  desc: string;
}

/** Stat row — par {label, value} pra usar em cards tipo trial-expiring. */
export interface EmailStat {
  label: string;
  value: string;
}

export interface EmailLayoutInput {
  /** Browser tab title + first thing the email client puts in <title>. */
  subject: string;
  /** Hidden preview text that shows next to subject in inbox lists. */
  preheader: string;

  // ── Header (consistent across all 9 emails) ─────────────────────────────
  appUrl: string;          // https://adbrief.pro

  // ── Body content ────────────────────────────────────────────────────────
  /** Greeting line above headline — "Oi Martinho —". Optional. */
  greeting?: string;
  /** Hero headline. Must be specific to this email. */
  headline: string;
  /** One-line subhead under headline — neutral white 72%, NOT cyan. Optional. */
  subhead?: string;
  /** Body paragraph(s). Plain text or HTML — passed through. */
  body: string;
  /** Optional section title above bullets ("COMO COMEÇAR EM 3 PASSOS"). */
  bulletsTitle?: string;
  /** Numbered bullet list — index "01"/"02"/"03" rendered in muted serif. */
  bullets?: EmailBullet[];
  /** Stat grid (used in trial-expiring style emails). */
  stats?: EmailStat[];

  // ── CTA ─────────────────────────────────────────────────────────────────
  ctaLabel: string;
  ctaUrl: string;
  /** Optional secondary CTA text link below the button. */
  secondaryLabel?: string;
  secondaryUrl?: string;

  // ── Microcopy ───────────────────────────────────────────────────────────
  /** Small disclosure under CTA (e.g. trial terms, security note). Optional. */
  ps?: string;
  /** Footer attribution line above the unsubscribe row. */
  footerLine: string;
}

/**
 * Builds the full HTML email string. Structure:
 *
 *   ┌────────────── outer dark bg #0A0F1C ──────────────┐
 *   │  [ab-avatar 36px]  AdBrief                         │  ← header (logo only)
 *   │                                                     │
 *   │  ┌─────────── card #0E1218, 1px white-6% ───────┐ │
 *   │  │  Greeting                                      │ │
 *   │  │  Headline (32px, white, -0.035em)              │ │
 *   │  │  Subhead (16px, white 72%, normal weight)      │ │
 *   │  │  Body (15px, white 65%)                         │ │
 *   │  │  ── thin rule ──                                │ │
 *   │  │  [optional bullets list / stats grid]           │ │
 *   │  │  ── thin rule ──                                │ │
 *   │  │  [ CTA button — emerald accent on dark teal ]   │ │
 *   │  │  Optional secondary text link                   │ │
 *   │  │  Optional ps (12px, 42% opacity)                │ │
 *   │  └────────────────────────────────────────────────┘ │
 *   │                                                     │
 *   │  Footer line · adbrief.pro                          │
 *   └─────────────────────────────────────────────────────┘
 */
export function buildEmailHtml(input: EmailLayoutInput): string {
  const {
    subject, preheader, appUrl, greeting, headline, subhead, body,
    bulletsTitle, bullets, stats, ctaLabel, ctaUrl, secondaryLabel,
    secondaryUrl, ps, footerLine,
  } = input;

  // Bullet rows — numbered, no emoji, tight typography.
  const bulletsHtml = (bullets && bullets.length)
    ? bullets.map((b, i) => {
        const idx = b.index || String(i + 1).padStart(2, "0");
        return `
        <tr><td style="padding:0 0 18px;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="40" valign="top" style="padding-top:2px;">
                <span style="font-family:${F};font-size:11px;font-weight:600;letter-spacing:0.06em;color:rgba(240,246,252,0.42);font-variant-numeric:tabular-nums;">${idx}</span>
              </td>
              <td valign="top">
                <p style="margin:0 0 4px;font-family:${F};font-size:14px;font-weight:700;color:#F0F6FC;line-height:1.4;letter-spacing:-0.01em;">${b.title}</p>
                <p style="margin:0;font-family:${F};font-size:13.5px;color:rgba(240,246,252,0.62);line-height:1.6;">${b.desc}</p>
              </td>
            </tr>
          </table>
        </td></tr>`;
      }).join("")
    : "";

  // Stats grid — used by trial-expiring / credit-alert variants.
  const statsHtml = (stats && stats.length)
    ? `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid rgba(255,255,255,0.06);border-radius:10px;margin:0 0 24px;">
        <tr>
          ${stats.map((s, i) => `
            <td style="padding:16px 18px;${i < stats.length - 1 ? "border-right:1px solid rgba(255,255,255,0.06);" : ""}" valign="top">
              <p style="margin:0 0 4px;font-family:${F};font-size:10px;font-weight:700;letter-spacing:0.10em;text-transform:uppercase;color:rgba(240,246,252,0.45);">${s.label}</p>
              <p style="margin:0;font-family:${F};font-size:18px;font-weight:700;color:#F0F6FC;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;">${s.value}</p>
            </td>
          `).join("")}
        </tr>
      </table>`
    : "";

  // Optional section title above bullets/stats.
  const sectionTitleHtml = bulletsTitle
    ? `<p style="margin:0 0 18px;font-family:${F};font-size:10.5px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(240,246,252,0.45);">${bulletsTitle}</p>`
    : "";

  // Thin rule divider (replaces the gradient bars from old templates).
  const rule = `<table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="height:1px;background:rgba(255,255,255,0.06);font-size:0;line-height:0;">&nbsp;</td></tr></table>`;

  // Whether the bullets/stats section even renders — controls whether we add
  // the second divider below it. Empty section = no double rules stacked.
  const hasMiddleSection = !!(bulletsHtml || statsHtml);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<meta name="supported-color-schemes" content="dark"/>
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0A0F1C;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">

<!-- Hidden preheader text (preview snippet in inbox) -->
<span style="display:none !important;max-height:0;overflow:hidden;mso-hide:all;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:0;line-height:0;">${preheader}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</span>

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0F1C;">
  <tr><td align="center" style="padding:36px 16px 48px;">

    <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">

      <!-- ── HEADER ───────────────────────────────────────────────── -->
      <!-- Brand wordmark splits "ad" (white) + "brief" (#0ea5e9 brand cyan)
           to match the canonical lockup used in the product header and the
           ab-avatar gradient. Emerald is reserved for system-state signals
           inside the app — not for brand identity. -->
      <tr><td style="padding-bottom:24px;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding-right:10px;vertical-align:middle;">
              <img src="${appUrl}/ab-avatar.png" alt="AdBrief" width="36" height="36" style="display:block;width:36px;height:36px;border-radius:8px;border:0;outline:none;text-decoration:none;"/>
            </td>
            <td style="vertical-align:middle;">
              <span style="font-family:${F};font-size:18px;font-weight:800;color:#F0F6FC;letter-spacing:-0.025em;">ad</span><span style="font-family:${F};font-size:18px;font-weight:800;color:#0ea5e9;letter-spacing:-0.025em;">brief</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- ── CARD ─────────────────────────────────────────────────── -->
      <tr><td style="background:#0E1218;border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;">

        <!-- Hero block -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:36px 36px 28px;">

            ${greeting ? `<p style="margin:0 0 10px;font-family:${F};font-size:13px;color:rgba(240,246,252,0.55);font-weight:500;">${greeting}</p>` : ""}

            <h1 style="margin:0;font-family:${F};font-size:30px;font-weight:800;color:#F0F6FC;letter-spacing:-0.035em;line-height:1.12;">${headline}</h1>

            ${subhead ? `<p style="margin:14px 0 0;font-family:${F};font-size:16px;font-weight:500;color:rgba(240,246,252,0.72);line-height:1.45;letter-spacing:-0.01em;">${subhead}</p>` : ""}

            ${body ? `<p style="margin:18px 0 0;font-family:${F};font-size:15px;color:rgba(240,246,252,0.65);line-height:1.65;">${body}</p>` : ""}

          </td></tr>
        </table>

        ${hasMiddleSection ? `
        <!-- Rule -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 36px;">${rule}</td></tr></table>

        <!-- Section block -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:28px 36px 20px;">
            ${sectionTitleHtml}
            ${statsHtml}
            ${bulletsHtml ? `<table cellpadding="0" cellspacing="0" border="0" width="100%">${bulletsHtml}</table>` : ""}
          </td></tr>
        </table>` : ""}

        <!-- Rule -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 36px;">${rule}</td></tr></table>

        <!-- CTA block -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td align="left" style="padding:26px 36px 32px;">

            <!-- Primary CTA — uses AdBrief brand cyan (#0ea5e9). Dark navy
                 fill (#082237) so the button reads weighty without a saturated
                 cyan-on-cyan box. Border at 60% brand cyan + tab-spaced text
                 in white. No gradient (rejected by design rules). -->
            <table cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:#082237;border:1px solid rgba(14,165,233,0.60);border-radius:10px;">
                <a href="${ctaUrl}" style="display:inline-block;padding:13px 26px;font-family:${F};font-size:14px;font-weight:700;color:#F0F6FC;text-decoration:none;letter-spacing:-0.005em;">${ctaLabel}</a>
              </td></tr>
            </table>

            ${secondaryLabel && secondaryUrl ? `
            <p style="margin:14px 0 0;">
              <a href="${secondaryUrl}" style="font-family:${F};font-size:13px;font-weight:500;color:rgba(240,246,252,0.55);text-decoration:none;">${secondaryLabel} →</a>
            </p>` : ""}

            ${ps ? `<p style="margin:18px 0 0;font-family:${F};font-size:12px;color:rgba(240,246,252,0.42);line-height:1.55;">${ps}</p>` : ""}

          </td></tr>
        </table>

      </td></tr>

      <!-- ── FOOTER ───────────────────────────────────────────────── -->
      <tr><td style="padding:24px 8px 0;" align="left">
        <p style="margin:0;font-family:${F};font-size:11.5px;color:rgba(240,246,252,0.38);line-height:1.55;">
          ${footerLine} · <a href="${appUrl}" style="color:rgba(240,246,252,0.55);text-decoration:none;">adbrief.pro</a>
        </p>
      </td></tr>

    </table>

  </td></tr>
</table>

</body>
</html>`;
}
