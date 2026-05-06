import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// manualChunks separa vendors estáveis (cache hit-rate alto entre deploys)
// do app code (que muda em cada deploy). Antes era 1 bundle de 715 KB com
// tudo junto — qualquer commit de feature invalida cache de React inteiro.
// Com chunks, vendors só re-baixam quando versão muda de fato.
//
// Nota intencional: NÃO incluir @lovable.dev/cloud-auth-js junto de
// @supabase/supabase-js. Lovable auth usa supabase-js internamente, e
// agrupá-los manualmente já causou suspeita de duas instâncias do
// cliente em produção (refresh_token quebrou). Deixa lovable cair no
// chunk app default — só supabase-js fica isolado.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "framer-motion"],
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — quase nunca muda de versão
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // Supabase isolado (sem cloud-auth-js — ver nota acima)
          "supabase": ["@supabase/supabase-js"],
          // Radix UI — 24 pacotes pequenos juntos viram um chunk decente
          "radix": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-aspect-ratio",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-hover-card",
            "@radix-ui/react-menubar",
            "@radix-ui/react-navigation-menu",
          ],
          "query": ["@tanstack/react-query"],
          "forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          // lucide-react sozinho — tree-shake ainda funciona, mas isolar
          // garante que ícones não polluam o app chunk.
          "icons": ["lucide-react"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
