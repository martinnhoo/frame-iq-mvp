#!/usr/bin/env python3
"""
AdBrief Cerebro — Mac Mini 24h Agent
Detecta trends, pesquisa o que realmente são, e entrega briefs para as contas certas.
Roda 24h no Mac Mini M4 como complemento ao Supabase cron.

Setup:
  pip3 install requests schedule python-dotenv

  .env:
    SUPABASE_URL=...
    SUPABASE_SERVICE_ROLE_KEY=...
    ANTHROPIC_API_KEY=...
    BRAVE_API_KEY=...  (opcional mas recomendado)

Run:
  python3 notifier.py
"""

import os
import json
import time
import logging
import hashlib
import schedule
from datetime import datetime, timedelta
from typing import Optional
import requests
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
ANTHROPIC_KEY = os.getenv('ANTHROPIC_API_KEY', '')
BRAVE_KEY = os.getenv('BRAVE_API_KEY', '')  # Optional — better results

EDGE_BASE = f"{SUPABASE_URL}/functions/v1"
HEADERS = {
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
}

# Seen trends cache — avoid reprocessing
seen_trends: set = set()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('cerebro.log'),
    ]
)
log = logging.getLogger('cerebro')


# ── Trend Detection Sources ───────────────────────────────────────────────────

def fetch_google_trends_realtime(geo='BR') -> list[dict]:
    """Fetch real-time trending searches from Google Trends."""
    trends = []
    try:
        url = f"https://trends.google.com/trends/api/realtimetrends?hl=pt-BR&tz=-180&cat=all&fi=0&fs=0&geo={geo}&ri=300&rs=20&sort=0"
        res = requests.get(url, headers={
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            'Referer': 'https://trends.google.com/',
        }, timeout=10)

        # Google prepends )]}',\n
        text = res.text.replace(")]}',\n", '').strip()
        data = json.loads(text)

        for story in data.get('storySummaries', {}).get('trendingStories', [])[:20]:
            for article in story.get('articles', [])[:1]:
                trends.append({
                    'term': story.get('title', ''),
                    'source': 'google_trends_realtime',
                    'geo': geo,
                    'traffic': story.get('entityNames', []),
                })
    except Exception as e:
        log.warning(f"Google Trends realtime error: {e}")

    return trends


def fetch_twitter_trending(geo='BR') -> list[dict]:
    """Fetch Twitter/X trending topics without API key via public endpoint."""
    trends = []
    try:
        # Use Nitter public instance for trending (no auth needed)
        nitter_instances = [
            'https://nitter.net',
            'https://nitter.cz',
            'https://nitter.privacydev.net',
        ]

        woeid_map = {'BR': '455189', 'MX': '116545', 'US': '23424977'}
        woeid = woeid_map.get(geo, '455189')

        for instance in nitter_instances:
            try:
                res = requests.get(f"{instance}/search?f=tweets&q=trending+brasil", timeout=8)
                if res.ok:
                    # Parse trending from HTML — look for hashtags
                    import re
                    hashtags = re.findall(r'#(\w+)', res.text)
                    counts: dict = {}
                    for h in hashtags:
                        if len(h) > 3:  # Skip short hashtags
                            counts[h] = counts.get(h, 0) + 1

                    for tag, count in sorted(counts.items(), key=lambda x: -x[1])[:15]:
                        if count > 2:
                            trends.append({
                                'term': f'#{tag}',
                                'source': 'twitter_nitter',
                                'geo': geo,
                                'count': count,
                            })
                    break
            except:
                continue

    except Exception as e:
        log.warning(f"Twitter trending error: {e}")

    return trends


def fetch_tiktok_trending(geo='BR') -> list[dict]:
    """Fetch TikTok trending hashtags."""
    trends = []
    try:
        # TikTok trending via unofficial scraping
        res = requests.get(
            'https://www.tiktok.com/api/explore/item_list/?aid=1988&count=10&type=1',
            headers={
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                'Referer': 'https://www.tiktok.com/',
            },
            timeout=10
        )
        if res.ok:
            data = res.json()
            for item in data.get('itemList', [])[:10]:
                challenges = item.get('challenges', [])
                for c in challenges[:2]:
                    if c.get('title'):
                        trends.append({
                            'term': c['title'],
                            'source': 'tiktok',
                            'geo': geo,
                            'view_count': c.get('stats', {}).get('viewCount', 0),
                        })
    except Exception as e:
        log.warning(f"TikTok trending error: {e}")

    return trends


# ── Trend Deduplication & Scoring ─────────────────────────────────────────────

def get_trend_id(trend: dict) -> str:
    """Stable ID for a trend to avoid reprocessing."""
    return hashlib.md5(f"{trend['term']}_{trend.get('geo', 'BR')}".lower().encode()).hexdigest()[:12]


def filter_new_trends(trends: list[dict]) -> list[dict]:
    """Remove trends we've already seen in this session."""
    new = []
    for t in trends:
        tid = get_trend_id(t)
        if tid not in seen_trends:
            seen_trends.add(tid)
            new.append(t)
    return new


