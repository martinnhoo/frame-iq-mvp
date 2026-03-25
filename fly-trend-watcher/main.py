#!/usr/bin/env python3
"""
AdBrief Cerebro — Fly.io 24h Trend Watcher
Detecta trends a cada 15min, pesquisa o que realmente são, faz match com contas.
Deploy: fly launch (região gru para BR) + fly secrets set SUPABASE_URL=... SUPABASE_KEY=...
"""
import os, time, json, hashlib, logging, requests
from datetime import datetime, timedelta

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']
EDGE_URL = f"{SUPABASE_URL}/functions/v1"
HEADERS = {'Authorization': f'Bearer {SUPABASE_KEY}', 'Content-Type': 'application/json'}
seen: set = set()

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger('cerebro')

def fetch_google_realtime(geo='BR'):
    try:
        url = f"https://trends.google.com/trends/api/realtimetrends?hl=pt-BR&tz=-180&cat=all&fi=0&fs=0&geo={geo}&ri=300&rs=20&sort=0"
        r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://trends.google.com/'}, timeout=10)
        data = json.loads(r.text.replace(")]}',\n", '').strip())
        return [{'term': s.get('title','').strip(), 'source': 'google_realtime', 'geo': geo}
                for s in data.get('storySummaries',{}).get('trendingStories',[])[:15]
                if s.get('title','').strip() and len(s.get('title','')) > 3]
    except Exception as e:
        log.warning(f"Google Trends: {e}")
        return []

def fetch_twitter_trending(geo='BR'):
    import re
    for host in ['https://nitter.privacydev.net', 'https://nitter.cz']:
        try:
            r = requests.get(f"{host}/search?f=tweets&q=trending+brasil", timeout=8, headers={'User-Agent': 'Mozilla/5.0'})
            if r.ok:
                counts = {}
                for t in re.findall(r'#(\w{3,})', r.text): counts[t] = counts.get(t,0) + 1
                results = [{'term': f'#{tag}', 'source': 'twitter', 'geo': geo}
                           for tag, cnt in sorted(counts.items(), key=lambda x: -x[1])[:10] if cnt >= 3]
                if results: return results
        except: continue
    return []

def all_trends(geo='BR'):
    trends = fetch_google_realtime(geo) + fetch_twitter_trending(geo)
    seen_terms, unique = set(), []
    for t in trends:
        k = t['term'].lower().strip()
        if k not in seen_terms:
            seen_terms.add(k)
            unique.append(t)
    return unique

def call_edge(fn, body, timeout=45):
    try:
        r = requests.post(f"{EDGE_URL}/{fn}", json=body, headers=HEADERS, timeout=timeout)
        return r.json() if r.ok else None
    except Exception as e:
        log.error(f"{fn}: {e}")
        return None

def is_fresh(term):
    try:
        key = f"trend_research_{term.lower().replace(' ','_')[:40]}"
        r = requests.get(f"{SUPABASE_URL}/rest/v1/learned_patterns",
            params={'pattern_key': f'eq.{key}', 'select': 'last_updated', 'limit': 1},
            headers={**HEADERS, 'apikey': SUPABASE_KEY}, timeout=5)
        if r.ok and r.json():
            ts = r.json()[0].get('last_updated','')
            return ts and (datetime.utcnow() - datetime.fromisoformat(ts.replace('Z',''))) < timedelta(hours=6)
    except: pass
    return False

def run_cycle():
    log.info("=== Cycle start ===")
    trends = all_trends('BR')
    new = [t for t in trends if hashlib.md5(t['term'].lower().encode()).hexdigest()[:10] not in seen]
    log.info(f"Trends: {len(trends)} total, {len(new)} new")

    for trend in new[:5]:
        term = trend['term']
        tid = hashlib.md5(term.lower().encode()).hexdigest()[:10]
        seen.add(tid)

        if is_fresh(term):
            log.info(f"[SKIP] '{term}' — fresh")
            continue

        log.info(f"[RESEARCH] '{term}'")
        research = call_edge('trend-researcher', {'trend_term': term, 'geo': 'BR'}, timeout=60)
        if not research or not research.get('ok'):
            continue

        status = research.get('research', {}).get('lifespan_status', '')
        if any(x in status for x in ['morto', 'caindo']):
            log.info(f"[SKIP] '{term}' — {status}")
            continue

        log.info(f"[MATCH] '{term}'")
        result = call_edge('trend-matcher', {
            'trend_term': term,
            'trend_research': research.get('research', {})
        }, timeout=90)

        if result:
            log.info(f"[DONE] '{term}' — {result.get('matches_found', 0)} matches")
        time.sleep(3)

def main():
    log.info("AdBrief Cerebro 24h — Fly.io")
    try: run_cycle()
    except Exception as e: log.error(f"Init: {e}")
    while True:
        time.sleep(15 * 60)
        try: run_cycle()
        except Exception as e: log.error(f"Cycle: {e}")

if __name__ == '__main__':
    main()
