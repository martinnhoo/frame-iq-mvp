import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";

const Privacy = () => (
  <div className="min-h-screen bg-background text-foreground">
    <Helmet>
      <title>Privacy Policy — AdBrief</title>
      <meta name="description" content="Privacy Policy for AdBrief. Learn how we collect, use, and protect your data." />
      <link rel="canonical" href="https://adbrief.pro/privacy" />
    </Helmet>

    <nav className="border-b border-border/50 bg-background/60 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/"><Logo size="lg" /></Link>
        <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
      </div>
    </nav>

    <main className="container mx-auto max-w-3xl px-6 py-16 space-y-8">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: March 24, 2026</p>

      <section className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <h2 className="text-lg font-semibold text-foreground">1. Introduction</h2>
        <p>AdBrief ("we", "us", "our") operates the AdBrief platform at adbrief.pro. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.</p>

        <h2 className="text-lg font-semibold text-foreground">2. Information We Collect</h2>
        <h3 className="font-semibold text-foreground/80">2.1 Information You Provide</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Account data:</strong> Name, email address, password (hashed)</li>
          <li><strong>Profile data:</strong> Preferred language, market, onboarding preferences</li>
          <li><strong>Payment data:</strong> Processed by our payment provider (Stripe). We do not store card numbers</li>
          <li><strong>Brand data:</strong> Brand name, written preferences and guidelines, logo, and reference images you upload</li>
          <li><strong>Content:</strong> Prompts, scripts and creative assets you upload or generate</li>
        </ul>

        <h3 className="font-semibold text-foreground/80">2.2 Information Collected Automatically</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Usage data:</strong> Features used, analyses run, boards created, timestamps</li>
          <li><strong>Device data:</strong> Browser type, operating system, screen resolution</li>
          <li><strong>Cookies:</strong> Essential cookies for authentication and preferences. Analytics cookies with your consent</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">3. How We Use Your Information</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Provide, maintain, and improve the Service</li>
          <li>Process transactions and manage subscriptions</li>
          <li>Send transactional emails (welcome, password reset, usage alerts)</li>
          <li>Generate creative assets (images, videos, voiceovers, captions, scripts)</li>
          <li>Apply your saved brand context to generations</li>
          <li>Meter credit consumption for billing, usage limits and abuse prevention</li>
          <li>Detect and prevent fraud or abuse</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">4. AI Processing and Sub-Processors</h2>
        <p>To generate content, we transmit your prompts and — where relevant — your uploaded brand materials to third-party AI providers acting as our sub-processors:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>OpenAI</strong> — image generation, transcription, captions</li>
          <li><strong>PiAPI</strong> (Kling, and other video models) — video generation</li>
          <li><strong>Fish Audio</strong> — voice generation</li>
          <li><strong>Bria</strong> — background removal and image editing</li>
          <li><strong>Anthropic</strong> — text generation (scripts, hooks, copy)</li>
        </ul>
        <p>Each provider processes your input under its own terms and privacy policy. We transmit only what is needed for the requested generation. We do not use your brand materials or generated assets to train any model, and we do not sell your data.</p>
        <p>Generated assets are stored in our infrastructure so you can access them in your library. You can delete them at any time.</p>

        <h2 className="text-lg font-semibold text-foreground">5. Ad Platform Connections</h2>
        <p>AdBrief no longer requires or requests access to your advertising accounts. Any ad platform connection previously authorised is inactive and no campaign data is being collected. If you connected an account in the past, you may remove it from the Accounts page, and you can request deletion of any retained data using the contact details in Section 15.</p>

        <h2 className="text-lg font-semibold text-foreground">6. Data Sharing</h2>
        <p>We do not sell your personal data. We share data only with:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Service providers:</strong> Cloud hosting, payment processing, email delivery</li>
          <li><strong>AI providers:</strong> For content processing as described above</li>
          <li><strong>Legal requirements:</strong> When required by law or to protect our rights</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">7. Data Security</h2>
        <p>We implement industry-standard security measures including:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>256-bit TLS encryption for data in transit</li>
          <li>AES-256 encryption for data at rest</li>
          <li>Row-level security policies on all database tables</li>
          <li>Hashed passwords (never stored in plain text)</li>
          <li>Regular security audits</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">8. Data Retention</h2>
        <p>We retain your account data for as long as your account is active. Content data (videos, analyses, boards) is retained for as long as you choose. You may delete your content at any time. Upon account deletion, all personal data is removed within 30 days.</p>

        <h2 className="text-lg font-semibold text-foreground">9. Your Rights</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate personal data</li>
          <li>Delete your personal data</li>
          <li>Export your data in a portable format</li>
          <li>Object to or restrict processing</li>
          <li>Withdraw consent at any time</li>
        </ul>
        <p>To exercise these rights, contact us at <a href="mailto:privacy@adbrief.pro" className="text-primary hover:underline">privacy@adbrief.pro</a>.</p>

        <h2 className="text-lg font-semibold text-foreground">10. GDPR Compliance</h2>
        <p>For users in the European Economic Area (EEA), we process data under lawful bases including contract performance, legitimate interest, and consent. Our data processing activities comply with the General Data Protection Regulation (GDPR).</p>

        <h2 className="text-lg font-semibold text-foreground">11. LGPD Compliance (Brazil)</h2>
        <p>For users in Brazil, we comply with the Lei Geral de Proteção de Dados (LGPD). You have the right to access, correct, delete, and port your data. Contact our Data Protection Officer at <a href="mailto:privacy@adbrief.pro" className="text-primary hover:underline">privacy@adbrief.pro</a>.</p>

        <h2 className="text-lg font-semibold text-foreground">12. Cookies</h2>
        <p>We use essential cookies for authentication and session management. Analytics cookies are only set with your explicit consent via our cookie banner. You can manage cookie preferences at any time.</p>

        <h2 className="text-lg font-semibold text-foreground">13. Children's Privacy</h2>
        <p>The Service is not intended for users under 18 years old. We do not knowingly collect data from minors.</p>

        <h2 className="text-lg font-semibold text-foreground">14. Changes to This Policy</h2>
        <p>We may update this Privacy Policy periodically. Material changes will be communicated via email or in-app notification. Continued use constitutes acceptance.</p>

        <h2 className="text-lg font-semibold text-foreground">15. Contact</h2>
        <p>For privacy-related inquiries, contact us at <a href="mailto:privacy@adbrief.pro" className="text-primary hover:underline">privacy@adbrief.pro</a>.</p>
      </section>
    </main>

    <footer className="border-t border-border/50 py-8 px-6">
      <div className="container mx-auto max-w-3xl text-center text-xs text-muted-foreground/60">
        © 2026 AdBrief. All rights reserved.
        {" · "}<Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
        {" · "}<Link to="/refund" className="hover:text-foreground transition-colors">Refund Policy</Link>
        {" · "}<Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
      </div>
    </footer>
  </div>
);

export default Privacy;
