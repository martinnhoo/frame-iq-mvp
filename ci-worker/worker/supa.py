"""
Cliente mínimo do Supabase (PostgREST + RPC) para o worker.

Por que não o supabase-py: o worker precisa de select, insert, update e rpc.
São quatro verbos HTTP. A biblioteca traz dezenas de dependências para uma
imagem Docker que já vai carregar ffmpeg, torch e whisper — e cada dependência
a mais é superfície de falha num container que precisa subir sozinho.

A service role ignora RLS. É o que permite escrever nas tabelas que o cliente
só pode ler. Ela nunca sai daqui.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any


class SupabaseError(RuntimeError):
    def __init__(self, message: str, status: int | None = None, detail: str = "") -> None:
        super().__init__(message)
        self.status = status
        self.detail = detail


class Supa:
    def __init__(self, url: str, service_role_key: str, *, timeout: int = 30, retries: int = 3) -> None:
        self.rest = f"{url.rstrip('/')}/rest/v1"
        self.key = service_role_key
        self.timeout = timeout
        self.retries = retries

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        h = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }
        h.update(extra or {})
        return h

    def _call(self, method: str, path: str, *, body: Any = None, prefer: str | None = None) -> Any:
        url = f"{self.rest}{path}"
        data = json.dumps(body).encode() if body is not None else None
        extra = {"Prefer": prefer} if prefer else None

        last: Exception | None = None
        for attempt in range(1, self.retries + 1):
            request = urllib.request.Request(url, data=data, method=method, headers=self._headers(extra))
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:  # noqa: S310
                    raw = response.read().decode("utf-8")
                    return json.loads(raw) if raw.strip() else None
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", "replace")[:400]
                # 4xx é erro nosso: repetir dá o mesmo resultado e só atrasa.
                if 400 <= exc.code < 500:
                    raise SupabaseError(f"{method} {path} → {exc.code}", exc.code, detail) from exc
                last = SupabaseError(f"{method} {path} → {exc.code}", exc.code, detail)
            except urllib.error.URLError as exc:
                last = SupabaseError(f"{method} {path} → rede: {exc.reason}")

            if attempt < self.retries:
                time.sleep(min(2 ** (attempt - 1), 8))

        raise last or SupabaseError(f"{method} {path} falhou sem erro identificado")

    # ── Verbos ──────────────────────────────────────────────────────────────

    def select(self, table: str, *, params: dict[str, str] | None = None) -> list[dict[str, Any]]:
        query = urllib.parse.urlencode(params or {}, safe="().,*")
        result = self._call("GET", f"/{table}?{query}" if query else f"/{table}")
        return result or []

    def insert(self, table: str, rows: dict | list[dict], *, upsert: bool = False,
               on_conflict: str | None = None, ignore_duplicates: bool = False) -> list[dict[str, Any]]:
        path = f"/{table}"
        if on_conflict:
            path += f"?on_conflict={urllib.parse.quote(on_conflict)}"
        prefer = ["return=representation"]
        if upsert:
            prefer.append("resolution=ignore-duplicates" if ignore_duplicates else "resolution=merge-duplicates")
        return self._call("POST", path, body=rows, prefer=",".join(prefer)) or []

    def update(self, table: str, patch: dict, *, match: dict[str, str]) -> list[dict[str, Any]]:
        query = urllib.parse.urlencode({k: v for k, v in match.items()}, safe="().,*")
        return self._call("PATCH", f"/{table}?{query}", body=patch, prefer="return=representation") or []

    def rpc(self, fn: str, args: dict[str, Any] | None = None) -> Any:
        return self._call("POST", f"/rpc/{fn}", body=args or {})

    # ── Atalhos do worker ───────────────────────────────────────────────────

    def claim_job(self, kind: str, worker_id: str, lease_seconds: int) -> dict[str, Any] | None:
        """
        Pega um job da fila de forma atômica. Devolve None quando não há nada.

        O SKIP LOCKED está do lado do Postgres (ci_claim_job). É o que permite
        N workers em paralelo sem dois pegarem o mesmo job.
        """
        rows = self.rpc("ci_claim_job", {
            "p_kind": kind, "p_worker_id": worker_id, "p_lease_secs": lease_seconds,
        })
        if not rows:
            return None
        return rows[0] if isinstance(rows, list) else rows

    def renew_lease(self, table: str, job_id: str, lease_seconds: int) -> None:
        """
        Estende o lease de um job longo. Sem isto, um vídeo que demora mais que
        o lease é devolvido à fila pelo reaper e processado duas vezes — pagando
        LLM duas vezes.

        O timestamp é calculado aqui, não em SQL: o PostgREST manda o valor como
        literal, então "now() + interval '900 seconds'" iria para o banco como
        texto e o UPDATE falharia. A diferença de relógio entre worker e banco
        é irrelevante na escala de minutos do lease.
        """
        expires = datetime.now(timezone.utc) + timedelta(seconds=int(lease_seconds))
        self.update(table, {
            "lease_expires_at": expires.isoformat(),
        }, match={"id": f"eq.{job_id}"})

    def log(self, **row: Any) -> None:
        try:
            self.insert("ci_job_events", {"level": "info", **row})
        except SupabaseError:
            pass  # log que falha não pode derrubar o job
