// Dashboard-specific translations
// Priority: EN (base), PT-BR, ES, ZH

export type DashLang = "en" | "pt" | "es" | "zh" | "fr" | "de" | "ar";

export type DashT = {
  // Sidebar nav
  nav_overview: string;
  nav_analyses: string;
  nav_boards: string;
  nav_hooks: string;
  nav_templates: string;
  nav_translate: string;
  nav_preflight: string;
  nav_intelligence: string;
  nav_persona: string;
  nav_workspace: string;
  nav_tools: string;
  nav_upgrade: string;
  nav_upgrade_desc: string;

  // Overview
  ov_welcome: string;
  ov_good_morning: string;
  ov_good_afternoon: string;
  ov_good_evening: string;
  ov_analyses: string;
  ov_boards: string;
  ov_avg_hook: string;
  ov_preflights: string;
  ov_recent: string;
  ov_no_activity: string;
  ov_quick_actions: string;
  ov_new_analysis: string;
  ov_new_board: string;
  ov_run_hooks: string;
  ov_intel_feed: string;
  ov_view_all: string;
  ov_no_signals: string;
  ov_no_persona: string;
  ov_set_persona: string;
  ov_of: string;
  ov_used: string;
  ov_remaining: string;
  ov_reset: string;

  // Analyses
  an_title: string;
  an_new: string;
  an_empty: string;
  an_empty_sub: string;
  an_completed: string;
  an_failed: string;
  an_processing: string;
  an_hook_score: string;
  an_model: string;
  an_market: string;
  an_platform: string;
  an_hook_type: string;
  an_back: string;
  an_delete: string;
  an_copy_brief: string;
  an_copied: string;
  an_recommendations: string;
  an_improvements: string;
  an_hook_analysis: string;

  // Boards
  bo_title: string;
  bo_new: string;
  bo_empty: string;
  bo_empty_sub: string;
  bo_generate: string;
  bo_generating: string;
  bo_prompt_label: string;
  bo_prompt_ph: string;
  bo_platform: string;
  bo_market: string;
  bo_format: string;
  bo_duration: string;
  bo_product: string;
  bo_funnel: string;
  bo_tofu: string;
  bo_mofu: string;
  bo_bofu: string;
  bo_copy: string;
  bo_download: string;
  bo_scenes: string;
  bo_vo_script: string;
  bo_on_screen: string;
  bo_editor_notes: string;

  // Hook Generator
  hg_title: string;
  hg_subtitle: string;
  hg_platform: string;
  hg_market: string;
  hg_product: string;
  hg_style: string;
  hg_generate: string;
  hg_generating: string;
  hg_results: string;
  hg_copy: string;
  hg_copied: string;
  hg_score: string;
  hg_type: string;
  hg_strength: string;
  hg_feedback_up: string;
  hg_feedback_down: string;
  hg_empty: string;

  // Pre-flight
  pf_title: string;
  pf_subtitle: string;
  pf_script: string;
  pf_video: string;
  pf_script_label: string;
  pf_script_ph: string;
  pf_hook_label: string;
  pf_cta_label: string;
  pf_run: string;
  pf_running: string;
  pf_ready: string;
  pf_review: string;
  pf_blocked: string;
  pf_compliance: string;
  pf_hook_analysis: string;
  pf_structure: string;
  pf_funnel: string;
  pf_tofu: string;
  pf_mofu: string;
  pf_bofu: string;

  // Intelligence
  intel_title: string;
  intel_subtitle: string;
  intel_no_data: string;
  intel_no_data_sub: string;
  intel_signals: string;
  intel_top_model: string;
  intel_avg_score: string;
  intel_viral: string;
  intel_rebuild: string;
  intel_memory: string;
  intel_ai_knows: string;

  // Persona
  pe_title: string;
  pe_new: string;
  pe_empty: string;
  pe_empty_sub: string;
  pe_name: string;
  pe_age: string;
  pe_platforms: string;
  pe_pain_points: string;
  pe_interests: string;
  pe_income: string;
  pe_generate: string;
  pe_save: string;
  pe_activate: string;
  pe_active: string;
  pe_deactivate: string;
  pe_delete: string;

  // Translate
  tr_title: string;
  tr_subtitle: string;
  tr_source: string;
  tr_target: string;
  tr_translate: string;
  tr_translating: string;
  tr_copy: string;
  tr_result: string;

  // Persona warning modal
  pw_title: string;
  pw_desc: string;
  pw_benefit1: string;
  pw_benefit2: string;
  pw_benefit3: string;
  pw_cta: string;
  pw_skip: string;

  // Common
  cm_save: string;
  cm_cancel: string;
  cm_delete: string;
  cm_edit: string;
  cm_close: string;
  cm_loading: string;
  cm_error: string;
  cm_success: string;
  cm_ago: string;
  cm_today: string;
  cm_yesterday: string;
  cm_no_persona: string;
  cm_active_persona: string;
  cm_manage_personas: string;
  cm_clear: string;
};

