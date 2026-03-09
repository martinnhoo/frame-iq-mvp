import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

const Contact = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="text-2xl font-bold flex items-center">
            <span className="text-foreground font-medium">Frame</span>
            <span className="gradient-text font-black">IQ</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link to="/#features" className="text-sm text-secondary hover:text-foreground transition-colors">Features</Link>
            <Link to="/#pricing" className="text-sm text-secondary hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/blog" className="text-sm text-secondary hover:text-foreground transition-colors">Blog</Link>
            <Link to="/contact" className="text-sm text-foreground transition-colors">Contact</Link>
          </div>
          
          <div className="hidden md:flex items-center gap-3">
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

          <Sheet>
            <SheetTrigger asChild className="md:hidden">
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
            
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <a 
                href="mailto:support@frameiq.com"
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
                  <div className="font-semibold">support@frameiq.com</div>
                </div>
              </a>
              
              <a 
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-3 p-6 rounded-2xl transition-all duration-300 hover:border-purple-500/30"
                style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.05), rgba(236, 72, 153, 0.02))', border: '1px solid rgba(139, 92, 246, 0.15)' }}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
                >
                  <span className="text-xl">💬</span>
                </div>
                <div className="text-left">
                  <div className="text-sm text-secondary">WhatsApp</div>
                  <div className="font-semibold">+55 11 99999-9999</div>
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
              >
                Book a demo call
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
