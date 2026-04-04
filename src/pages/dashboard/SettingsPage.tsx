import { useState } from "react";
import { storage } from "@/lib/storage";
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
import { Loader2, LogOut, Shield, Brain } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const SettingsPage = () => {
  const { user, profile } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const [name, setName] = useState(profile?.name || "");
  const [saving, setSaving] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [aiTone, setAiTone] = useState<"direto" | "didático" | "técnico">(() => {
    return storage.get("adbrief_ai_tone", "direto") as any
  });

  const lang = language as "pt" | "en" | "es";
  const T = {
    title:      { pt: "Configurações",      en: "Settings",       es: "Configuración" },
    subtitle:   { pt: "Gerencie sua conta e preferências.", en: "Manage your account and preferences.", es: "Gestiona tu cuenta y preferencias." },
    profile:    { pt: "Perfil",             en: "Profile",        es: "Perfil" },
    profileSub: { pt: "Suas informações pessoais.", en: "Your personal information.", es: "Tu información personal." },
    fullName:   { pt: "Nome completo",      en: "Full Name",      es: "Nombre completo" },
    save:       { pt: "Salvar",             en: "Save changes",   es: "Guardar" },
    plan:       { pt: "Assinatura",         en: "Subscription",   es: "Suscripción" },
    planSub:    { pt: "Seu plano atual e cobrança.", en: "Your current plan and billing.", es: "Tu plan actual y facturación." },
    billing:    { pt: "Gerenciar cobrança", en: "Manage billing", es: "Gestionar facturación" },
    upgrade:    { pt: "Fazer upgrade",      en: "Upgrade plan",   es: "Mejorar plan" },
    language:   { pt: "Idioma da interface",en: "Interface language", es: "Idioma de la interfaz" },
    languageSub:{ pt: "Idioma usado no dashboard.", en: "Language used across the dashboard.", es: "Idioma usado en el dashboard." },
    aiPrefs:    { pt: "Preferências da IA", en: "AI Preferences", es: "Preferencias de IA" },
    aiPrefsSub: { pt: "Personalize o tom e comportamento do AdBrief AI.", en: "Personalize the tone and behavior of AdBrief AI.", es: "Personaliza el tono y comportamiento del AdBrief AI." },
    aiToneLbl:  { pt: "Tom das respostas",  en: "Response tone",  es: "Tono de respuestas" },
    toneDir:    { pt: "Direto",             en: "Direct",         es: "Directo" },
    toneDid:    { pt: "Didático",           en: "Educational",    es: "Didáctico" },
    toneTec:    { pt: "Técnico",            en: "Technical",      es: "Técnico" },
    toneDirSub: { pt: "Respostas curtas e acionáveis.",  en: "Short and actionable responses.",    es: "Respuestas cortas y accionables." },
    toneDidSub: { pt: "Explica o raciocínio por trás de cada recomendação.", en: "Explains the reasoning behind each recommendation.", es: "Explica el razonamiento detrás de cada recomendación." },
    toneTecSub: { pt: "Inclui métricas e terminologia de mídia.", en: "Includes metrics and media terminology.", es: "Incluye métricas y terminología de medios." },
    security:   { pt: "Segurança",          en: "Security",       es: "Seguridad" },
    signout:    { pt: "Sair",               en: "Sign out",       es: "Cerrar sesión" },
    support:    { pt: "Suporte & Conta",    en: "Support & Account", es: "Soporte & Cuenta" },
    supportSub: { pt: "Precisa de ajuda ou quer encerrar sua conta?", en: "Need help or want to close your account?", es: "¿Necesitas ayuda o quieres cerrar tu cuenta?" },
    contact:    { pt: "Falar com suporte",  en: "Contact support", es: "Contactar soporte" },
    contactSub: { pt: "Dúvidas, bugs ou qualquer problema", en: "Questions, bugs or any issue", es: "Dudas, bugs o cualquier problema" },
    deleteAcc:  { pt: "Excluir conta",      en: "Delete account", es: "Eliminar cuenta" },
    deleteSub:  { pt: "Todos os seus dados serão permanentemente removidos. Para excluir, envie e-mail para", en: "All your data will be permanently removed. To delete, email", es: "Todos tus datos serán eliminados permanentemente. Para eliminar, envía un email a" },
    deleteWith: { pt: "com o assunto \u201cExcluir minha conta\u201d.", en: "with subject \u201cDelete my account\u201d.", es: "con asunto \u201cEliminar mi cuenta\u201d." },
  };
  const t = (k: keyof typeof T) => T[k][lang] || T[k]["en"];

  const handleBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else toast.error("Não foi possível abrir o portal de cobrança");
    } catch {
      toast.error("Não foi possível abrir o portal de cobrança");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ name: name.trim(), preferred_language: language })
        .eq("id", user.id);
      if (error) throw error;
      // Save AI tone preference to localStorage
      storage.set("adbrief_ai_tone", aiTone)
      toast.success(t("save") + " ✓");
    } catch {
      toast.error("Falha ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out");
    navigate("/login");
  };


  if (!user) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.1)", borderTopColor: "#0ea5e9", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("subtitle")}</p>
      </div>

      {/* Profile */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">{t("profile")}</CardTitle>
          <CardDescription>{t("profileSub")}</CardDescription>
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
              <Label htmlFor="name">{t("fullName")}</Label>
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

          <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-sky-500 to-cyan-500 text-white border-0">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("save")}
          </Button>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">{t("plan")}</CardTitle>
          <CardDescription>{t("planSub")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-foreground capitalize">{profile?.plan} Plan</p>
              <p className="text-sm text-muted-foreground">
                {profile?.plan === "free"
                  ? "Acesso limitado. Faça upgrade para liberar todas as ferramentas."
                  : profile?.plan === "maker"
                  ? "50 AI messages/day · 1 ad account · All tools."
                  : profile?.plan === "pro"
                  ? "200 AI messages/day · 3 ad accounts · All tools."
                  : "Mensagens ilimitadas · Contas ilimitadas · Tudo liberado."}
              </p>
            </div>
            <Badge variant="outline" className="capitalize border-border text-muted-foreground">
              {profile?.plan}
            </Badge>
          </div>
          {profile?.plan === "free" ? (
            <Button variant="outline" className="border-border" onClick={() => navigate("/pricing")}>
              {t("upgrade")}
            </Button>
          ) : (
            <Button variant="outline" className="border-border" onClick={handleBillingPortal} disabled={portalLoading}>
              {portalLoading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Loading...</> : t("billing")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Language */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">{t("language")}</CardTitle>
          <CardDescription>{t("languageSub")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {([["pt","Português 🇧🇷"],["en","English 🇺🇸"],["es","Español 🇲🇽"]] as const).map(([code, label]) => (
              <button key={code} onClick={() => setLanguage(code)}
                style={{
                  padding: "7px 16px", borderRadius: 8, cursor: "pointer",
                  fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: language === code ? 600 : 400,
                  background: language === code ? "rgba(14,165,233,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${language === code ? "rgba(14,165,233,0.35)" : "rgba(255,255,255,0.1)"}`,
                  color: language === code ? "#0ea5e9" : "rgba(255,255,255,0.55)",
                  transition: "all 0.15s",
                }}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {lang === "pt" ? "Salve para aplicar o idioma." : lang === "es" ? "Guarda para aplicar el idioma." : "Save to apply the language change."}
          </p>
        </CardContent>
      </Card>

      {/* AI Preferences */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" />
            {t("aiPrefs")}
          </CardTitle>
          <CardDescription>{t("aiPrefsSub")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-3 block">{t("aiToneLbl")}</Label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["direto",   t("toneDir"),  t("toneDirSub")] as const,
                ["didático", t("toneDid"),  t("toneDidSub")] as const,
                ["técnico",  t("toneTec"),  t("toneTecSub")] as const,
              ]).map(([val, label, sub]) => (
                <button key={val} onClick={() => setAiTone(val as any)}
                  style={{
                    padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                    background: aiTone === val ? "rgba(14,165,233,0.1)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${aiTone === val ? "rgba(14,165,233,0.3)" : "rgba(255,255,255,0.08)"}`,
                    transition: "all 0.15s",
                  }}>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, color: aiTone === val ? "#0ea5e9" : "rgba(255,255,255,0.7)", margin: "0 0 3px" }}>{label}</p>
                  <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0, lineHeight: 1.4 }}>{sub}</p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">API Integrations</CardTitle>
          <CardDescription>AI services powering AdBrief.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: "Anthropic Claude", desc: "Análise, boards, tradução, persona", key: "ANTHROPIC" },
            { name: "OpenAI Whisper", desc: "Transcrição de vídeo", key: "OPENAI" },
          ].map(({ name, desc }) => (
            <div key={name} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <div>
                  <p className="font-medium text-sm text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
              <Badge variant="outline" className="border-green-500/30 text-green-400 text-xs bg-green-500/10">
                Configured
              </Badge>
            </div>
          ))}
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              API keys are configured via Supabase Secrets and never exposed to the client.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t("security")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="border-border" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            {t("signout")}
          </Button>
        </CardContent>
      </Card>

      {/* Support & Account */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">{t("support")}</CardTitle>
          <CardDescription>{t("supportSub")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Support */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-foreground">{t("contact")}</p>
              <p className="text-xs text-muted-foreground">{t("contactSub")}</p>
            </div>
            <a href="mailto:hello@adbrief.pro?subject=Suporte AdBrief"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
              hello@adbrief.pro
            </a>
          </div>

          {/* Delete account */}
          <div className="pt-3 border-t border-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-destructive">{t("deleteAcc")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("deleteSub")}{" "}
                  <a href="mailto:hello@adbrief.pro?subject=Excluir minha conta AdBrief"
                    className="text-destructive underline underline-offset-2">
                    hello@adbrief.pro
                  </a>
                  {" "}{t("deleteWith")}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