export const dashTranslations: Record<DashLang, DashT> = {
  en: {
    nav_overview: "Overview", nav_analyses: "Analyses", nav_boards: "Boards",
    nav_hooks: "Hook Generator", nav_templates: "Templates", nav_translate: "Translate",
    nav_preflight: "Pre-flight", nav_intelligence: "Intelligence", nav_persona: "Persona",
    nav_workspace: "Workspace", nav_tools: "Tools", nav_upgrade: "Upgrade plan",
    nav_upgrade_desc: "Unlock more analyses & boards",
    ov_welcome: "Welcome back", ov_good_morning: "Good morning", ov_good_afternoon: "Good afternoon",
    ov_good_evening: "Good evening", ov_analyses: "Analyses", ov_boards: "Boards",
    ov_avg_hook: "Avg hook score", ov_preflights: "Pre-flights", ov_recent: "Recent activity",
    ov_no_activity: "No activity yet", ov_quick_actions: "Quick actions", ov_new_analysis: "New analysis",
    ov_new_board: "New board", ov_run_hooks: "Run hooks", ov_intel_feed: "Intelligence feed",
    ov_view_all: "View all", ov_no_signals: "No signals yet", ov_no_persona: "No persona active",
    ov_set_persona: "Set a persona to personalize AI outputs", ov_of: "of", ov_used: "used",
    ov_remaining: "remaining", ov_reset: "Resets",
    an_title: "Analyses", an_new: "New Analysis", an_empty: "No analyses yet",
    an_empty_sub: "Upload a video to get your first creative analysis",
    an_completed: "Completed", an_failed: "Failed", an_processing: "Processing",
    an_hook_score: "Hook Score", an_model: "Creative Model", an_market: "Market",
    an_platform: "Platform", an_hook_type: "Hook Type", an_back: "Back",
    an_delete: "Delete", an_copy_brief: "Copy brief", an_copied: "Copied",
    an_recommendations: "Recommendations", an_improvements: "Improvements", an_hook_analysis: "Hook Analysis",
    bo_title: "Boards", bo_new: "New Board", bo_empty: "No boards yet",
    bo_empty_sub: "Generate your first production board",
    bo_generate: "Generate Board", bo_generating: "Generating...", bo_prompt_label: "Brief / Prompt",
    bo_prompt_ph: "e.g. A 30s UGC ad for a Brazilian iGaming app targeting male 25-35...",
    bo_platform: "Platform", bo_market: "Market", bo_format: "Format", bo_duration: "Duration",
    bo_product: "Product / Brand", bo_funnel: "Funnel Stage", bo_tofu: "ToFu", bo_mofu: "MoFu", bo_bofu: "BoFu",
    bo_copy: "Copy", bo_download: "Download", bo_scenes: "Scenes", bo_vo_script: "VO Script",
    bo_on_screen: "On-Screen Text", bo_editor_notes: "Editor Notes",
    hg_title: "Hook Generator", hg_subtitle: "AI-powered hooks for any platform",
    hg_platform: "Platform", hg_market: "Market", hg_product: "Product / Brand",
    hg_style: "Style", hg_generate: "Generate Hooks", hg_generating: "Generating...",
    hg_results: "Generated hooks", hg_copy: "Copy", hg_copied: "Copied",
    hg_score: "Score", hg_type: "Type", hg_strength: "Strength",
    hg_feedback_up: "Got it — more like this 👍", hg_feedback_down: "Noted — fewer of this type 👎",
    hg_empty: "Generate hooks to see results here",
    pf_title: "Pre-flight Check", pf_subtitle: "AI analysis — compliance · hook · structure · platform fit",
    pf_script: "Script", pf_video: "Video", pf_script_label: "Script",
    pf_script_ph: "Paste your ad script here...", pf_hook_label: "Hook (0-3s)", pf_cta_label: "CTA",
    pf_run: "Run Pre-flight Check", pf_running: "Analyzing...", pf_ready: "READY",
    pf_review: "REVIEW", pf_blocked: "BLOCKED", pf_compliance: "Compliance",
    pf_hook_analysis: "Hook Analysis", pf_structure: "Structure", pf_funnel: "Funnel Stage",
    pf_tofu: "ToFu · Awareness", pf_mofu: "MoFu · Consideration", pf_bofu: "BoFu · Conversion",
    intel_title: "Intelligence", intel_subtitle: "Patterns from your creative data",
    intel_no_data: "No signals yet", intel_no_data_sub: "Generate hooks or run an analysis to start building creative intelligence",
    intel_signals: "signals", intel_top_model: "Top model", intel_avg_score: "Avg score",
    intel_viral: "Viral hooks", intel_rebuild: "Rebuild profile", intel_memory: "Creative Memory",
    intel_ai_knows: "What the AI knows about your creatives",
    pe_title: "Personas", pe_new: "New Persona", pe_empty: "No personas yet",
    pe_empty_sub: "Create your first audience persona to personalize AI outputs",
    pe_name: "Name", pe_age: "Age range", pe_platforms: "Platforms",
    pe_pain_points: "Pain points", pe_interests: "Interests", pe_income: "Income level",
    pe_generate: "Generate with AI", pe_save: "Save persona", pe_activate: "Use this persona",
    pe_active: "Active", pe_deactivate: "Deactivate", pe_delete: "Delete",
    tr_title: "Translate", tr_subtitle: "Adapt your ad script to any market",
    tr_source: "Source language", tr_target: "Target language", tr_translate: "Translate",
    tr_translating: "Translating...", tr_copy: "Copy", tr_result: "Translation",
    pw_title: "Persona not set", pw_desc: "Without a persona, AI generates generic outputs. Set one to get hooks and briefs tailored to your exact audience.",
    pw_benefit1: "Hooks calibrated to your audience's pain points",
    pw_benefit2: "Tone and language matched to the persona",
    pw_benefit3: "Smarter briefs with audience context baked in",
    pw_cta: "Set a persona", pw_skip: "Continue without persona",
    cm_save: "Save", cm_cancel: "Cancel", cm_delete: "Delete", cm_edit: "Edit",
    cm_close: "Close", cm_loading: "Loading...", cm_error: "Something went wrong",
    cm_success: "Done", cm_ago: "ago", cm_today: "Today", cm_yesterday: "Yesterday",
    cm_no_persona: "No persona selected", cm_active_persona: "Active persona",
    cm_manage_personas: "Manage personas", cm_clear: "Clear",
  },

  pt: {
    nav_overview: "Visão Geral", nav_analyses: "Análises", nav_boards: "Boards",
    nav_hooks: "Gerador de Hooks", nav_templates: "Templates", nav_translate: "Traduzir",
    nav_preflight: "Pré-voo", nav_intelligence: "Inteligência", nav_persona: "Persona",
    nav_workspace: "Área de Trabalho", nav_tools: "Ferramentas", nav_upgrade: "Fazer upgrade",
    nav_upgrade_desc: "Desbloqueie mais análises e boards",
    ov_welcome: "Bem-vindo de volta", ov_good_morning: "Bom dia", ov_good_afternoon: "Boa tarde",
    ov_good_evening: "Boa noite", ov_analyses: "Análises", ov_boards: "Boards",
    ov_avg_hook: "Score médio de hook", ov_preflights: "Pré-voos", ov_recent: "Atividade recente",
    ov_no_activity: "Nenhuma atividade ainda", ov_quick_actions: "Ações rápidas",
    ov_new_analysis: "Nova análise", ov_new_board: "Novo board", ov_run_hooks: "Gerar hooks",
    ov_intel_feed: "Feed de inteligência", ov_view_all: "Ver tudo",
    ov_no_signals: "Nenhum sinal ainda", ov_no_persona: "Nenhuma persona ativa",
    ov_set_persona: "Defina uma persona para personalizar os outputs de IA",
    ov_of: "de", ov_used: "usados", ov_remaining: "restantes", ov_reset: "Renova",
    an_title: "Análises", an_new: "Nova Análise", an_empty: "Nenhuma análise ainda",
    an_empty_sub: "Faça upload de um vídeo para sua primeira análise criativa",
    an_completed: "Concluída", an_failed: "Falhou", an_processing: "Processando",
    an_hook_score: "Score do Hook", an_model: "Modelo Criativo", an_market: "Mercado",
    an_platform: "Plataforma", an_hook_type: "Tipo de Hook", an_back: "Voltar",
    an_delete: "Excluir", an_copy_brief: "Copiar brief", an_copied: "Copiado",
    an_recommendations: "Recomendações", an_improvements: "Melhorias", an_hook_analysis: "Análise de Hook",
    bo_title: "Boards", bo_new: "Novo Board", bo_empty: "Nenhum board ainda",
    bo_empty_sub: "Gere seu primeiro board de produção",
    bo_generate: "Gerar Board", bo_generating: "Gerando...", bo_prompt_label: "Brief / Prompt",
    bo_prompt_ph: "ex: Um anúncio UGC de 30s para app de iGaming brasileiro, público masculino 25-35...",
    bo_platform: "Plataforma", bo_market: "Mercado", bo_format: "Formato",
    bo_duration: "Duração", bo_product: "Produto / Marca", bo_funnel: "Etapa do Funil",
    bo_tofu: "ToFu", bo_mofu: "MoFu", bo_bofu: "BoFu",
    bo_copy: "Copiar", bo_download: "Baixar", bo_scenes: "Cenas",
    bo_vo_script: "Script de VO", bo_on_screen: "Texto na Tela", bo_editor_notes: "Notas para Editor",
    hg_title: "Gerador de Hooks", hg_subtitle: "Hooks com IA para qualquer plataforma",
    hg_platform: "Plataforma", hg_market: "Mercado", hg_product: "Produto / Marca",
    hg_style: "Estilo", hg_generate: "Gerar Hooks", hg_generating: "Gerando...",
    hg_results: "Hooks gerados", hg_copy: "Copiar", hg_copied: "Copiado",
    hg_score: "Score", hg_type: "Tipo", hg_strength: "Força",
    hg_feedback_up: "Entendido — mais assim 👍", hg_feedback_down: "Anotado — menos desse tipo 👎",
    hg_empty: "Gere hooks para ver os resultados aqui",
    pf_title: "Check de Pré-voo", pf_subtitle: "Análise IA — conformidade · hook · estrutura · adequação à plataforma",
    pf_script: "Script", pf_video: "Vídeo", pf_script_label: "Script",
    pf_script_ph: "Cole seu script de anúncio aqui...", pf_hook_label: "Hook (0-3s)", pf_cta_label: "CTA",
    pf_run: "Rodar Check de Pré-voo", pf_running: "Analisando...", pf_ready: "APROVADO",
    pf_review: "REVISAR", pf_blocked: "BLOQUEADO", pf_compliance: "Conformidade",
    pf_hook_analysis: "Análise de Hook", pf_structure: "Estrutura", pf_funnel: "Etapa do Funil",
    pf_tofu: "ToFu · Consciência", pf_mofu: "MoFu · Consideração", pf_bofu: "BoFu · Conversão",
    intel_title: "Inteligência", intel_subtitle: "Padrões dos seus dados criativos",
    intel_no_data: "Nenhum sinal ainda",
    intel_no_data_sub: "Gere hooks ou rode uma análise para começar a construir inteligência criativa",
    intel_signals: "sinais", intel_top_model: "Melhor modelo", intel_avg_score: "Score médio",
    intel_viral: "Hooks virais", intel_rebuild: "Reconstruir perfil", intel_memory: "Memória Criativa",
    intel_ai_knows: "O que a IA sabe sobre seus criativos",
    pe_title: "Personas", pe_new: "Nova Persona", pe_empty: "Nenhuma persona ainda",
    pe_empty_sub: "Crie sua primeira persona de audiência para personalizar os outputs de IA",
    pe_name: "Nome", pe_age: "Faixa etária", pe_platforms: "Plataformas",
    pe_pain_points: "Pontos de dor", pe_interests: "Interesses", pe_income: "Renda",
    pe_generate: "Gerar com IA", pe_save: "Salvar persona", pe_activate: "Usar esta persona",
    pe_active: "Ativa", pe_deactivate: "Desativar", pe_delete: "Excluir",
    tr_title: "Traduzir", tr_subtitle: "Adapte seu script para qualquer mercado",
    tr_source: "Idioma de origem", tr_target: "Idioma alvo", tr_translate: "Traduzir",
    tr_translating: "Traduzindo...", tr_copy: "Copiar", tr_result: "Tradução",
    pw_title: "Persona não definida",
    pw_desc: "Sem persona, a IA gera outputs genéricos. Defina uma para obter hooks e briefs calibrados para o seu público.",
    pw_benefit1: "Hooks calibrados para as dores da sua audiência",
    pw_benefit2: "Tom e linguagem adaptados à persona",
    pw_benefit3: "Briefs mais inteligentes com contexto de audiência",
    pw_cta: "Definir uma persona", pw_skip: "Continuar sem persona",
    cm_save: "Salvar", cm_cancel: "Cancelar", cm_delete: "Excluir", cm_edit: "Editar",
    cm_close: "Fechar", cm_loading: "Carregando...", cm_error: "Algo deu errado",
    cm_success: "Pronto", cm_ago: "atrás", cm_today: "Hoje", cm_yesterday: "Ontem",
    cm_no_persona: "Nenhuma persona selecionada", cm_active_persona: "Persona ativa",
    cm_manage_personas: "Gerenciar personas", cm_clear: "Limpar",
  },

  es: {
    nav_overview: "Resumen", nav_analyses: "Análisis", nav_boards: "Boards",
    nav_hooks: "Generador de Hooks", nav_templates: "Plantillas", nav_translate: "Traducir",
    nav_preflight: "Precheck", nav_intelligence: "Inteligencia", nav_persona: "Persona",
    nav_workspace: "Área de Trabajo", nav_tools: "Herramientas", nav_upgrade: "Mejorar plan",
    nav_upgrade_desc: "Desbloquea más análisis y boards",
    ov_welcome: "Bienvenido de nuevo", ov_good_morning: "Buenos días", ov_good_afternoon: "Buenas tardes",
    ov_good_evening: "Buenas noches", ov_analyses: "Análisis", ov_boards: "Boards",
    ov_avg_hook: "Score promedio de hook", ov_preflights: "Prechecks", ov_recent: "Actividad reciente",
    ov_no_activity: "Sin actividad aún", ov_quick_actions: "Acciones rápidas",
    ov_new_analysis: "Nuevo análisis", ov_new_board: "Nuevo board", ov_run_hooks: "Generar hooks",
    ov_intel_feed: "Feed de inteligencia", ov_view_all: "Ver todo",
    ov_no_signals: "Sin señales aún", ov_no_persona: "Sin persona activa",
    ov_set_persona: "Define una persona para personalizar los outputs de IA",
    ov_of: "de", ov_used: "usados", ov_remaining: "restantes", ov_reset: "Se renueva",
    an_title: "Análisis", an_new: "Nuevo Análisis", an_empty: "Sin análisis aún",
    an_empty_sub: "Sube un video para tu primer análisis creativo",
    an_completed: "Completado", an_failed: "Fallido", an_processing: "Procesando",
    an_hook_score: "Score del Hook", an_model: "Modelo Creativo", an_market: "Mercado",
    an_platform: "Plataforma", an_hook_type: "Tipo de Hook", an_back: "Volver",
    an_delete: "Eliminar", an_copy_brief: "Copiar brief", an_copied: "Copiado",
    an_recommendations: "Recomendaciones", an_improvements: "Mejoras", an_hook_analysis: "Análisis de Hook",
    bo_title: "Boards", bo_new: "Nuevo Board", bo_empty: "Sin boards aún",
    bo_empty_sub: "Genera tu primer board de producción",
    bo_generate: "Generar Board", bo_generating: "Generando...", bo_prompt_label: "Brief / Prompt",
    bo_prompt_ph: "ej: Un anuncio UGC de 30s para app de iGaming mexicano, hombres 25-35...",
    bo_platform: "Plataforma", bo_market: "Mercado", bo_format: "Formato",
    bo_duration: "Duración", bo_product: "Producto / Marca", bo_funnel: "Etapa del Embudo",
    bo_tofu: "ToFu", bo_mofu: "MoFu", bo_bofu: "BoFu",
    bo_copy: "Copiar", bo_download: "Descargar", bo_scenes: "Escenas",
    bo_vo_script: "Guión VO", bo_on_screen: "Texto en pantalla", bo_editor_notes: "Notas para editor",
    hg_title: "Generador de Hooks", hg_subtitle: "Hooks con IA para cualquier plataforma",
    hg_platform: "Plataforma", hg_market: "Mercado", hg_product: "Producto / Marca",
    hg_style: "Estilo", hg_generate: "Generar Hooks", hg_generating: "Generando...",
    hg_results: "Hooks generados", hg_copy: "Copiar", hg_copied: "Copiado",
    hg_score: "Score", hg_type: "Tipo", hg_strength: "Fuerza",
    hg_feedback_up: "Entendido — más así 👍", hg_feedback_down: "Anotado — menos de este tipo 👎",
    hg_empty: "Genera hooks para ver los resultados aquí",
    pf_title: "Precheck de vuelo", pf_subtitle: "Análisis IA — cumplimiento · hook · estructura · plataforma",
    pf_script: "Guión", pf_video: "Video", pf_script_label: "Guión",
    pf_script_ph: "Pega tu guión de anuncio aquí...", pf_hook_label: "Hook (0-3s)", pf_cta_label: "CTA",
    pf_run: "Ejecutar Precheck", pf_running: "Analizando...", pf_ready: "LISTO",
    pf_review: "REVISAR", pf_blocked: "BLOQUEADO", pf_compliance: "Cumplimiento",
    pf_hook_analysis: "Análisis de Hook", pf_structure: "Estructura", pf_funnel: "Etapa del Embudo",
    pf_tofu: "ToFu · Conciencia", pf_mofu: "MoFu · Consideración", pf_bofu: "BoFu · Conversión",
    intel_title: "Inteligencia", intel_subtitle: "Patrones de tus datos creativos",
    intel_no_data: "Sin señales aún",
    intel_no_data_sub: "Genera hooks o ejecuta un análisis para comenzar a construir inteligencia creativa",
    intel_signals: "señales", intel_top_model: "Mejor modelo", intel_avg_score: "Score promedio",
    intel_viral: "Hooks virales", intel_rebuild: "Reconstruir perfil", intel_memory: "Memoria Creativa",
    intel_ai_knows: "Lo que la IA sabe sobre tus creativos",
    pe_title: "Personas", pe_new: "Nueva Persona", pe_empty: "Sin personas aún",
    pe_empty_sub: "Crea tu primera persona de audiencia para personalizar los outputs de IA",
    pe_name: "Nombre", pe_age: "Rango de edad", pe_platforms: "Plataformas",
    pe_pain_points: "Puntos de dolor", pe_interests: "Intereses", pe_income: "Nivel de ingresos",
    pe_generate: "Generar con IA", pe_save: "Guardar persona", pe_activate: "Usar esta persona",
    pe_active: "Activa", pe_deactivate: "Desactivar", pe_delete: "Eliminar",
    tr_title: "Traducir", tr_subtitle: "Adapta tu guión a cualquier mercado",
    tr_source: "Idioma de origen", tr_target: "Idioma destino", tr_translate: "Traducir",
    tr_translating: "Traduciendo...", tr_copy: "Copiar", tr_result: "Traducción",
    pw_title: "Sin persona definida",
    pw_desc: "Sin persona, la IA genera outputs genéricos. Define una para obtener hooks y briefs calibrados para tu audiencia.",
    pw_benefit1: "Hooks calibrados a los puntos de dolor de tu audiencia",
    pw_benefit2: "Tono y lenguaje adaptados a la persona",
    pw_benefit3: "Briefs más inteligentes con contexto de audiencia",
    pw_cta: "Definir una persona", pw_skip: "Continuar sin persona",
    cm_save: "Guardar", cm_cancel: "Cancelar", cm_delete: "Eliminar", cm_edit: "Editar",
    cm_close: "Cerrar", cm_loading: "Cargando...", cm_error: "Algo salió mal",
    cm_success: "Listo", cm_ago: "atrás", cm_today: "Hoy", cm_yesterday: "Ayer",
    cm_no_persona: "Sin persona seleccionada", cm_active_persona: "Persona activa",
    cm_manage_personas: "Gestionar personas", cm_clear: "Limpiar",
  },

  zh: {
    nav_overview: "概览", nav_analyses: "分析", nav_boards: "制作板",
    nav_hooks: "钩子生成器", nav_templates: "模板", nav_translate: "翻译",
    nav_preflight: "预检", nav_intelligence: "智能分析", nav_persona: "用户画像",
    nav_workspace: "工作区", nav_tools: "工具", nav_upgrade: "升级方案",
    nav_upgrade_desc: "解锁更多分析和制作板",
    ov_welcome: "欢迎回来", ov_good_morning: "早上好", ov_good_afternoon: "下午好",
    ov_good_evening: "晚上好", ov_analyses: "分析次数", ov_boards: "制作板",
    ov_avg_hook: "平均钩子评分", ov_preflights: "预检次数", ov_recent: "近期活动",
    ov_no_activity: "暂无活动", ov_quick_actions: "快速操作",
    ov_new_analysis: "新建分析", ov_new_board: "新建制作板", ov_run_hooks: "生成钩子",
    ov_intel_feed: "智能动态", ov_view_all: "查看全部",
    ov_no_signals: "暂无信号", ov_no_persona: "未激活用户画像",
    ov_set_persona: "设置用户画像以个性化AI输出",
    ov_of: "/", ov_used: "已使用", ov_remaining: "剩余", ov_reset: "重置于",
    an_title: "分析", an_new: "新建分析", an_empty: "暂无分析",
    an_empty_sub: "上传视频以获取您的第一个创意分析",
    an_completed: "已完成", an_failed: "失败", an_processing: "处理中",
    an_hook_score: "钩子评分", an_model: "创意模型", an_market: "市场",
    an_platform: "平台", an_hook_type: "钩子类型", an_back: "返回",
    an_delete: "删除", an_copy_brief: "复制简报", an_copied: "已复制",
    an_recommendations: "建议", an_improvements: "改进", an_hook_analysis: "钩子分析",
    bo_title: "制作板", bo_new: "新建制作板", bo_empty: "暂无制作板",
    bo_empty_sub: "生成您的第一个制作板",
    bo_generate: "生成制作板", bo_generating: "生成中...", bo_prompt_label: "简报 / 提示词",
    bo_prompt_ph: "例：30秒UGC广告，针对巴西iGaming应用，男性用户25-35岁...",
    bo_platform: "平台", bo_market: "市场", bo_format: "格式",
    bo_duration: "时长", bo_product: "产品 / 品牌", bo_funnel: "漏斗阶段",
    bo_tofu: "认知阶段", bo_mofu: "考量阶段", bo_bofu: "转化阶段",
    bo_copy: "复制", bo_download: "下载", bo_scenes: "场景",
    bo_vo_script: "旁白脚本", bo_on_screen: "屏幕文字", bo_editor_notes: "编辑备注",
    hg_title: "钩子生成器", hg_subtitle: "AI驱动的广告钩子，适用于任何平台",
    hg_platform: "平台", hg_market: "市场", hg_product: "产品 / 品牌",
    hg_style: "风格", hg_generate: "生成钩子", hg_generating: "生成中...",
    hg_results: "已生成钩子", hg_copy: "复制", hg_copied: "已复制",
    hg_score: "评分", hg_type: "类型", hg_strength: "强度",
    hg_feedback_up: "明白了 — 多来这类 👍", hg_feedback_down: "已记录 — 减少此类 👎",
    hg_empty: "生成钩子后结果将显示在这里",
    pf_title: "预检", pf_subtitle: "AI分析 — 合规 · 钩子 · 结构 · 平台适配",
    pf_script: "脚本", pf_video: "视频", pf_script_label: "脚本",
    pf_script_ph: "在此粘贴您的广告脚本...", pf_hook_label: "钩子（0-3秒）", pf_cta_label: "行动号召",
    pf_run: "运行预检", pf_running: "分析中...", pf_ready: "通过",
    pf_review: "需审查", pf_blocked: "已阻止", pf_compliance: "合规性",
    pf_hook_analysis: "钩子分析", pf_structure: "结构", pf_funnel: "漏斗阶段",
    pf_tofu: "认知阶段", pf_mofu: "考量阶段", pf_bofu: "转化阶段",
    intel_title: "智能分析", intel_subtitle: "来自您创意数据的规律",
    intel_no_data: "暂无信号",
    intel_no_data_sub: "生成钩子或运行分析以开始构建创意智能",
    intel_signals: "条信号", intel_top_model: "最佳模型", intel_avg_score: "平均评分",
    intel_viral: "病毒级钩子", intel_rebuild: "重建档案", intel_memory: "创意记忆",
    intel_ai_knows: "AI对您创意的了解",
    pe_title: "用户画像", pe_new: "新建画像", pe_empty: "暂无用户画像",
    pe_empty_sub: "创建您的第一个受众画像以个性化AI输出",
    pe_name: "名称", pe_age: "年龄范围", pe_platforms: "平台",
    pe_pain_points: "痛点", pe_interests: "兴趣", pe_income: "收入水平",
    pe_generate: "AI生成", pe_save: "保存画像", pe_activate: "使用此画像",
    pe_active: "已激活", pe_deactivate: "停用", pe_delete: "删除",
    tr_title: "翻译", tr_subtitle: "将您的广告脚本适配到任何市场",
    tr_source: "源语言", tr_target: "目标语言", tr_translate: "翻译",
    tr_translating: "翻译中...", tr_copy: "复制", tr_result: "翻译结果",
    pw_title: "未设置用户画像",
    pw_desc: "没有画像，AI会生成通用输出。设置一个以获取针对您受众的钩子和简报。",
    pw_benefit1: "钩子针对受众痛点精准校准",
    pw_benefit2: "语气和语言匹配画像特征",
    pw_benefit3: "内置受众背景的更智能简报",
    pw_cta: "设置用户画像", pw_skip: "不使用画像继续",
    cm_save: "保存", cm_cancel: "取消", cm_delete: "删除", cm_edit: "编辑",
    cm_close: "关闭", cm_loading: "加载中...", cm_error: "出现错误",
    cm_success: "完成", cm_ago: "前", cm_today: "今天", cm_yesterday: "昨天",
    cm_no_persona: "未选择画像", cm_active_persona: "已激活画像",
    cm_manage_personas: "管理画像", cm_clear: "清除",
  },

  fr: {
    nav_overview: "Tableau de bord", nav_analyses: "Analyses", nav_boards: "Boards",
    nav_hooks: "Générateur de hooks", nav_templates: "Modèles", nav_translate: "Traduire",
    nav_preflight: "Pré-vol", nav_intelligence: "Intelligence", nav_persona: "Persona",
    nav_workspace: "Espace de travail", nav_tools: "Outils", nav_upgrade: "Mettre à niveau",
    nav_upgrade_desc: "Débloquez plus d'analyses et de boards",
    ov_welcome: "Bon retour", ov_good_morning: "Bonjour", ov_good_afternoon: "Bon après-midi",
    ov_good_evening: "Bonsoir", ov_analyses: "Analyses", ov_boards: "Boards",
    ov_avg_hook: "Score moyen du hook", ov_preflights: "Pré-vols", ov_recent: "Activité récente",
    ov_no_activity: "Aucune activité", ov_quick_actions: "Actions rapides",
    ov_new_analysis: "Nouvelle analyse", ov_new_board: "Nouveau board", ov_run_hooks: "Générer des hooks",
    ov_intel_feed: "Fil d'intelligence", ov_view_all: "Voir tout",
    ov_no_signals: "Aucun signal", ov_no_persona: "Aucune persona active",
    ov_set_persona: "Définissez une persona pour personnaliser les sorties IA",
    ov_of: "sur", ov_used: "utilisés", ov_remaining: "restants", ov_reset: "Réinitialisation",
    an_title: "Analyses", an_new: "Nouvelle analyse", an_empty: "Aucune analyse",
    an_empty_sub: "Importez une vidéo pour votre première analyse créative",
    an_completed: "Terminée", an_failed: "Échouée", an_processing: "En cours",
    an_hook_score: "Score du hook", an_model: "Modèle créatif", an_market: "Marché",
    an_platform: "Plateforme", an_hook_type: "Type de hook", an_back: "Retour",
    an_delete: "Supprimer", an_copy_brief: "Copier le brief", an_copied: "Copié",
    an_recommendations: "Recommandations", an_improvements: "Améliorations", an_hook_analysis: "Analyse du hook",
    bo_title: "Boards", bo_new: "Nouveau board", bo_empty: "Aucun board",
    bo_empty_sub: "Générez votre premier board de production",
    bo_generate: "Générer le board", bo_generating: "Génération...", bo_prompt_label: "Brief / Prompt",
    bo_prompt_ph: "ex: Une pub UGC 30s pour une app iGaming, hommes 25-35...",
    bo_platform: "Plateforme", bo_market: "Marché", bo_format: "Format",
    bo_duration: "Durée", bo_product: "Produit / Marque", bo_funnel: "Étape du funnel",
    bo_tofu: "ToFu", bo_mofu: "MoFu", bo_bofu: "BoFu",
    bo_copy: "Copier", bo_download: "Télécharger", bo_scenes: "Scènes",
    bo_vo_script: "Script VO", bo_on_screen: "Texte à l'écran", bo_editor_notes: "Notes éditeur",
    hg_title: "Générateur de hooks", hg_subtitle: "Hooks IA pour toute plateforme",
    hg_platform: "Plateforme", hg_market: "Marché", hg_product: "Produit / Marque",
    hg_style: "Style", hg_generate: "Générer des hooks", hg_generating: "Génération...",
    hg_results: "Hooks générés", hg_copy: "Copier", hg_copied: "Copié",
    hg_score: "Score", hg_type: "Type", hg_strength: "Force",
    hg_feedback_up: "Compris — plus comme ça 👍", hg_feedback_down: "Noté — moins de ce type 👎",
    hg_empty: "Générez des hooks pour voir les résultats ici",
    pf_title: "Check pré-vol", pf_subtitle: "Analyse IA — conformité · hook · structure · plateforme",
    pf_script: "Script", pf_video: "Vidéo", pf_script_label: "Script",
    pf_script_ph: "Collez votre script ici...", pf_hook_label: "Hook (0-3s)", pf_cta_label: "CTA",
    pf_run: "Lancer le check", pf_running: "Analyse...", pf_ready: "PRÊT",
    pf_review: "À REVOIR", pf_blocked: "BLOQUÉ", pf_compliance: "Conformité",
    pf_hook_analysis: "Analyse du hook", pf_structure: "Structure", pf_funnel: "Étape du funnel",
    pf_tofu: "ToFu · Notoriété", pf_mofu: "MoFu · Considération", pf_bofu: "BoFu · Conversion",
    intel_title: "Intelligence", intel_subtitle: "Tendances de vos données créatives",
    intel_no_data: "Aucun signal", intel_no_data_sub: "Générez des hooks ou lancez une analyse",
    intel_signals: "signaux", intel_top_model: "Meilleur modèle", intel_avg_score: "Score moyen",
    intel_viral: "Hooks viraux", intel_rebuild: "Reconstruire le profil", intel_memory: "Mémoire créative",
    intel_ai_knows: "Ce que l'IA sait de vos créatifs",
    pe_title: "Personas", pe_new: "Nouvelle persona", pe_empty: "Aucune persona",
    pe_empty_sub: "Créez votre première persona pour personnaliser les sorties IA",
    pe_name: "Nom", pe_age: "Tranche d'âge", pe_platforms: "Plateformes",
    pe_pain_points: "Points de douleur", pe_interests: "Intérêts", pe_income: "Revenu",
    pe_generate: "Générer avec IA", pe_save: "Enregistrer", pe_activate: "Utiliser cette persona",
    pe_active: "Active", pe_deactivate: "Désactiver", pe_delete: "Supprimer",
    tr_title: "Traduire", tr_subtitle: "Adaptez votre script à n'importe quel marché",
    tr_source: "Langue source", tr_target: "Langue cible", tr_translate: "Traduire",
    tr_translating: "Traduction...", tr_copy: "Copier", tr_result: "Traduction",
    pw_title: "Aucune persona définie",
    pw_desc: "Sans persona, l'IA génère des sorties génériques. Définissez-en une pour des hooks calibrés.",
    pw_benefit1: "Hooks calibrés sur les douleurs de votre audience",
    pw_benefit2: "Ton et langage adaptés à la persona",
    pw_benefit3: "Briefs plus intelligents avec contexte d'audience",
    pw_cta: "Définir une persona", pw_skip: "Continuer sans persona",
    cm_save: "Enregistrer", cm_cancel: "Annuler", cm_delete: "Supprimer", cm_edit: "Modifier",
    cm_close: "Fermer", cm_loading: "Chargement...", cm_error: "Une erreur s'est produite",
    cm_success: "Fait", cm_ago: "il y a", cm_today: "Aujourd'hui", cm_yesterday: "Hier",
    cm_no_persona: "Aucune persona sélectionnée", cm_active_persona: "Persona active",
    cm_manage_personas: "Gérer les personas", cm_clear: "Effacer",
  },

  de: {
    nav_overview: "Übersicht", nav_analyses: "Analysen", nav_boards: "Boards",
    nav_hooks: "Hook-Generator", nav_templates: "Vorlagen", nav_translate: "Übersetzen",
    nav_preflight: "Vorflug-Check", nav_intelligence: "Intelligenz", nav_persona: "Persona",
    nav_workspace: "Arbeitsbereich", nav_tools: "Tools", nav_upgrade: "Plan upgraden",
    nav_upgrade_desc: "Mehr Analysen und Boards freischalten",
    ov_welcome: "Willkommen zurück", ov_good_morning: "Guten Morgen", ov_good_afternoon: "Guten Tag",
    ov_good_evening: "Guten Abend", ov_analyses: "Analysen", ov_boards: "Boards",
    ov_avg_hook: "Ø Hook-Score", ov_preflights: "Vorflug-Checks", ov_recent: "Letzte Aktivität",
    ov_no_activity: "Noch keine Aktivität", ov_quick_actions: "Schnellaktionen",
    ov_new_analysis: "Neue Analyse", ov_new_board: "Neues Board", ov_run_hooks: "Hooks generieren",
    ov_intel_feed: "Intelligence-Feed", ov_view_all: "Alle anzeigen",
    ov_no_signals: "Noch keine Signale", ov_no_persona: "Keine aktive Persona",
    ov_set_persona: "Persona festlegen, um KI-Ausgaben zu personalisieren",
    ov_of: "von", ov_used: "genutzt", ov_remaining: "verbleibend", ov_reset: "Reset",
    an_title: "Analysen", an_new: "Neue Analyse", an_empty: "Noch keine Analysen",
    an_empty_sub: "Video hochladen für Ihre erste kreative Analyse",
    an_completed: "Abgeschlossen", an_failed: "Fehlgeschlagen", an_processing: "Wird verarbeitet",
    an_hook_score: "Hook-Score", an_model: "Kreativmodell", an_market: "Markt",
    an_platform: "Plattform", an_hook_type: "Hook-Typ", an_back: "Zurück",
    an_delete: "Löschen", an_copy_brief: "Brief kopieren", an_copied: "Kopiert",
    an_recommendations: "Empfehlungen", an_improvements: "Verbesserungen", an_hook_analysis: "Hook-Analyse",
    bo_title: "Boards", bo_new: "Neues Board", bo_empty: "Noch keine Boards",
    bo_empty_sub: "Erstes Produktions-Board generieren",
    bo_generate: "Board generieren", bo_generating: "Wird generiert...", bo_prompt_label: "Brief / Prompt",
    bo_prompt_ph: "z.B.: 30s UGC-Anzeige für eine iGaming-App, Männer 25-35...",
    bo_platform: "Plattform", bo_market: "Markt", bo_format: "Format",
    bo_duration: "Dauer", bo_product: "Produkt / Marke", bo_funnel: "Funnel-Phase",
    bo_tofu: "ToFu", bo_mofu: "MoFu", bo_bofu: "BoFu",
    bo_copy: "Kopieren", bo_download: "Herunterladen", bo_scenes: "Szenen",
    bo_vo_script: "VO-Skript", bo_on_screen: "Bildschirmtext", bo_editor_notes: "Editor-Notizen",
    hg_title: "Hook-Generator", hg_subtitle: "KI-gestützte Hooks für jede Plattform",
    hg_platform: "Plattform", hg_market: "Markt", hg_product: "Produkt / Marke",
    hg_style: "Stil", hg_generate: "Hooks generieren", hg_generating: "Wird generiert...",
    hg_results: "Generierte Hooks", hg_copy: "Kopieren", hg_copied: "Kopiert",
    hg_score: "Score", hg_type: "Typ", hg_strength: "Stärke",
    hg_feedback_up: "Verstanden — mehr davon 👍", hg_feedback_down: "Notiert — weniger davon 👎",
    hg_empty: "Hooks generieren, um Ergebnisse zu sehen",
    pf_title: "Vorflug-Check", pf_subtitle: "KI-Analyse — Compliance · Hook · Struktur · Plattform",
    pf_script: "Skript", pf_video: "Video", pf_script_label: "Skript",
    pf_script_ph: "Anzeigenskript hier einfügen...", pf_hook_label: "Hook (0-3s)", pf_cta_label: "CTA",
    pf_run: "Check starten", pf_running: "Analysiere...", pf_ready: "BEREIT",
    pf_review: "ÜBERPRÜFEN", pf_blocked: "BLOCKIERT", pf_compliance: "Compliance",
    pf_hook_analysis: "Hook-Analyse", pf_structure: "Struktur", pf_funnel: "Funnel-Phase",
    pf_tofu: "ToFu · Bewusstsein", pf_mofu: "MoFu · Überlegung", pf_bofu: "BoFu · Konversion",
    intel_title: "Intelligenz", intel_subtitle: "Muster aus Ihren Kreativdaten",
    intel_no_data: "Noch keine Signale", intel_no_data_sub: "Hooks generieren oder Analyse starten",
    intel_signals: "Signale", intel_top_model: "Top-Modell", intel_avg_score: "Ø Score",
    intel_viral: "Virale Hooks", intel_rebuild: "Profil neu erstellen", intel_memory: "Kreatives Gedächtnis",
    intel_ai_knows: "Was die KI über Ihre Creatives weiß",
    pe_title: "Personas", pe_new: "Neue Persona", pe_empty: "Noch keine Personas",
    pe_empty_sub: "Erste Zielgruppen-Persona erstellen",
    pe_name: "Name", pe_age: "Altersgruppe", pe_platforms: "Plattformen",
    pe_pain_points: "Schmerzpunkte", pe_interests: "Interessen", pe_income: "Einkommensniveau",
    pe_generate: "Mit KI generieren", pe_save: "Persona speichern", pe_activate: "Diese Persona verwenden",
    pe_active: "Aktiv", pe_deactivate: "Deaktivieren", pe_delete: "Löschen",
    tr_title: "Übersetzen", tr_subtitle: "Skript für jeden Markt anpassen",
    tr_source: "Quellsprache", tr_target: "Zielsprache", tr_translate: "Übersetzen",
    tr_translating: "Übersetze...", tr_copy: "Kopieren", tr_result: "Übersetzung",
    pw_title: "Keine Persona festgelegt",
    pw_desc: "Ohne Persona generiert die KI generische Ausgaben. Legen Sie eine fest für kalibrierte Hooks.",
    pw_benefit1: "Hooks auf die Schmerzpunkte Ihrer Zielgruppe kalibriert",
    pw_benefit2: "Ton und Sprache an die Persona angepasst",
    pw_benefit3: "Intelligentere Briefs mit Zielgruppen-Kontext",
    pw_cta: "Persona festlegen", pw_skip: "Ohne Persona fortfahren",
    cm_save: "Speichern", cm_cancel: "Abbrechen", cm_delete: "Löschen", cm_edit: "Bearbeiten",
    cm_close: "Schließen", cm_loading: "Lädt...", cm_error: "Etwas ist schiefgelaufen",
    cm_success: "Fertig", cm_ago: "vor", cm_today: "Heute", cm_yesterday: "Gestern",
    cm_no_persona: "Keine Persona ausgewählt", cm_active_persona: "Aktive Persona",
    cm_manage_personas: "Personas verwalten", cm_clear: "Löschen",
  },

  ar: {
    nav_overview: "نظرة عامة", nav_analyses: "التحليلات", nav_boards: "اللوحات",
    nav_hooks: "مولّد الخطافات", nav_templates: "القوالب", nav_translate: "ترجمة",
    nav_preflight: "الفحص المسبق", nav_intelligence: "الذكاء الإبداعي", nav_persona: "الشخصية",
    nav_workspace: "مساحة العمل", nav_tools: "الأدوات", nav_upgrade: "ترقية الخطة",
    nav_upgrade_desc: "احصل على المزيد من التحليلات واللوحات",
    ov_welcome: "مرحباً بعودتك", ov_good_morning: "صباح الخير", ov_good_afternoon: "مساء الخير",
    ov_good_evening: "مساء النور", ov_analyses: "التحليلات", ov_boards: "اللوحات",
    ov_avg_hook: "متوسط نقاط الخطاف", ov_preflights: "الفحوصات المسبقة", ov_recent: "النشاط الأخير",
    ov_no_activity: "لا نشاط بعد", ov_quick_actions: "إجراءات سريعة",
    ov_new_analysis: "تحليل جديد", ov_new_board: "لوحة جديدة", ov_run_hooks: "توليد خطافات",
    ov_intel_feed: "تغذية الذكاء", ov_view_all: "عرض الكل",
    ov_no_signals: "لا إشارات بعد", ov_no_persona: "لا شخصية نشطة",
    ov_set_persona: "حدد شخصية لتخصيص مخرجات الذكاء الاصطناعي",
    ov_of: "من", ov_used: "مستخدم", ov_remaining: "متبقي", ov_reset: "إعادة تعيين",
    an_title: "التحليلات", an_new: "تحليل جديد", an_empty: "لا تحليلات بعد",
    an_empty_sub: "ارفع مقطعاً للحصول على أول تحليل إبداعي",
    an_completed: "مكتمل", an_failed: "فشل", an_processing: "جاري المعالجة",
    an_hook_score: "نقاط الخطاف", an_model: "النموذج الإبداعي", an_market: "السوق",
    an_platform: "المنصة", an_hook_type: "نوع الخطاف", an_back: "رجوع",
    an_delete: "حذف", an_copy_brief: "نسخ الإحاطة", an_copied: "تم النسخ",
    an_recommendations: "التوصيات", an_improvements: "التحسينات", an_hook_analysis: "تحليل الخطاف",
    bo_title: "اللوحات", bo_new: "لوحة جديدة", bo_empty: "لا لوحات بعد",
    bo_empty_sub: "أنشئ أول لوحة إنتاج",
    bo_generate: "توليد لوحة", bo_generating: "جاري التوليد...", bo_prompt_label: "الإحاطة / الموجّه",
    bo_prompt_ph: "مثال: إعلان UGC لمدة 30 ثانية لتطبيق iGaming...",
    bo_platform: "المنصة", bo_market: "السوق", bo_format: "الصيغة",
    bo_duration: "المدة", bo_product: "المنتج / العلامة", bo_funnel: "مرحلة القمع",
    bo_tofu: "الوعي", bo_mofu: "التفكير", bo_bofu: "التحويل",
    bo_copy: "نسخ", bo_download: "تنزيل", bo_scenes: "المشاهد",
    bo_vo_script: "نص المشارك الصوتي", bo_on_screen: "النص على الشاشة", bo_editor_notes: "ملاحظات المحرر",
    hg_title: "مولّد الخطافات", hg_subtitle: "خطافات بالذكاء الاصطناعي لأي منصة",
    hg_platform: "المنصة", hg_market: "السوق", hg_product: "المنتج / العلامة",
    hg_style: "الأسلوب", hg_generate: "توليد خطافات", hg_generating: "جاري التوليد...",
    hg_results: "الخطافات المولّدة", hg_copy: "نسخ", hg_copied: "تم النسخ",
    hg_score: "النقاط", hg_type: "النوع", hg_strength: "القوة",
    hg_feedback_up: "تم — المزيد من هذا 👍", hg_feedback_down: "تم التسجيل — أقل من هذا النوع 👎",
    hg_empty: "ولّد خطافات لرؤية النتائج هنا",
    pf_title: "الفحص المسبق", pf_subtitle: "تحليل الذكاء الاصطناعي — الامتثال · الخطاف · البنية · المنصة",
    pf_script: "النص", pf_video: "الفيديو", pf_script_label: "النص",
    pf_script_ph: "الصق نص الإعلان هنا...", pf_hook_label: "الخطاف (0-3 ثوانٍ)", pf_cta_label: "CTA",
    pf_run: "تشغيل الفحص", pf_running: "جاري التحليل...", pf_ready: "جاهز",
    pf_review: "يحتاج مراجعة", pf_blocked: "محظور", pf_compliance: "الامتثال",
    pf_hook_analysis: "تحليل الخطاف", pf_structure: "البنية", pf_funnel: "مرحلة القمع",
    pf_tofu: "الوعي", pf_mofu: "التفكير", pf_bofu: "التحويل",
    intel_title: "الذكاء الإبداعي", intel_subtitle: "أنماط من بياناتك الإبداعية",
    intel_no_data: "لا إشارات بعد", intel_no_data_sub: "ولّد خطافات أو شغّل تحليلاً",
    intel_signals: "إشارات", intel_top_model: "أفضل نموذج", intel_avg_score: "متوسط النقاط",
    intel_viral: "خطافات فيروسية", intel_rebuild: "إعادة بناء الملف", intel_memory: "الذاكرة الإبداعية",
    intel_ai_knows: "ما يعرفه الذكاء الاصطناعي عن إبداعاتك",
    pe_title: "الشخصيات", pe_new: "شخصية جديدة", pe_empty: "لا شخصيات بعد",
    pe_empty_sub: "أنشئ أول شخصية جمهور لتخصيص مخرجات الذكاء الاصطناعي",
    pe_name: "الاسم", pe_age: "الفئة العمرية", pe_platforms: "المنصات",
    pe_pain_points: "نقاط الألم", pe_interests: "الاهتمامات", pe_income: "مستوى الدخل",
    pe_generate: "توليد بالذكاء الاصطناعي", pe_save: "حفظ الشخصية", pe_activate: "استخدام هذه الشخصية",
    pe_active: "نشطة", pe_deactivate: "إلغاء التفعيل", pe_delete: "حذف",
    tr_title: "ترجمة", tr_subtitle: "تكيّف نصك مع أي سوق",
    tr_source: "لغة المصدر", tr_target: "اللغة الهدف", tr_translate: "ترجمة",
    tr_translating: "جاري الترجمة...", tr_copy: "نسخ", tr_result: "الترجمة",
    pw_title: "لم يتم تعيين شخصية",
    pw_desc: "بدون شخصية، يولّد الذكاء الاصطناعي مخرجات عامة. حدد شخصية للحصول على خطافات مخصصة.",
    pw_benefit1: "خطافات معايَرة لنقاط ألم جمهورك",
    pw_benefit2: "نبرة ولغة تتوافق مع الشخصية",
    pw_benefit3: "إحاطات أكثر ذكاءً بسياق الجمهور",
    pw_cta: "تعيين شخصية", pw_skip: "المتابعة بدون شخصية",
    cm_save: "حفظ", cm_cancel: "إلغاء", cm_delete: "حذف", cm_edit: "تعديل",
    cm_close: "إغلاق", cm_loading: "جاري التحميل...", cm_error: "حدث خطأ",
    cm_success: "تم", cm_ago: "منذ", cm_today: "اليوم", cm_yesterday: "أمس",
    cm_no_persona: "لا شخصية محددة", cm_active_persona: "الشخصية النشطة",
    cm_manage_personas: "إدارة الشخصيات", cm_clear: "مسح",
  },
};

export const useDashT = (language: string): ((key: keyof DashT) => string) => {
  const lang = (language as DashLang) in dashTranslations ? (language as DashLang) : "en";
  const dict = dashTranslations[lang];
  return (key: keyof DashT) => dict[key] || dashTranslations.en[key] || key;
};
