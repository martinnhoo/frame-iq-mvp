# AdBrief Cerebro — Deploy no Fly.io

## Setup (5 minutos)

1. Install Fly CLI: `brew install flyctl`
2. Login: `fly auth login`
3. Deploy:
```bash
cd fly-trend-watcher
fly launch --no-deploy
fly secrets set SUPABASE_URL="sua-url" SUPABASE_KEY="sua-service-role-key"
fly deploy
```

## Verificar logs
```bash
fly logs -a adbrief-cerebro
```

## Custo
- Fly.io free tier: $0/mês (3 VMs shared-cpu-1x incluídas)
- Anthropic: ~$5-10/mês (Haiku para scoring + Sonnet para pesquisa cultural)

## O que faz
- A cada 15min: detecta trends no Google + Twitter
- Para cada trend nova: chama trend-researcher (entende o meme)
- Se trend ainda viva: chama trend-matcher (score por conta)
- Se fit >= 7: envia Telegram + salva em account_alerts
