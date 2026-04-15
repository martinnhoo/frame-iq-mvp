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
import { Loader2, LogOut, Shield, Brain, XCircle } from "lucide-react";
import { CancelModal } from "@/components/dashboard/CancelModal";
import { useLanguage } from "@/i18n/LanguageContext";
import { trackEvent, resetUser } from "@/lib/posthog";

const SettingsPage = () => {
  const { user, profile } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const [name, setName] = useState(profile?.name || "");
  const [saving, setSaving] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
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
      console.log("[billing-portal] response:", { data, error });
      if (error) throw new Error(typeof error === "string" ? error : error?.message || JSON.stringify(error));
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.open(data.url, "_blank");
      } else {
        toast.error("Não foi possível abrir o portal de cobrança. Tente novamente.");
      }
    } catch (e: any) {
      console.error("Billing portal error:", e);
      const msg = e?.message || "";
      toast.error(msg.includes("No Stripe customer") || msg.includes("customer")
        ? "Nenhum cliente Stripe encontrado. Faça upgrade primeiro."
        : `Erro ao abrir portal: ${msg.slice(0, 100)}`);
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
      toast.success(t("save") + " ");
    } catch {
      toast.error("Falha ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    resetUser();
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
              <p className="font-medium text-foreground capitalize">{profile?.plan}</p>
              <p className="text-sm text-muted-foreground">
                {profile?.plan === "free"
                  ? "5 mensagens/dia · Todas as ferramentas com limites · Faça upgrade para uso ilimitado."
                  : profile?.plan === "maker"
                  ? "50 mensagens IA/dia · 1 conta de anúncios · Todas as ferramentas."
                  : profile?.plan === "pro"
                  ? "200 mensagens IA/dia · 3 contas de anúncios · Todas as ferramentas."
                  : "Mensagens ilimitadas · Contas ilimitadas · Tudo liberado."}
              </p>
            </div>
            <Badge variant="outline" className="capitalize border-border text-muted-foreground">
              {profile?.plan}
            </Badge>
          </div>
          {profile?.plan === "free" ? (
            <Button variant="outline" className="border-border" onClick={() => { trackEvent("plan_upgrade_clicked"); navigate("/pricing"); }}>
              {t("upgrade")}
            </Button>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" className="border-border" onClick={handleBillingPortal} disabled={portalLoading}>
                {portalLoading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Abrindo portal...</> : t("billing")}
              </Button>
              <Button variant="outline" className="border-border text-red-400 hover:text-red-300 hover:border-red-400/30" onClick={() => setCancelOpen(true)}>
                <XCircle className="h-3.5 w-3.5 mr-2" />
                {lang === "pt" ? "Cancelar plano" : lang === "es" ? "Cancelar plan" : "Cancel plan"}
              </Button>
            </div>
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
            {([["pt","Português"],["en","English"],["es","Español"]] as const).map(([code, label]) => (
              <button key={code} onClick={() => setLanguage(code)}
                style={{
                  padding: "7px 16px", borderRadius: 8, cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, fontWeight: language === code ? 600 : 400,
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
                  <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 13, fontWeight: 600, color: aiTone === val ? "#0ea5e9" : "rgba(255,255,255,0.7)", margin: "0 0 3px" }}>{label}</p>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.3)", margin: 0, lineHeight: 1.4 }}>{sub}</p>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">{lang === "pt" ? "Integrações de API" : lang === "es" ? "Integraciones de API" : "API Integrations"}</CardTitle>
          <CardDescription>{lang === "pt" ? "Serviços que alimentam o AdBrief." : lang === "es" ? "Servicios que alimentan AdBrief." : "Services powering AdBrief."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { name: "Anthropic Claude", desc: lang === "pt" ? "Análise, boards, tradução, persona" : "Analysis, boards, translation, persona", icon: (
              <svg height="20" width="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fillRule="nonzero"></path></svg>
            ) },
            { name: "OpenAI", desc: lang === "pt" ? "Transcrição de vídeo (Whisper)" : "Video transcription (Whisper)", icon: (
              <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" fill="currentColor"/></svg>
            ) },
            { name: "Meta Ads", desc: lang === "pt" ? "Conexão de contas, dados de campanhas" : "Account connection, campaign data", icon: (
              <svg height="20" width="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#meta-0)"></path><path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#meta-1)"></path><path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#meta-2)"></path><path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#meta-3)"></path><path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#meta-4)"></path><path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#meta-5)"></path><path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB"></path><path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#meta-6)"></path><path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB"></path><path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#meta-7)"></path><path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#meta-8)"></path><path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#meta-9)"></path><path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#meta-10)"></path><path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#meta-11)"></path><path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#meta-12)"></path><defs><linearGradient id="meta-0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stopColor="#0867DF"></stop><stop offset="45.39%" stopColor="#0668E1"></stop><stop offset="85.91%" stopColor="#0064E0"></stop></linearGradient><linearGradient id="meta-1" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stopColor="#0064DF"></stop><stop offset="99.88%" stopColor="#0064E0"></stop></linearGradient><linearGradient id="meta-2" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stopColor="#0072EC"></stop><stop offset="68.81%" stopColor="#0064DF"></stop></linearGradient><linearGradient id="meta-3" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stopColor="#007CF6"></stop><stop offset="99.43%" stopColor="#0072EC"></stop></linearGradient><linearGradient id="meta-4" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stopColor="#007FF9"></stop><stop offset="100%" stopColor="#007CF6"></stop></linearGradient><linearGradient id="meta-5" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stopColor="#007FF9"></stop><stop offset="100%" stopColor="#0082FB"></stop></linearGradient><linearGradient id="meta-6" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stopColor="#007FF8"></stop><stop offset="91.41%" stopColor="#0082FB"></stop></linearGradient><linearGradient id="meta-7" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stopColor="#0082FB"></stop><stop offset="99.95%" stopColor="#0081FA"></stop></linearGradient><linearGradient id="meta-8" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stopColor="#0081FA"></stop><stop offset="100%" stopColor="#0080F9"></stop></linearGradient><linearGradient id="meta-9" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stopColor="#027AF3"></stop><stop offset="100%" stopColor="#0080F9"></stop></linearGradient><linearGradient id="meta-10" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stopColor="#0377EF"></stop><stop offset="99.94%" stopColor="#0279F1"></stop></linearGradient><linearGradient id="meta-11" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stopColor="#0471E9"></stop><stop offset="100%" stopColor="#0377EF"></stop></linearGradient><linearGradient id="meta-12" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stopColor="#0867DF"></stop><stop offset="100%" stopColor="#0471E9"></stop></linearGradient></defs></svg>
            ) },
          ].map(({ name, desc, icon }) => (
            <div key={name} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 flex items-center justify-center shrink-0">{icon}</div>
                <div>
                  <p className="font-medium text-sm text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
              <Badge variant="outline" className="border-green-500/30 text-green-400 text-xs bg-green-500/10">
                {lang === "pt" ? "Configurado" : lang === "es" ? "Configurado" : "Configured"}
              </Badge>
            </div>
          ))}
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {lang === "pt" ? "As chaves de API são configuradas via Supabase Secrets e nunca expostas ao cliente." : lang === "es" ? "Las claves API se configuran en Supabase Secrets y nunca se exponen al cliente." : "API keys are configured via Supabase Secrets and never exposed to the client."}
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

      <CancelModal open={cancelOpen} onClose={() => setCancelOpen(false)} plan={profile?.plan || "free"} />
    </div>
  );
};

export default SettingsPage;
