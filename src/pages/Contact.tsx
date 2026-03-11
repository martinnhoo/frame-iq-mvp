import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Menu, ArrowRight, Send, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";

const Contact = () => {
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error("Please fill in all fields");
      return;
    }
    setSending(true);
    // Simulate sending
    await new Promise(r => setTimeout(r, 1200));
    toast.success("Message sent! We'll get back to you within 24h.");
    setForm({ name: "", email: "", message: "" });
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/">
            <Logo size="lg" />
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link to="/#features" className="text-sm text-secondary hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="text-sm text-secondary hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/blog" className="text-sm text-secondary hover:text-foreground transition-colors">Blog</Link>
            <Link to="/faq" className="text-sm text-secondary hover:text-foreground transition-colors">FAQ</Link>
            <Link to="/contact" className="text-sm text-foreground transition-colors">Contact</Link>
          </div>
          
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="ghost" className="text-secondary hover:text-foreground" onClick={() => navigate("/login")}>
              Sign in
            </Button>
            <Button 
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0"
              onClick={() => navigate("/signup")}
            >
              Get started free
            </Button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <LanguageSwitcher />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Menu className="h-6 w-6" /></Button>
              </SheetTrigger>
              <SheetContent>
                <div className="flex flex-col gap-6 mt-8">
                  <Link to="/" className="text-lg text-secondary hover:text-foreground">Home</Link>
                  <Link to="/blog" className="text-lg text-secondary hover:text-foreground">Blog</Link>
                  <Link to="/contact" className="text-lg text-foreground">Contact</Link>
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 text-white" onClick={() => navigate("/signup")}>
                    Get started
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Content */}
      <section className="pt-32 pb-24 px-6">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-sm font-semibold tracking-wider uppercase gradient-text">Contact</span>
            <h1 className="text-4xl md:text-5xl font-bold mt-4 mb-6">
              Get in touch
            </h1>
            <p className="text-secondary text-lg mb-12 max-w-xl mx-auto">
              Questions, partnerships, or support — we're here to help your team ship better creative.
            </p>
            
            {/* Contact Form */}
            <form onSubmit={handleSubmit} className="max-w-lg mx-auto text-left space-y-5 mb-16">
              <div
                className="p-6 sm:p-8 rounded-2xl space-y-5"
                style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(236, 72, 153, 0.02))', border: '1px solid rgba(139, 92, 246, 0.15)' }}
              >
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Name</label>
                  <Input
                    placeholder="Your name"
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="bg-background/50 border-border/50 h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    className="bg-background/50 border-border/50 h-11"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Message</label>
                  <Textarea
                    placeholder="How can we help?"
                    value={form.message}
                    onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
                    className="bg-background/50 border-border/50 min-h-[120px] resize-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0 h-11"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send message
                </Button>
              </div>
            </form>

            {/* Email card */}
            <div className="max-w-lg mx-auto">
              <a 
                href="mailto:support@adbrief.pro"
                className="flex items-center justify-center gap-3 p-6 rounded-2xl transition-all duration-300 hover:border-purple-500/30"
                style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(236, 72, 153, 0.02))', border: '1px solid rgba(139, 92, 246, 0.15)' }}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}
                >
                  <span className="text-xl">✉️</span>
                </div>
                <div className="text-left">
                  <div className="text-sm text-secondary">Email</div>
                  <div className="font-semibold">support@adbrief.pro</div>
                </div>
              </a>
            </div>

            <div className="mt-16 p-8 rounded-2xl text-left max-w-2xl mx-auto"
              style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(236, 72, 153, 0.04))', border: '1px solid rgba(139, 92, 246, 0.15)' }}
            >
              <h2 className="text-xl font-semibold mb-3">Enterprise & Custom Plans</h2>
              <p className="text-secondary text-sm leading-relaxed mb-6">
                Need API access, custom integrations, or a dedicated CSM? Book a call with our team to discuss how FrameIQ can fit your workflow.
              </p>
              <Button 
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0"
                onClick={() => navigate("/book-demo")}
              >
                Book a demo call
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
