import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowLeft, Home, Search } from "lucide-react";
import { Logo } from "@/components/Logo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="text-2xl font-bold flex items-center">
            <span className="text-foreground font-medium">Frame</span>
            <span className="gradient-text font-black">IQ</span>
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="relative">
          {/* Background glow */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, hsla(262, 83%, 58%, 0.1) 0%, transparent 60%)',
              filter: 'blur(60px)',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative text-center max-w-lg mx-auto"
          >
            <div className="text-[120px] md:text-[160px] font-black leading-none gradient-text mb-4">
              404
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-3">
              Page not found
            </h1>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              The page <code className="text-sm bg-muted px-2 py-1 rounded font-mono">{location.pathname}</code> doesn't exist. It may have been moved or deleted.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 border-0"
                asChild
              >
                <Link to="/">
                  <Home className="h-4 w-4 mr-2" />
                  Back to home
                </Link>
              </Button>
              <Button variant="outline" className="border-border" asChild>
                <Link to="/contact">
                  <Search className="h-4 w-4 mr-2" />
                  Contact support
                </Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
