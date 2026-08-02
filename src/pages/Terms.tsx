import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";

/**
 * Termos de Uso — reescritos em 02/08/2026 para o Hub Criativo.
 *
 * A versão anterior descrevia o produto de media buyer (conexão com Meta Ads,
 * análise de campanha). Cobrar por um produto cujos termos descrevem outro
 * produto é exposição a chargeback e a reclamação de consumidor.
 *
 * ⚠️ Este texto foi escrito por engenharia, não por advogado. Antes de operar
 * em volume, mande revisar — especialmente as seções de créditos, reembolso e
 * conteúdo gerado por IA.
 */
const Terms = () => (
  <div className="min-h-screen bg-background text-foreground">
    <Helmet>
      <title>Terms of Service — AdBrief</title>
      <meta name="description" content="Terms of Service for AdBrief Hub, the AI creative production platform for advertising." />
      <link rel="canonical" href="https://adbrief.pro/terms" />
    </Helmet>

    <nav className="border-b border-border/50 bg-background/60 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/"><Logo size="lg" /></Link>
        <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
      </div>
    </nav>

    <main className="container mx-auto max-w-3xl px-6 py-16 space-y-8">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Last updated: August 2, 2026</p>

      <section className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <h2 className="text-lg font-semibold text-foreground">1. Agreement to Terms</h2>
        <p>By accessing or using AdBrief ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>

        <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
        <p>AdBrief is an AI creative production platform for advertising. The Service allows you to generate images, videos, voiceovers, captions, scripts and related creative assets, and to store brand preferences, logos and reference materials that are reused across generations.</p>
        <p>Generation is performed by third-party AI models operated by independent providers. AdBrief orchestrates these models, applies your brand context, and manages your usage — it does not train or own the underlying models.</p>

        <h2 className="text-lg font-semibold text-foreground">3. Eligibility</h2>
        <p>You must be at least 18 years old and capable of forming a binding contract. By using AdBrief, you represent that you meet these requirements.</p>

        <h2 className="text-lg font-semibold text-foreground">4. Account Registration</h2>
        <p>You must provide accurate and complete information. You are responsible for the confidentiality of your credentials and for all activity under your account. Creating multiple accounts to obtain additional free credits is a violation of these Terms and may result in suspension.</p>

        <h2 className="text-lg font-semibold text-foreground">5. Plans and Pricing</h2>
        <p>AdBrief offers a Free plan and the following paid plans:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Creator</strong> — R$ 97 / US$ 19 per month</li>
          <li><strong>Pro</strong> — R$ 247 / US$ 49 per month</li>
          <li><strong>Studio</strong> — R$ 497 / US$ 99 per month</li>
        </ul>
        <p>Annual plans are billed once for ten months of the equivalent monthly price. You authorize us to charge the payment method on file on each renewal until you cancel. Prices may be subject to applicable taxes.</p>
        <p>We may change pricing with 30 days' notice. Changes apply from your next billing cycle. Your current cycle is never repriced.</p>

        <h2 className="text-lg font-semibold text-foreground">6. Credits and Usage Limits</h2>
        <p>Each plan includes a monthly allowance of credits. Generating content consumes credits according to a published cost table available on the Plans page inside the product.</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Subscription credits reset at the start of each billing cycle and <strong>do not roll over</strong>.</li>
          <li>Credit packs purchased separately are valid for 12 months from purchase.</li>
          <li>Credits are reserved when a generation starts and are <strong>refunded automatically if the generation fails</strong>.</li>
          <li>Credits have no cash value, are not transferable, and cannot be exchanged for money.</li>
          <li>Plans also carry limits on the number of videos per day and per month, and on simultaneous generations. These protect service availability for all users.</li>
        </ul>
        <p>The Free plan produces watermarked output at draft quality and is intended for evaluation, not commercial use.</p>

        <h2 className="text-lg font-semibold text-foreground">7. Promotional Offers and Coupons</h2>
        <p>Promotional pricing applies only when a valid coupon code is entered at checkout, only for the number of billing cycles stated at the time of purchase, and only on a first subscription. When the promotional period ends, the plan renews automatically at the standard price shown at checkout. Coupons may be limited in quantity and withdrawn at any time.</p>

        <h2 className="text-lg font-semibold text-foreground">8. Right of Withdrawal and Refunds</h2>
        <p><strong>Consumers in Brazil:</strong> under Article 49 of the Consumer Protection Code (Lei nº 8.078/1990), you may cancel a purchase made online within <strong>7 (seven) days</strong> of contracting and receive a full refund. To exercise this right, contact us at the address in Section 17.</p>
        <p>Outside that window, you may cancel at any time from your account settings. Cancellation takes effect at the end of the current billing period; access continues until then. Partial periods and credits already consumed are not refunded, as the corresponding third-party processing costs have already been incurred.</p>

        <h2 className="text-lg font-semibold text-foreground">9. AI-Generated Content</h2>
        <p>Subject to your compliance with these Terms and with the terms of the underlying model providers, <strong>you own the creative assets you generate</strong> and may use them commercially, except when generated under the Free plan.</p>
        <p>You acknowledge that:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>AI output is probabilistic. We do not warrant that generated content is unique, accurate, non-infringing, or fit for any particular purpose.</li>
          <li>Similar prompts may produce similar results for different users. We cannot grant exclusivity over any output.</li>
          <li>The legal status of AI-generated works, including copyright protection, varies by jurisdiction and is evolving.</li>
          <li><strong>You are responsible for reviewing every asset before publishing it</strong>, including its compliance with advertising rules, platform policies, and applicable law.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">10. Voice Generation</h2>
        <p>The Service provides access to a catalogue of synthetic voices. You agree not to use voice generation to imitate a real, identifiable person, to create content that could mislead listeners as to identity or endorsement, or to produce material that violates personality or publicity rights.</p>
        <p>We filter the catalogue to exclude voices we identify as clones of public figures or protected characters, but this filtering is not exhaustive. Responsibility for the final use of any voice rests with you.</p>

        <h2 className="text-lg font-semibold text-foreground">11. Content You Upload</h2>
        <p>You retain ownership of logos, reference images, brand materials and any other content you upload. By uploading, you represent that you hold the necessary rights. We process uploaded content solely to operate the Service — including sending it to model providers as generation input — and claim no ownership over it.</p>

        <h2 className="text-lg font-semibold text-foreground">12. Acceptable Use</h2>
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Generate content that is unlawful, defamatory, discriminatory, or that sexualises minors</li>
          <li>Impersonate a real person or organisation, or create deceptive political content</li>
          <li>Infringe intellectual property, personality or publicity rights</li>
          <li>Produce advertising that is misleading or that violates the policies of the platform where it will run</li>
          <li>Reverse engineer the Service, or resell or redistribute access without authorisation</li>
          <li>Circumvent usage limits, including through automated tools or multiple accounts</li>
        </ul>
        <p>We may suspend accounts that violate this section, without refund of consumed credits.</p>

        <h2 className="text-lg font-semibold text-foreground">13. Third-Party Providers</h2>
        <p>Generation depends on third-party AI providers. Their availability, pricing and capabilities may change without notice, and a provider outage may temporarily prevent generation. We may substitute or add providers to maintain or improve the Service. Unused credits remain valid across such changes.</p>

        <h2 className="text-lg font-semibold text-foreground">14. Intellectual Property in the Platform</h2>
        <p>AdBrief retains ownership of the platform, its interface, workflows and underlying technology. You grant us a limited licence to use anonymised, aggregated usage data to improve the Service. We do not use your uploaded brand materials or generated assets to train models.</p>

        <h2 className="text-lg font-semibold text-foreground">15. Privacy</h2>
        <p>Your use of the Service is also governed by our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.</p>

        <h2 className="text-lg font-semibold text-foreground">16. Disclaimers and Limitation of Liability</h2>
        <p>THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. We strive for high availability but do not guarantee uninterrupted access.</p>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, ADBRIEF SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS OR ADVERTISING REVENUE. Our total liability for any claim shall not exceed the amount you paid us in the 12 months preceding the claim.</p>
        <p>Nothing in these Terms limits rights that cannot be limited under applicable consumer protection law.</p>

        <h2 className="text-lg font-semibold text-foreground">17. Contact</h2>
        <p>Questions, cancellations and refund requests: <a href="mailto:suporte@adbrief.pro" className="text-primary hover:underline">suporte@adbrief.pro</a>.</p>

        <h2 className="text-lg font-semibold text-foreground">18. Modifications and Governing Law</h2>
        <p>We may update these Terms. Material changes will be communicated by email or in-app notice at least 30 days in advance, and continued use after that period constitutes acceptance. These Terms are governed by the laws of Brazil, without prejudice to mandatory consumer protection rules of your place of residence.</p>
      </section>

      <div className="pt-8 border-t border-border/50">
        <Link to="/" className="text-sm text-primary hover:underline">← Back to home</Link>
      </div>
    </main>
  </div>
);

export default Terms;
