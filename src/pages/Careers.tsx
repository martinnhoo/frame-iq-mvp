import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Clock, DollarSign, Users, Briefcase, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";

const openPositions = [
  {
    id: "sales-rep",
    title: "Sales Development Representative",
    department: "Sales",
    location: "Remote — Worldwide",
    type: "Full-time",
    compensation: "Competitive base + uncapped commission",
    posted: "March 2026",
    description:
      "We're looking for a driven, self-motivated Sales Development Representative to join our growing revenue team. You'll be responsible for generating qualified pipeline through outbound prospecting, cold calls, and multi-channel outreach to performance marketing teams and creative agencies worldwide.",
    responsibilities: [
      "Execute 80–120 cold calls per day to prospective customers across SMB and mid-market segments",
      "Conduct personalized outbound email sequences and LinkedIn outreach campaigns",
      "Qualify inbound leads and route them to the appropriate Account Executive",
      "Research target accounts to build accurate prospect lists and identify key decision-makers",
      "Maintain and update CRM (HubSpot) with accurate activity logs and pipeline data",
      "Collaborate with marketing to refine messaging and improve conversion rates",
      "Hit and exceed monthly/quarterly pipeline generation targets",
    ],
    requirements: [
      "1–3 years of experience in B2B SaaS sales or business development",
      "Proven track record of exceeding outbound activity and pipeline quotas",
      "Excellent verbal and written communication skills in English",
      "Experience with cold calling, objection handling, and consultative selling",
      "Familiarity with CRM tools (HubSpot, Salesforce, or similar)",
      "Self-starter who thrives in a fast-paced, remote-first startup environment",
      "Bonus: experience selling to marketing, creative, or advertising teams",
      "Bonus: multilingual (Spanish, Portuguese, French, or Arabic)",
    ],
    benefits: [
      "Fully remote — work from anywhere",
      "Uncapped commission structure",
      "Equity options (early-stage opportunity)",
      "Flexible PTO policy",
      "Latest tools and tech stack",
      "Direct access to founders and leadership",
    ],
  },
];

const Careers = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <nav className="border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/">
            <Logo size="lg" />
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-6 border-border text-muted-foreground">
              We're Hiring
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Build the future of{" "}
              <span className="gradient-text">creative intelligence</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              AdBrief is a fast-growing AI startup reimagining how performance marketing teams create, analyze, and scale ad creative. Join us and help shape the next generation of creative tools.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why FrameIQ */}
      <section className="py-12 px-6 border-t border-border/30">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold mb-8 text-center">Why AdBrief?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Users,
                title: "Remote-first culture",
                desc: "Work from anywhere in the world. We believe great talent isn't bound by geography.",
              },
              {
                icon: Briefcase,
                title: "Early-stage impact",
                desc: "Join a small, high-impact team where your work directly shapes the product and company.",
              },
              {
                icon: DollarSign,
                title: "Equity & growth",
                desc: "Competitive compensation with equity options. Grow with us from day one.",
              },
            ].map((item, i) => (
              <Card key={i} className="border-border bg-card">
                <CardContent className="pt-6">
                  <item.icon className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-16 px-6">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold mb-2">Open Positions</h2>
          <p className="text-muted-foreground mb-8">
            {openPositions.length} open role{openPositions.length !== 1 ? "s" : ""}
          </p>

          {openPositions.map((job) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="border-border bg-card mb-6">
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">{job.title}</CardTitle>
                      <div className="flex flex-wrap gap-3 mt-2">
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Briefcase className="h-3.5 w-3.5" />
                          {job.department}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {job.location}
                        </span>
                        <span className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {job.type}
                        </span>
                      </div>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20 shrink-0">
                      {job.compensation}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground leading-relaxed">{job.description}</p>

                  <div>
                    <h4 className="font-semibold text-foreground mb-3">What you'll do</h4>
                    <ul className="space-y-2">
                      {job.responsibilities.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <ArrowRight className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground mb-3">What we're looking for</h4>
                    <ul className="space-y-2">
                      {job.requirements.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <ArrowRight className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-semibold text-foreground mb-3">What we offer</h4>
                    <div className="flex flex-wrap gap-2">
                      {job.benefits.map((item, i) => (
                        <Badge key={i} variant="outline" className="text-xs border-border text-muted-foreground">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border">
                    <Button
                      className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-0"
                      onClick={() => window.location.href = "mailto:careers@adbrief.pro?subject=Application: " + job.title}
                    >
                      Apply Now
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Send your resume and a brief intro to careers@adbrief.pro
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="container mx-auto max-w-4xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            © 2026 AdBrief. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Careers;
