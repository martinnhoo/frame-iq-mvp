import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";

const Terms = () => (
  <div className="min-h-screen bg-background text-foreground">
    <Helmet>
      <title>Terms of Service — AdBrief</title>
      <meta name="description" content="Terms of Service for AdBrief, the AI-powered creative intelligence platform for performance marketing." />
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
      <p className="text-sm text-muted-foreground">Last updated: March 24, 2026</p>

      <section className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <h2 className="text-lg font-semibold text-foreground">1. Agreement to Terms</h2>
        <p>By accessing or using AdBrief ("the Service"), operated by AdBrief ("we", "us", or "our"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>

        <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
        <p>AdBrief is an AI-powered chat platform for performance marketers that connects to your ad accounts (Meta Ads, Google Ads) and allows you to analyze campaign performance, generate creative content, scripts, hooks, and related marketing tools through a conversational AI interface.</p>

        <h2 className="text-lg font-semibold text-foreground">3. Eligibility</h2>
        <p>You must be at least 18 years old and capable of forming a binding contract to use the Service. By using AdBrief, you represent that you meet these requirements.</p>

        <h2 className="text-lg font-semibold text-foreground">4. Account Registration</h2>
        <p>To access certain features, you must create an account with accurate and complete information. You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.</p>

        <h2 className="text-lg font-semibold text-foreground">5. Subscription Plans & Billing</h2>
        <p>AdBrief offers the following paid plans: Maker ($19/mo), Pro ($49/mo), and Studio ($149/mo). All plans include a 3-day free trial with a valid payment method required. Paid plans are billed monthly or annually. You authorize us to charge the payment method on file. Prices are in USD and may be subject to applicable taxes.</p>
        <p>We reserve the right to change pricing with 30 days' notice. Changes will apply at the next billing cycle.</p>

        <h2 className="text-lg font-semibold text-foreground">6. Free Trial</h2>
        <p>All paid plans include a 3-day free trial. A valid payment method is required to start the trial. If you do not cancel before the trial ends, you will be charged the applicable subscription fee.</p>

        <h2 className="text-lg font-semibold text-foreground">7. Cancellation</h2>
        <p>You may cancel your subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period. No partial refunds are provided for unused portions of a billing period, except as described in our Refund Policy.</p>

        <h2 className="text-lg font-semibold text-foreground">8. Ad Platform Integrations</h2>
        <p>AdBrief integrates with Meta Ads and Google Ads via their respective APIs to display your campaign data within the platform. By connecting your ad accounts:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>You authorize AdBrief to access your ad account data in read-only mode for analysis purposes</li>
          <li>You represent that you have the authority to connect those accounts</li>
          <li>You acknowledge that AdBrief does not make changes to your ad campaigns or spend your budget</li>
          <li>You can disconnect any connected account at any time from the Accounts page</li>
        </ul>
        <p>Our use of Meta and Google APIs is subject to their respective terms of service. AdBrief's use of Google API data complies with the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google API Services User Data Policy</a>.</p>

        <h2 className="text-lg font-semibold text-foreground">9. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Use the Service for any unlawful purpose or to violate any laws</li>
          <li>Upload content that infringes on intellectual property rights</li>
          <li>Attempt to reverse engineer, decompile, or disassemble the Service</li>
          <li>Use automated tools to scrape or extract data from the Service</li>
          <li>Interfere with the security or integrity of the Service</li>
          <li>Resell or redistribute the Service without authorization</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">10. Intellectual Property</h2>
        <p>All content generated by AdBrief's AI tools (boards, analyses, translations, hooks) belongs to you, the user. However, AdBrief retains ownership of the platform, algorithms, models, and underlying technology.</p>
        <p>You grant AdBrief a limited license to use anonymized and aggregated data to improve the Service.</p>

        <h2 className="text-lg font-semibold text-foreground">11. Content You Upload</h2>
        <p>You retain ownership of all content you upload. By uploading content, you represent that you have the right to do so. AdBrief processes uploaded content solely to provide the Service and does not claim ownership.</p>

        <h2 className="text-lg font-semibold text-foreground">12. Privacy</h2>
        <p>Your use of the Service is also governed by our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.</p>

        <h2 className="text-lg font-semibold text-foreground">13. Limitation of Liability</h2>
        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, ADBRIEF SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.</p>
        <p>Our total liability for any claim arising from the Service shall not exceed the amount you paid us in the 12 months preceding the claim.</p>

        <h2 className="text-lg font-semibold text-foreground">14. Disclaimer of Warranties</h2>
        <p>THE SERVICE IS PROVIDED "AS IS"AND "AS AVAILABLE"WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. AI-generated content is for informational purposes and should not be considered professional advice.</p>

        <h2 className="text-lg font-semibold text-foreground">15. Service Availability</h2>
        <p>We strive for 99.9% uptime but do not guarantee uninterrupted access. We may perform maintenance or updates that temporarily affect availability.</p>

        <h2 className="text-lg font-semibold text-foreground">16. Modifications to Terms</h2>
        <p>We may update these Terms at any time. Material changes will be communicated via email or in-app notification at least 30 days in advance. Continued use after changes constitutes acceptance.</p>

        <h2 className="text-lg font-semibold text-foreground">17. Termination</h2>
        <p>We may suspend or terminate your account if you violate these Terms. Upon termination, your right to use the Service ceases immediately. You may export your data before termination.</p>

        <h2 className="text-lg font-semibold text-foreground">18. Governing Law</h2>
        <p>These Terms are governed by the laws of the State of Delaware, United States, without regard to conflict of law principles.</p>

        <h2 className="text-lg font-semibold text-foreground">19. Contact</h2>
        <p>For questions about these Terms, contact us at <a href="mailto:legal@adbrief.pro" className="text-primary hover:underline">legal@adbrief.pro</a>.</p>
      </section>
    </main>

    <footer className="border-t border-border/50 py-8 px-6">
      <div className="container mx-auto max-w-3xl text-center text-xs text-muted-foreground/60">
        © 2026 AdBrief. All rights reserved.
        {" · "}<Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        {" · "}<Link to="/refund" className="hover:text-foreground transition-colors">Refund Policy</Link>
        {" · "}<Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
      </div>
    </footer>
  </div>
);

export default Terms;