def is_trend_already_researched(term: str) -> bool:
    """Check if trend-researcher already has this in Supabase."""
    try:
        cache_key = f"trend_research_{term.lower().replace(' ', '_')[:40]}"
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/learned_patterns",
            params={
                'pattern_key': f'eq.{cache_key}',
                'select': 'last_updated',
                'limit': 1,
            },
            headers={**HEADERS, 'apikey': SUPABASE_KEY},
            timeout=5,
        )
        if res.ok and res.json():
            row = res.json()[0]
            last = datetime.fromisoformat(row['last_updated'].replace('Z', '+00:00'))
            # Valid for 6 hours
            if datetime.now().astimezone() - last < timedelta(hours=6):
                return True
    except:
        pass
    return False


# ── Edge Function Callers ─────────────────────────────────────────────────────

def call_trend_researcher(term: str, geo: str = 'BR') -> Optional[dict]:
    """Call the trend-researcher edge function."""
    try:
        res = requests.post(
            f"{EDGE_BASE}/trend-researcher",
            json={'trend_term': term, 'geo': geo},
            headers=HEADERS,
            timeout=30,
        )
        if res.ok:
            return res.json()
        log.error(f"trend-researcher failed: {res.status_code} {res.text[:100]}")
    except Exception as e:
        log.error(f"trend-researcher error: {e}")
    return None


def call_trend_matcher(trend_research: dict) -> Optional[dict]:
    """Score this trend against all active accounts via Haiku."""
    try:
        # Get all active users with personas
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1/personas",
            params={'select': 'id,user_id,name,headline,result', 'limit': 50},
            headers={**HEADERS, 'apikey': SUPABASE_KEY},
            timeout=10,
        )
        if not res.ok:
            return None

        personas = res.json()
        if not personas:
            return None

        matches = []
        for persona in personas:
            score_result = score_trend_for_account(trend_research, persona)
            if score_result and score_result.get('score', 0) >= 7:
                matches.append({
                    'persona': persona,
                    'score': score_result['score'],
                    'angle': score_result.get('angle'),
                    'hook': score_result.get('hook'),
                    'why': score_result.get('why'),
                })

        return {'matches': matches} if matches else None
    except Exception as e:
        log.error(f"trend-matcher error: {e}")
    return None


def score_trend_for_account(research: dict, persona: dict) -> Optional[dict]:
    """Use Haiku to score trend fit for a specific account. ~$0.001 per call."""
    try:
        persona_result = persona.get('result') or {}
        if isinstance(persona_result, str):
            try:
                persona_result = json.loads(persona_result)
            except:
                persona_result = {}

        industry = persona.get('headline', '')
        market = persona_result.get('preferred_market', 'BR')
        pains = ', '.join(persona_result.get('pains', [])[:2])
        hook_angles = ', '.join(persona_result.get('hook_angles', [])[:3])

        prompt = f"""Trend/meme: "{research.get('term', '')}"
Estrutura do meme: {research.get('research', {}).get('template_structure', 'desconhecida')}
Tom: {research.get('research', {}).get('tone', 'desconhecido')}
Origem: {research.get('research', {}).get('real_origin', 'desconhecida')}

Conta: {persona.get('name', '')} | {industry} | Mercado: {market}
Dores do público: {pains}
Ângulos que funcionam: {hook_angles}

Score de 0-10: esse meme tem fit REAL para essa conta?
- 0-3: não tem fit nenhum, forçado seria vexatório
- 4-6: fit superficial, precisaria de muito esforço para funcionar
- 7-8: fit real com ângulo específico e claro
- 9-10: fit perfeito, a conta DEVE usar isso agora

Responda JSON:
{{"score": 8, "angle": "ângulo específico e ORIGINAL — não genérico", "hook": "texto exato do hook que funcionaria", "why": "por que esse ângulo funciona — baseado na estrutura do meme"}}

IMPORTANTE: Se score < 7, ainda retorne o JSON mas com angle e hook nulos."""

        res = requests.post(
            'https://api.anthropic.com/v1/messages',
            json={
                'model': 'claude-haiku-4-5-20251001',
                'max_tokens': 300,
                'messages': [{'role': 'user', 'content': prompt}],
            },
            headers={
                'x-api-key': ANTHROPIC_KEY,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            timeout=15,
        )

        if res.ok:
            text = res.json()['content'][0]['text'].replace('```json', '').replace('```', '').strip()
            return json.loads(text)

    except Exception as e:
        log.warning(f"Score error for {persona.get('name')}: {e}")
    return None


def deliver_brief(persona: dict, trend: str, match: dict):
    """Save brief to account_alerts + send Telegram if connected."""
    try:
        persona_result = persona.get('result') or {}
        if isinstance(persona_result, str):
            try:
                persona_result = json.loads(persona_result)
            except:
                persona_result = {}

        detail = (
            f"[Cerebro 24h] Trend '{trend}' tem fit {match['score']}/10 para esta conta.\n"
            f"Ângulo: {match.get('angle', '')}\n"
            f"Hook sugerido: {match.get('hook', '')}\n"
            f"Por quê: {match.get('why', '')}"
        )

        # Save as account_alert
        alert = {
            'user_id': persona['user_id'],
            'persona_id': persona['id'],
            'type': 'opportunity',
            'urgency': 'high' if match['score'] >= 9 else 'medium',
            'detail': detail[:500],
            'ad_name': f"Trend: {trend[:40]}",
            'campaign_name': None,
            'created_at': datetime.utcnow().isoformat(),
        }

        requests.post(
            f"{SUPABASE_URL}/rest/v1/account_alerts",
            json=alert,
            headers={**