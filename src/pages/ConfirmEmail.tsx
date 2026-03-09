import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Mail, ArrowLeft, RefreshCw, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const RESEND_COOLDOWN = 60;

const ConfirmEmail = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          setConfirmed(true);
          setTimeout(() => navigate("/dashboard"), 2000);
        }
      }
    );

    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (emailParam) setEmail(emailParam);

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Confirmation email resent!");
      setResendCooldown(RESEND_COOLDOWN);
    }
    setResending(false);
  };

  if (confirmed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Email confirmed!</h2>
            <p className="text-muted-foreground text-sm">
              Your account is verified. Redirecting to dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-block text-3xl font-bold">
            <span className="text-foreground font-medium">Frame</span>
            <span className="gradient-text font-black">IQ</span>
          </Link>
        </div>

        <Card className="w-full border-border bg-card">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-5">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Check your inbox</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                We sent a verification link to{" "}
                {email ? (
                  <span className="font-semibold text-foreground">{email}</span>
                ) : (
                  "your email"
                )}
                .<br />
                Click the link to activate your account.
              </p>
            </div>

            <div className="w-full space-y-4">
              <div className="rounded-lg bg-muted/50 p-4 text-left space-y-2">
                <p className="text-sm text-muted-foreground">
                  Didn't receive it? Check your spam folder or{" "}
                  {email ? (
                    <button
                      onClick={handleResend}
                      disabled={resending || resendCooldown > 0}
                      className="text-primary hover:underline font-medium disabled:opacity-50 disabled:no-underline"
                    >
                      {resending
                        ? "Sending..."
                        : resendCooldown > 0
                        ? `resend email (${resendCooldown}s)`
                        : "resend email"}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">try signing up again</span>
                  )}
                </p>
              </div>

              {email && (
                <Button
                  variant="outline"
                  className="w-full border-border"
                  onClick={handleResend}
                  disabled={resending || resendCooldown > 0}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${resending ? "animate-spin" : ""}`} />
                  {resendCooldown > 0
                    ? `Resend available in ${resendCooldown}s`
                    : "Resend confirmation email"}
                </Button>
              )}
            </div>

            <Link to="/login">
              <Button variant="ghost" className="text-muted-foreground">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConfirmEmail;
