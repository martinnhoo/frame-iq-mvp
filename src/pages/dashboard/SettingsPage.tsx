import { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import type { DashboardContext } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, LogOut, Shield } from "lucide-react";

const SettingsPage = () => {
  const { user, profile } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.name || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name.trim() })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update profile");
    } else {
      toast.success("Profile updated");
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate("/login");
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and preferences.</p>
      </div>

      {/* Profile */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-muted text-muted-foreground text-lg">
                {profile?.name?.charAt(0) || user.email?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{profile?.name || "User"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={user.email || ""}
                disabled
                className="bg-muted border-border opacity-60"
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">Subscription</CardTitle>
          <CardDescription>Your current plan and billing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground capitalize">{profile?.plan} Plan</p>
              <p className="text-sm text-muted-foreground">
                {profile?.plan === "free"
                  ? "Limited to 5 analyses, 3 boards, 2 videos per month"
                  : "Full access to all features"}
              </p>
            </div>
            <Badge variant="outline" className="capitalize border-border text-muted-foreground">
              {profile?.plan}
            </Badge>
          </div>
          {profile?.plan === "free" && (
            <Button variant="outline" className="border-border">
              Upgrade to Pro
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="border-border" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
