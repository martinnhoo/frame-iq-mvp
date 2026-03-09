import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Mail, ArrowLeft, RefreshCw, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const ConfirmEmail = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    // Check if user lands here after confirming email
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          setConfirmed(true);
          setTimeout(() => navigate("/dashboard"), 2000);
        }
      }
    );

    // Get email from URL params or session
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get("email");
    if (emailParam) setEmail(emailParam);

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleResend = async () => {
    if (!email) {
      toast.error("Email address not available");
      return;
    }
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Confirmation email resent!");
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
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-5">
          <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center">
            <Mail className="h-8 w-8 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">Verify your email</h2>
            <p className="text-muted-foreground text-sm">
              We sent a confirmation link to{" "}
              {email ? (
                <span className="font-medium text-foreground">{email}</span>
              ) : (
                "your email"
              )}
              . Click the link to activate your account.
            </p>
          </div>

          <div className="w-full space-y-3">
            <div className="rounded-lg bg-muted/50 p-4 text-left space-y-2">
              <p className="text-sm font-medium text-foreground">Didn't get the email?</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Check your spam or junk folder</li>
                <li>• Make sure the email address is correct</li>
                <li>• Wait a few minutes and try again</li>
              </ul>
            </div>

            {email && (
              <Button
                variant="outline"
                className="w-full border-border"
                onClick={handleResend}
                disabled={resending}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${resending ? "animate-spin" : ""}`} />
                Resend confirmation email
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
  );
};

export default ConfirmEmail;
