import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LegalModalProps {
  type: "privacy" | "terms" | null;
  onClose: () => void;
}

const privacyContent = `
# Privacy Policy

**Last updated: March 9, 2026**

AdBrief ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.

## 1. Information We Collect

### 1.1 Personal Information
When you create an account, we collect:
- Name and email address
- Company name and role
- Billing information (processed by our payment provider)

### 1.2 Usage Data
We automatically collect:
- Videos and files you upload for analysis
- Analysis results and generated boards
- Log data (IP address, browser type, device information)
- Usage patterns and feature interactions

### 1.3 Cookies and Tracking
We use essential cookies for authentication and session management. Analytics cookies (optional) help us understand usage patterns. You can manage cookie preferences at any time.

## 2. How We Use Your Information

We use collected information to:
- Provide and maintain our AI analysis and generation services
- Process your video uploads and generate creative insights
- Improve our AI models and platform features
- Send service-related communications
- Comply with legal obligations

## 3. Data Security

Your uploaded content is encrypted at rest (AES-256) and in transit (TLS 1.3). We maintain SOC 2 Type II compliance. Video files are processed in isolated environments and are not shared between accounts.

## 4. Data Retention

- Account data: Retained while your account is active
- Uploaded videos: Retained for 90 days after analysis, then deleted
- Analysis results: Retained while your account is active
- Generated boards: Retained while your account is active

You can request deletion of your data at any time by contacting support@adbrief.pro.

## 5. Your Content & AI Training

**We do NOT use your uploaded videos, analysis results, or generated content to train our AI models.** Your competitive intelligence and creative insights remain completely private and are never shared with other users or third parties.

## 6. Third-Party Services

We use the following third-party services:
- **OpenAI & Anthropic**: For AI-powered analysis and generation (your content is processed under our enterprise agreements with strict data handling terms)
- **Payment processor**: For subscription billing
- **Cloud infrastructure**: For secure data storage and processing

## 7. International Data Transfers

If you are located outside the United States, your data may be transferred to and processed in the United States, where our servers are located. We use Standard Contractual Clauses to ensure adequate data protection.

## 8. Your Rights

You have the right to:
- Access your personal data
- Correct inaccurate data
- Delete your account and data
- Export your data
- Opt out of analytics cookies
- Withdraw consent at any time

## 9. Children's Privacy

AdBrief is not intended for users under 18 years of age. We do not knowingly collect data from minors. We do not knowingly collect data from minors.

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any material changes via email or in-app notification.

## 11. Contact Us

For privacy-related inquiries:
**Email:** support@frameiq.com
`;

const termsContent = `
# Terms of Service

**Last updated: March 9, 2026**

These Terms of Service ("Terms") govern your access to and use of FrameIQ's platform, products, and services.

## 1. Acceptance of Terms

By accessing or using FrameIQ, you agree to be bound by these Terms. If you are using FrameIQ on behalf of a company, you represent that you have authority to bind that company to these Terms.

## 2. Description of Service

FrameIQ is an AI-powered creative intelligence platform that provides:
- Video ad analysis and insight extraction
- AI-generated production boards and creative briefs
- Auto-translation of video content
- Creative intelligence reports and trend analysis
- AI video generation from production boards
- REST API for programmatic access

## 3. Account Registration

You must create an account to use FrameIQ. You are responsible for:
- Providing accurate account information
- Maintaining the security of your credentials
- All activity under your account
- Notifying us immediately of unauthorized access

## 4. Subscription Plans & Billing

### 4.1 Plans
FrameIQ offers Free, Studio, and Scale plans with varying usage limits. Plan features and pricing are as described on our pricing page.

### 4.2 Billing
Paid subscriptions are billed monthly or annually. All fees are non-refundable except as required by law. We may change pricing with 30 days' notice.

### 4.3 Usage Limits
Each plan includes specific limits for analyses, boards, video generation, and team seats. Exceeding limits may result in temporary service restrictions until the next billing cycle.

## 5. Acceptable Use

You agree NOT to:
- Upload content that violates intellectual property rights
- Use FrameIQ for illegal purposes or to analyze illegal content
- Attempt to reverse-engineer our AI models or algorithms
- Share account credentials or exceed your plan's seat limit
- Use automated tools to scrape or overload our systems
- Upload content that is harmful, abusive, or violates others' privacy

## 6. Intellectual Property

### 6.1 Your Content
You retain all rights to content you upload and content generated by FrameIQ based on your inputs. We do not claim ownership of your analyses, boards, or generated videos.

### 6.2 Our Platform
FrameIQ's platform, AI models, algorithms, and interface are our proprietary property. These Terms do not grant you any rights to our intellectual property beyond the limited license to use the service.

### 6.3 Feedback
If you provide feedback or suggestions, we may use them to improve our platform without obligation to you.

## 7. AI-Generated Content

Content generated by FrameIQ's AI (boards, scripts, videos) is provided "as-is." You are responsible for:
- Reviewing generated content before use
- Ensuring compliance with advertising regulations in your market
- Verifying that generated content does not infringe third-party rights
- Making final creative decisions (AI is a tool, not a replacement for judgment)

## 8. Data Handling

Your data is handled in accordance with our Privacy Policy. Key points:
- We do NOT use your content to train AI models
- Uploaded videos are encrypted and isolated
- You can delete your data at any time

## 9. Service Availability

We target 99.9% uptime but do not guarantee uninterrupted service. We may perform maintenance with reasonable notice. We are not liable for downtime caused by factors beyond our control.

## 10. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, FRAMEIQ SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES.

Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.

## 11. Indemnification

You agree to indemnify FrameIQ against claims arising from your use of the platform, your content, or your violation of these Terms.

## 12. Termination

Either party may terminate at any time. Upon termination:
- Your access to FrameIQ will cease
- We will retain your data for 30 days, then delete it
- Outstanding fees remain due

## 13. Governing Law

These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict of law principles.

## 14. Dispute Resolution

Any disputes shall be resolved through binding arbitration under the rules of the American Arbitration Association, conducted in English.

## 15. Changes to Terms

We may update these Terms with 30 days' notice. Continued use after changes constitutes acceptance.

## 16. Contact

For questions about these Terms:
**Email:** support@frameiq.com
`;

const LegalModal = ({ type, onClose }: LegalModalProps) => {
  if (!type) return null;

  const content = type === "privacy" ? privacyContent : termsContent;
  const title = type === "privacy" ? "Privacy Policy" : "Terms of Service";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden"
          style={{ background: '#0c0c0c', border: '1px solid rgba(139, 92, 246, 0.2)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <h2 className="text-lg font-bold">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <ScrollArea className="h-[calc(80vh-65px)]">
            <div className="px-6 py-6 prose-sm">
              {content.split('\n').map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mb-4 gradient-text">{line.replace('# ', '')}</h1>;
                if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold mt-8 mb-3 text-foreground">{line.replace('## ', '')}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-base font-medium mt-4 mb-2 text-foreground">{line.replace('### ', '')}</h3>;
                if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-sm font-semibold text-foreground mb-2">{line.replace(/\*\*/g, '')}</p>;
                if (line.startsWith('- ')) return <li key={i} className="text-sm text-muted-foreground ml-4 mb-1 list-disc">{line.replace('- ', '')}</li>;
                if (line.trim() === '') return <div key={i} className="h-2" />;
                return <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-2">{line}</p>;
              })}
            </div>
          </ScrollArea>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LegalModal;
