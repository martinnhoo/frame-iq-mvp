import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Helmet } from "react-helmet-async";

const Refund = () => (
  <div className="min-h-screen bg-background text-foreground">
    <Helmet>
      <title>Refund Policy — AdBrief</title>
      <meta name="description" content="Refund Policy for AdBrief subscriptions. 30-day money-back guarantee on first payment." />
      <link rel="canonical" href="https://adbrief.pro/refund" />
    </Helmet>

    <nav className="border-b border-border/50 bg-background/60 backdrop-blur-xl">
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/"><Logo size="lg" /></Link>
        <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
      </div>
    </nav>

    <main className="container mx-auto max-w-3xl px-6 py-16 space-y-8">
      <h1 className="text-3xl font-bold">Refund Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: March 11, 2026</p>

      <section className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <h2 className="text-lg font-semibold text-foreground">1. 30-Day Money-Back Guarantee</h2>
        <p>We offer a <strong>30-day money-back guarantee</strong> on the first payment for Creator and Studio plans. If you are not satisfied with the Service within the first 30 days of your first paid subscription, you may request a full refund.</p>

        <h2 className="text-lg font-semibold text-foreground">2. How to Request a Refund</h2>
        <p>To request a refund, contact us at <a href="mailto:billing@adbrief.pro" className="text-primary hover:underline">billing@adbrief.pro</a> with:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>Your account email address</li>
          <li>The reason for the refund request</li>
          <li>Date of purchase</li>
        </ul>
        <p>Refund requests must be submitted within 30 days of the first payment date.</p>

        <h2 className="text-lg font-semibold text-foreground">3. Refund Processing</h2>
        <p>Approved refunds will be processed within 5-10 business days and returned to the original payment method. You will receive an email confirmation once the refund has been issued.</p>

        <h2 className="text-lg font-semibold text-foreground">4. What's Not Eligible for Refund</h2>
        <ul className="list-disc pl-6 space-y-1">
          <li>Subsequent monthly payments after the first billing cycle</li>
          <li>Scale plan subscriptions (custom agreements apply)</li>
          <li>Refund requests made after 30 days from the first payment</li>
          <li>Accounts terminated due to Terms of Service violations</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">5. Free Trial</h2>
        <p>Studio plans include a 14-day free trial. You will not be charged during the trial period. If you cancel before the trial ends, no payment is taken and no refund is needed.</p>

        <h2 className="text-lg font-semibold text-foreground">6. Cancellation vs. Refund</h2>
        <p>Cancelling your subscription stops future billing but does not trigger a refund. Your access continues until the end of the current billing period. If you want a refund, you must explicitly request one as described above.</p>

        <h2 className="text-lg font-semibold text-foreground">7. Downgrades</h2>
        <p>If you downgrade to a lower plan or to Free, the change takes effect at the next billing cycle. No prorated refunds are issued for downgrades.</p>

        <h2 className="text-lg font-semibold text-foreground">8. Chargebacks</h2>
        <p>If you initiate a chargeback instead of contacting us first, we reserve the right to suspend your account. We encourage you to reach out to us directly so we can resolve any billing issues promptly.</p>

        <h2 className="text-lg font-semibold text-foreground">9. Contact</h2>
        <p>For billing and refund questions, contact us at <a href="mailto:billing@adbrief.pro" className="text-primary hover:underline">billing@adbrief.pro</a>.</p>
      </section>
    </main>

    <footer className="border-t border-border/50 py-8 px-6">
      <div className="container mx-auto max-w-3xl text-center text-xs text-muted-foreground/60">
        © 2026 AdBrief. All rights reserved.
        {" · "}<Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
        {" · "}<Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        {" · "}<Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
      </div>
    </footer>
  </div>
);

export default Refund;
