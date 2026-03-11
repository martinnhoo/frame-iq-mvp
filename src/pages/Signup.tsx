import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff, Mail, User } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";
import { motion } from "framer-motion";
import { Logo } from "@/components/Logo";

const Signup = () => {
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleGoogleSignup = async () => {
    setLoading(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password || !name.trim()) return;

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setEmailLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: window.location.origin + "/dashboard",
      },
    });

    if (error) {
      if (error.message.includes("already registered")) {
        toast.error("This email is already registered. Try signing in instead.");
      } else {
        toast.error(error.message);
      }
    } else {
      navigate(`/confirm-email?email=${encodeURIComponent(email.trim())}`);
    }
    setEmailLoading(false);
  };

  const passwordStrength = () => {
    if (!password) return { score: 0, label: "", color: "" };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    const levels = [
      { label: "Weak", color: "bg-destructive" },
      { label: "Fair", color: "bg-yellow-500" },
      { label: "Good", color: "bg-blue-500" },
      { label: "Strong", color: "bg-green-500" },
    ];
    return { score, ...levels[Math.min(score, levels.length) - 1] };
  };

  const strength = passwordStrength();
  const isFormDisabled = loading || emailLoading;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated orbs */}
      <motion.div className="absolute w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, hsla(262, 83%, 58%, 0.12) 0%, transparent 60%)', filter: 'blur(80px)' }} animate={{ x: ['20%', '-30%', '10%'], y: ['-20%', '20%', '-10%'] }} transition={{ duration: 16, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} />
      <motion.div className="absolute w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, hsla(320, 80%, 60%, 0.1) 0%, transparent 60%)', filter: 'blur(80px)' }} animate={{ x: ['-20%', '30%', '-10%'], y: ['30%', '-20%', '10%'] }} transition={{ duration: 20, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} />
      <motion.div className="absolute w-[350px] h-[350px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, hsla(180, 70%, 50%, 0.05) 0%, transparent 60%)', filter: 'blur(60px)' }} animate={{ x: ['-10%', '25%', '-20%'], y: ['15%', '-25%', '20%'] }} transition={{ duration: 14, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} />

      {/* Animated grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(139, 92, 246, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 246, 0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div key={i} className="absolute w-1 h-1 rounded-full pointer-events-none" style={{ background: i % 2 === 0 ? 'rgba(139, 92, 246, 0.4)' : 'rgba(236, 72, 153, 0.4)', left: `${20 + i * 12}%`, top: `${15 + (i % 3) * 30}%` }} animate={{ y: [0, -25, 0], opacity: [0.2, 0.7, 0.2], scale: [1, 1.8, 1] }} transition={{ duration: 3.5 + i * 0.4, repeat: Infinity, delay: i * 0.3, ease: 'easeInOut' }} />
      ))}

      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>
      
      <div className="w-full max-w-md space-y-6 relative z-10">
        <motion.div className="text-center" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Link to="/" className="inline-block">
            <Logo size="lg" />
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, delay: 0.15 }}>
          <Card className="w-full border-border/50 bg-card/80 backdrop-blur-md shadow-2xl shadow-purple-500/10" style={{ border: '1px solid rgba(139, 92, 246, 0.15)' }}>
            <CardHeader className="text-center space-y-2">
              <CardTitle className="text-2xl font-bold tracking-tight">{t("auth_signup_title")}</CardTitle>
              <CardDescription className="text-muted-foreground">{t("auth_signup_subtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Google button */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button variant="outline" className="w-full h-12 text-base font-medium border-border/50 hover:bg-muted hover:border-purple-500/30 transition-all" onClick={handleGoogleSignup} disabled={isFormDisabled}>
                  {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (
                    <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  )}
                  {t("auth_google")}
                </Button>
              </motion.div>

              {/* Divider */}
              <div className="relative flex items-center">
                <div className="flex-grow border-t border-border/50" />
                <span className="mx-4 text-xs text-muted-foreground uppercase tracking-wider">{t("auth_or_email")}</span>
                <div className="flex-grow border-t border-border/50" />
              </div>

              {/* Email form */}
              <form onSubmit={handleEmailSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground text-sm">Full name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="name" type="text" placeholder="John Doe" value={name} onChange={(e) => setName(e.target.value)} required className="h-12 bg-muted/50 border-border/50 pl-10" disabled={isFormDisabled} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground text-sm">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 bg-muted/50 border-border/50 pl-10" disabled={isFormDisabled} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground text-sm">Password</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="h-12 bg-muted/50 border-border/50 pr-12" disabled={isFormDisabled} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {password && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((level) => (
                          <div key={level} className={`h-1 flex-1 rounded-full transition-colors ${level <= strength.score ? strength.color : "bg-muted"}`} />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Password strength: <span className="font-medium text-foreground">{strength.label}</span>
                      </p>
                    </div>
                  )}
                </div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isFormDisabled || password.length < 8}>
                    {emailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create account
                  </Button>
                </motion.div>
              </form>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-center text-xs text-muted-foreground leading-relaxed">
                By signing up, you agree to our{" "}
                <Link to="/" className="text-primary hover:underline">Terms of Service</Link>
                {" "}and{" "}
                <Link to="/" className="text-primary hover:underline">Privacy Policy</Link>.
              </motion.div>

              <p className="text-center text-sm text-muted-foreground">
                {t("auth_has_account")}{" "}
                <Link to="/login" className="text-primary hover:underline font-medium">{t("auth_signin")}</Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;
