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
          <li><strong>Content:</strong> Videos, scripts, and creative assets you upload for analysis or processing</li>
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
          <li>Generate AI-powered analyses and creative outputs</li>
          <li>Build your personalized AI profile to improve recommendations</li>
          <li>Monitor usage for billing and rate limiting</li>
          <li>Detect and prevent fraud or abuse</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">4. AI Processing</h2>
        <p>Content you upload is processed by AI models to provide analyses, translations, and creative outputs. We use Anthropic Claude for AI-powered chat and analysis. Uploaded content is processed in real-time and is not used to train third-party AI models. Anonymized, aggregated usage patterns may be used to improve our service.</p>

        <h2 className="text-lg font-semibold text-foreground">5. Meta Ads & Meta Ads API Integration</h2>
        <p>AdBrief integrates with the Meta Ads API and Meta Ads API to allow users to connect their ad accounts and view campaign performance data within the platform.</p>
        <p><strong>When you connect your Meta Ads or Google Ads account:</strong></p>
        <ul className="list-disc pl-6 space-y-1">
          <li>We access campaign data, ad performance metrics, creatives, and time series data solely to display insights within your AdBrief dashboard</li>
          <li>We use OAuth 2.0 for secure authentication — we never store your Google or Meta password</li>
          <li>Ad platform data is used only to provide the AdBrief service and is never sold or shared with third parties</li>
          <li>You can disconnect your ad accounts at any time from the Accounts page in your dashboard</li>
          <li>OAuth tokens are stored securely and encrypted at rest</li>
        </ul>
        <p>AdBrief's use of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements. We do not use Google user data for serving advertisements, and we do not allow humans to read Google user data unless you have explicitly given us permission, it is necessary for security purposes, or we are required to do so by law.</p>

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
