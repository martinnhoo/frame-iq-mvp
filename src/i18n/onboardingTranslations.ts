// Onboarding-specific translations
// Covers all text in Onboarding.tsx for 7 supported languages

export type ObLang = "en" | "pt" | "es" | "fr" | "de" | "zh" | "ar" | "hi";

const t = (en: string, pt: string, es: string, fr: string, de: string, zh: string, ar: string) =>
  ({ en, pt, es, fr, de, zh, ar });

const OB = {
  skip_setup:       t("skip setup", "pular configuração", "saltar config.", "passer la config.", "Setup überspringen", "跳过设置", "تخطي الإعداد"),
  step_of:          t("Step", "Etapa", "Paso", "Étape", "Schritt", "步骤", "خطوة"),
  of:               t("of", "de", "de", "sur", "von", "/", "من"),

  // Step 1 – Name
  setup_title:      t("Let's get you set up", "Vamos configurar tudo", "Vamos a configurar todo", "Configurons votre espace", "Lass uns loslegen", "开始设置", "لنبدأ الإعداد"),
  setup_sub:        t("Takes less than 2 minutes. You can skip any step.", "Leva menos de 2 minutos. Pode pular qualquer etapa.", "Menos de 2 minutos. Puedes saltar cualquier paso.", "Moins de 2 minutes. Vous pouvez sauter les étapes.", "Dauert weniger als 2 Minuten.", "不到2分钟，可跳过任何步骤。", "أقل من دقيقتين. يمكنك تخطي أي خطوة."),
  name_label:       t("Your name", "Seu nome", "Tu nombre", "Votre nom", "Ihr Name", "您的姓名", "اسمك"),
  name_opt:         t("optional", "opcional", "opcional", "optionnel", "optional", "可选", "اختياري"),
  name_ph:          t("e.g. Alex", "ex: Alex", "ej: Alex", "ex: Alex", "z.B. Alex", "例：Alex", "مثال: أليكس"),
  terms_agree:      t("I agree to the", "Eu concordo com os", "Acepto los", "J'accepte les", "Ich stimme den", "我同意", "أوافق على"),
  terms:            t("Terms", "Termos", "Términos", "Conditions", "AGB", "条款", "الشروط"),
  and:              t("and", "e", "y", "et", "und", "和", "و"),
  privacy:          t("Privacy Policy", "Política de Privacidade", "Política de Privacidad", "Politique de confidentialité", "Datenschutzrichtlinie", "隐私政策", "سياسة الخصوصية"),
  marketing:        t("Send me product updates, tips, and creative strategy content", "Envie-me atualizações, dicas e conteúdo de estratégia criativa", "Envíame actualizaciones, tips y contenido de estrategia creativa", "Envoyez-moi des mises à jour, astuces et contenus créatifs", "Schicken Sie mir Updates, Tipps und kreative Inhalte", "发送产品更新、技巧和创意策略内容", "أرسل لي تحديثات المنتج والنصائح والمحتوى الإبداعي"),
  continue:         t("Continue", "Continuar", "Continuar", "Continuer", "Weiter", "继续", "متابعة"),

  // Step 2 – Language
  lang_title:       t("Preferred language?", "Idioma preferido?", "¿Idioma preferido?", "Langue préférée ?", "Bevorzugte Sprache?", "首选语言？", "اللغة المفضلة؟"),
  lang_sub:         t("For AI outputs — scripts, voiceovers, analysis reports", "Para outputs de IA — scripts, locuções, relatórios", "Para outputs de IA — guiones, locuciones, informes", "Pour les sorties IA — scripts, voix off, rapports", "Für KI-Ausgaben — Skripte, Voiceover, Berichte", "AI输出语言 — 脚本、配音、分析报告", "لمخرجات الذكاء الاصطناعي — النصوص، التعليقات، التقارير"),
  back:             t("← Back", "← Voltar", "← Volver", "← Retour", "← Zurück", "← 返回", "→ رجوع"),
  skip:             t("Skip", "Pular", "Saltar", "Passer", "Überspringen", "跳过", "تخطي"),

  // Step 3 – Source
  source_title:     t("How did you find us?", "Como você nos encontrou?", "¿Cómo nos encontraste?", "Comment nous avez-vous trouvé ?", "Wie haben Sie uns gefunden?", "你是怎么发现我们的？", "كيف وجدتنا؟"),
  source_sub:       t("Helps us focus our energy in the right places", "Nos ajuda a focar nossa energia nos lugares certos", "Nos ayuda a enfocar nuestra energía", "Nous aide à concentrer nos efforts", "Hilft uns, unsere Energie richtig einzusetzen", "帮助我们把精力放在对的地方", "يساعدنا على توجيه جهودنا"),
  source_other_ph:  t("Tell us more...", "Conte-nos mais...", "Cuéntanos más...", "Dites-nous en plus...", "Erzählen Sie mehr...", "告诉我们更多...", "أخبرنا المزيد..."),
  src_friend:       t("Friend / Colleague", "Amigo / Colega", "Amigo / Colega", "Ami / Collègue", "Freund / Kollege", "朋友 / 同事", "صديق / زميل"),
  src_other:        t("Other", "Outro", "Otro", "Autre", "Sonstiges", "其他", "آخر"),

  // Step 4 – Feature
  feat_title:       t("Where do you want to start?", "Por onde quer começar?", "¿Por dónde quieres empezar?", "Par où voulez-vous commencer ?", "Wo möchten Sie starten?", "你想从哪里开始？", "من أين تريد أن تبدأ؟"),
  feat_sub:         t("We'll take you straight there after setup", "Levamos você direto depois da configuração", "Te llevaremos directamente después", "Nous vous y emmènerons directement", "Wir bringen Sie direkt dorthin", "设置后直接带你前往", "سنأخذك إلى هناك مباشرة"),
  feat_analyze:     t("Analyze competitor ads", "Analisar anúncios concorrentes", "Analizar anuncios de competidores", "Analyser les pubs concurrentes", "Wettbewerber-Anzeigen analysieren", "分析竞品广告", "تحليل إعلانات المنافسين"),
  feat_analyze_d:   t("Upload a video and get AI hook scores, transcripts, and creative insights", "Faça upload de um vídeo e obtenha scores de hook, transcrições e insights criativos", "Sube un video y obtén scores de hook, transcripciones e insights creativos", "Importez une vidéo et obtenez des scores de hook, transcriptions et insights", "Laden Sie ein Video hoch für KI-Hook-Scores und kreative Insights", "上传视频获取AI钩子评分、转录和创意洞察", "ارفع فيديو واحصل على تحليل الخطافات والرؤى الإبداعية"),
  feat_board:       t("Generate a production board", "Gerar um board de produção", "Generar un board de producción", "Générer un board de production", "Ein Produktions-Board generieren", "生成制作板", "إنشاء لوحة إنتاج"),
  feat_board_d:     t("Turn a brief into a full scene-by-scene board with VO scripts and editor notes", "Transforme um brief em um board completo com scripts de VO e notas para editor", "Convierte un brief en un board escena por escena con scripts VO", "Transformez un brief en board complet avec scripts VO", "Brief in ein vollständiges Board mit VO-Skripten umwandeln", "将简报转化为逐场景板", "حوّل الموجز إلى لوحة مشاهد كاملة"),
  feat_templates:   t("Browse ad templates", "Explorar templates de anúncios", "Explorar plantillas de anuncios", "Parcourir les modèles de pub", "Anzeigenvorlagen durchsuchen", "浏览广告模板", "تصفح قوالب الإعلانات"),
  feat_templates_d: t("Start from proven formats — UGC, testimonial, promo, tutorial, and more", "Comece com formatos comprovados — UGC, depoimento, promo, tutorial e mais", "Comienza con formatos probados — UGC, testimonial, promo y más", "Commencez par des formats éprouvés — UGC, témoignage, promo et plus", "Starten Sie mit bewährten Formaten — UGC, Testimonial, Promo und mehr", "从经验证的格式开始 — UGC、推荐、促销等", "ابدأ بتنسيقات مجربة — UGC، شهادات، عروض والمزيد"),
  feat_translate:   t("Translate & localize scripts", "Traduzir & localizar scripts", "Traducir y localizar guiones", "Traduire et localiser les scripts", "Skripte übersetzen & lokalisieren", "翻译和本地化脚本", "ترجمة وتكييف النصوص"),
  feat_translate_d: t("Adapt your ad scripts for any market with AI-powered cultural localization", "Adapte seus scripts de anúncios para qualquer mercado com localização cultural por IA", "Adapta tus guiones a cualquier mercado con localización cultural IA", "Adaptez vos scripts pour tout marché avec localisation culturelle IA", "Passen Sie Skripte für jeden Markt an — mit KI-Lokalisierung", "用AI文化本地化适配任何市场的广告脚本", "كيّف نصوص إعلاناتك لأي سوق بالتكييف الثقافي بالذكاء الاصطناعي"),
  feat_preflight:   t("Pre-flight check my creative", "Checar meu criativo antes de publicar", "Revisar mi creativo antes de publicar", "Vérifier mon créatif avant publication", "Kreativ-Vorcheck durchführen", "预检我的创意", "فحص مسبق لإبداعي"),
  feat_preflight_d: t("Review your ad against platform policies before spending a single dollar", "Revise seu anúncio contra políticas da plataforma antes de gastar", "Revisa tu anuncio contra las políticas antes de gastar", "Vérifiez votre pub contre les politiques avant de dépenser", "Prüfen Sie Ihre Anzeige gegen Plattformrichtlinien", "在花钱之前根据平台政策审查你的广告", "راجع إعلانك مقابل سياسات المنصة قبل إنفاق أي مبلغ"),
  feat_intelligence: t("Explore creative intelligence", "Explorar inteligência criativa", "Explorar inteligencia creativa", "Explorer l'intelligence créative", "Kreative Intelligenz erkunden", "探索创意智能", "استكشاف الذكاء الإبداعي"),
  feat_intelligence_d: t("See what patterns actually work — backed by your own performance data", "Veja quais padrões realmente funcionam — com base nos seus dados", "Descubre qué patrones funcionan — respaldado por tus datos", "Découvrez les tendances qui fonctionnent — vos propres données", "Sehen Sie, welche Muster funktionieren — auf Ihren Daten basierend", "看看哪些模式真正有效 — 基于你自己的数据", "اكتشف الأنماط التي تعمل فعلاً — مدعومة ببياناتك"),

  // Step 5 – Persona
  persona_title:    t("Meet your audience first", "Conheça sua audiência primeiro", "Conoce tu audiencia primero", "Rencontrez votre audience", "Lernen Sie Ihre Zielgruppe kennen", "先了解你的受众", "تعرف على جمهورك أولاً"),
  persona_sub:      t("The best ads are written for one specific person. AdBrief uses your audience persona to tailor every hook, board, and script — automatically.", "Os melhores anúncios são escritos para uma pessoa específica. O AdBrief usa sua persona de audiência para personalizar cada hook, board e script — automaticamente.", "Los mejores anuncios se escriben para una persona específica. AdBrief usa tu persona para adaptar cada hook, board y guión — automáticamente.", "Les meilleures pubs sont écrites pour une personne précise. AdBrief utilise votre persona pour adapter chaque hook, board et script — automatiquement.", "Die besten Anzeigen werden für eine bestimmte Person geschrieben. AdBrief nutzt Ihre Persona, um jeden Hook und jedes Board anzupassen.", "最好的广告是为特定的人写的。AdBrief使用您的受众画像自动定制每个钩子、板和脚本。", "أفضل الإعلانات تُكتب لشخص محدد. يستخدم AdBrief شخصية جمهورك لتخصيص كل خطاف ولوحة ونص — تلقائياً."),
  persona_b1_t:     t("Hooks that actually convert", "Hooks que realmente convertem", "Hooks que realmente convierten", "Des hooks qui convertissent", "Hooks die konvertieren", "真正转化的钩子", "خطافات تحقق التحويل"),
  persona_b1_d:     t("AI generates hooks based on your audience's real pains, desires, and triggers — not generic angles.", "A IA gera hooks baseados nas dores, desejos e gatilhos reais da sua audiência — não ângulos genéricos.", "La IA genera hooks basados en dolores, deseos y gatillos reales de tu audiencia.", "L'IA génère des hooks basés sur les douleurs et désirs réels de votre audience.", "KI generiert Hooks basierend auf echten Schmerzpunkten und Auslösern Ihrer Zielgruppe.", "AI根据受众真实痛点、欲望和触发因素生成钩子。", "يولد الذكاء الاصطناعي خطافات بناءً على آلام وأمنيات جمهورك الحقيقية."),
  persona_b2_t:     t("Boards written for your audience", "Boards escritos para sua audiência", "Boards escritos para tu audiencia", "Des boards écrits pour votre audience", "Boards für Ihre Zielgruppe geschrieben", "为你的受众编写的制作板", "لوحات مكتوبة لجمهورك"),
  persona_b2_d:     t("Every scene, VO line, and CTA is crafted for the specific person you're targeting.", "Cada cena, linha de VO e CTA é criada para a pessoa específica que você está segmentando.", "Cada escena, línea VO y CTA está creada para la persona específica.", "Chaque scène, ligne VO et CTA est conçu pour la personne ciblée.", "Jede Szene, VO-Zeile und CTA ist auf die Zielperson zugeschnitten.", "每个场景、旁白和CTA都是为你的目标受众量身定制的。", "كل مشهد وسطر VO و CTA مصمم للشخص المحدد الذي تستهدفه."),
  persona_b3_t:     t("Switch personas instantly", "Troque de persona instantaneamente", "Cambia de persona al instante", "Changez de persona instantanément", "Persona sofort wechseln", "即时切换画像", "تبديل الشخصيات فوراً"),
  persona_b3_d:     t("Run campaigns for multiple audiences. Switch context in one click from the top bar.", "Execute campanhas para múltiplas audiências. Troque o contexto em um clique na barra superior.", "Ejecuta campañas para múltiples audiencias. Cambia el contexto en un clic.", "Menez des campagnes pour plusieurs audiences. Changez de contexte en un clic.", "Kampagnen für verschiedene Zielgruppen. Wechseln Sie den Kontext mit einem Klick.", "为多个受众运行活动。在顶部栏一键切换上下文。", "شغّل حملات لجماهير متعددة. بدّل السياق بنقرة واحدة."),
  persona_cta:      t("Create my first persona →", "Criar minha primeira persona →", "Crear mi primera persona →", "Créer ma première persona →", "Erste Persona erstellen →", "创建我的第一个画像 →", "إنشاء أول شخصية →"),
  persona_skip:     t("Skip for now — I'll do it later", "Pular por agora — faço depois", "Saltar por ahora — lo haré después", "Passer pour l'instant — je le ferai plus tard", "Überspringen — mache ich später", "暂时跳过 — 稍后再做", "تخطي الآن — سأفعل ذلك لاحقاً"),

  // Step 6 – Plan
  plan_title:       t("Pick your plan", "Escolha seu plano", "Elige tu plan", "Choisissez votre plan", "Wählen Sie Ihren Plan", "选择你的计划", "اختر خطتك"),
  plan_sub:         t("You're on Free. Upgrade whenever you're ready.", "Você está no Free. Faça upgrade quando quiser.", "Estás en Free. Mejora cuando quieras.", "Vous êtes en Free. Mettez à niveau quand vous êtes prêt.", "Sie sind im Free-Plan. Upgraden Sie, wenn Sie bereit sind.", "你现在是免费版。随时升级。", "أنت على الخطة المجانية. قم بالترقية متى شئت."),
  plan_free:        t("Continue with Free →", "Continuar com Free →", "Continuar con Free →", "Continuer en Free →", "Mit Free fortfahren →", "继续使用免费版 →", "المتابعة بالخطة المجانية →"),
  plan_get:         t("Get", "Obter", "Obtener", "Obtenir", "Holen", "获取", "احصل على"),
  plan_setting_up:  t("Setting up...", "Configurando...", "Configurando...", "Configuration...", "Wird eingerichtet...", "设置中...", "جاري الإعداد..."),
  plan_most_popular:t("Most popular", "Mais popular", "Más popular", "Le plus populaire", "Beliebteste", "最受欢迎", "الأكثر شعبية"),

  // Templates chrome (used in TemplatesPage too)
  tp_title:         t("Ad Templates", "Templates de Anúncios", "Plantillas de Anuncios", "Modèles de Pub", "Anzeigenvorlagen", "广告模板", "قوالب الإعلانات"),
  tp_formats:       t("proven formats", "formatos comprovados", "formatos probados", "formats éprouvés", "bewährte Formate", "经验证格式", "تنسيقات مجربة"),
  tp_industries:    t("industries", "indústrias", "industrias", "secteurs", "Branchen", "行业", "صناعات"),
  tp_languages:     t("languages", "idiomas", "idiomas", "langues", "Sprachen", "种语言", "لغات"),
  tp_shown:         t("shown", "mostrados", "mostrados", "affichés", "angezeigt", "已显示", "معروض"),
  tp_search_ph:     t("Search templates, formats, industries...", "Buscar templates, formatos, indústrias...", "Buscar plantillas, formatos, industrias...", "Rechercher modèles, formats, secteurs...", "Vorlagen, Formate, Branchen suchen...", "搜索模板、格式、行业...", "بحث القوالب، التنسيقات، الصناعات..."),
  tp_all:           t("All", "Todos", "Todos", "Tous", "Alle", "全部", "الكل"),
  tp_any:           t("Any", "Todos", "Todos", "Tous", "Alle", "全部", "الكل"),
  tp_no_match:      t("No templates match your filters", "Nenhum template corresponde aos filtros", "Ninguna plantilla coincide con los filtros", "Aucun modèle ne correspond aux filtres", "Keine Vorlagen gefunden", "没有匹配的模板", "لا توجد قوالب مطابقة"),
  tp_use:           t("Use template", "Usar template", "Usar plantilla", "Utiliser", "Vorlage verwenden", "使用模板", "استخدام القالب"),
};

export type ObKey = keyof typeof OB;

export const useObT = (language: string): ((key: ObKey) => string) => {
  const lang = language in OB.skip_setup ? language : "en";
  return (key: ObKey) => {
    const entry = OB[key];
    return (entry as Record<string, string>)[lang] || (entry as Record<string, string>).en || key;
  };
};
