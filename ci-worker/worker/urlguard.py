"""
Proteção contra SSRF no downloader.

── Por que isto é crítico aqui especificamente ──────────────────────────────
O worker é o único processo que segura a SUPABASE_SERVICE_ROLE_KEY, que ignora
RLS. Ele baixa URLs que vieram da resposta de uma API externa — ou seja, dados
que não controlamos. Sem esta camada, uma URL como

    http://169.254.169.254/latest/meta-data/iam/security-credentials/

faria o worker buscar o metadata da própria máquina e gravar o resultado no
bucket. O mesmo vale para `http://10.0.0.5:5432`, `file:///etc/passwd`, ou
qualquer serviço interno que o container alcance.

Não é hipótese remota: o campo `video_url` vem do payload da SpreshApp, que por
sua vez vem da biblioteca pública da Meta. Basta um dos dois ser comprometido,
ou um bug de normalização, para virar requisição arbitrária a partir de dentro
da nossa rede.

── O que a validação precisa cobrir ─────────────────────────────────────────
Validar a string da URL não basta. `http://evil.com` pode resolver para
127.0.0.1 — é o ataque de DNS rebinding na forma mais simples. Por isso
resolvemos o nome e checamos os IPs, e revalidamos a cada redirecionamento:
um destino público pode responder 302 para um endereço interno.
"""
from __future__ import annotations

import ipaddress
import socket
import urllib.parse
from dataclasses import dataclass


class BlockedUrl(ValueError):
    """URL recusada. NUNCA vale retentar — é decisão de segurança, não falha."""


ALLOWED_SCHEMES = {"https", "http"}

# Tipos que aceitamos baixar. Content-Type sozinho não é confiável (o servidor
# escolhe o que declarar), mas serve para recusar cedo o que obviamente não é
# mídia — uma página de erro HTML, por exemplo.
ALLOWED_CONTENT_PREFIXES = ("video/", "image/", "application/octet-stream")

MAX_REDIRECTS = 3


@dataclass(frozen=True)
class UrlPolicy:
    """
    `allow_private` existe só para os testes, que sobem um servidor HTTP em
    127.0.0.1. Em produção fica False, e o padrão é False de propósito — se
    alguém esquecer de configurar, o comportamento seguro é o que vale.
    """
    allow_private: bool = False
    require_https: bool = True
    max_redirects: int = MAX_REDIRECTS


def _ip_is_forbidden(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> str | None:
    """Devolve o motivo do bloqueio, ou None se o IP é aceitável."""
    if ip.is_loopback:
        return "loopback (127.0.0.0/8, ::1)"
    if ip.is_private:
        return "rede privada (10/8, 172.16/12, 192.168/16, fc00::/7)"
    if ip.is_link_local:
        # 169.254.169.254 é o metadata service de AWS, GCP, Azure, Fly, DO.
        # É o alvo clássico de SSRF e cai nesta faixa.
        return "link-local (169.254/16 — inclui metadata de nuvem)"
    if ip.is_reserved:
        return "faixa reservada"
    if ip.is_multicast:
        return "multicast"
    if ip.is_unspecified:
        return "endereço não especificado (0.0.0.0, ::)"
    # IPv4 mapeado em IPv6 burla a checagem se não desempacotar:
    # ::ffff:127.0.0.1 não é is_loopback como IPv6.
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        return _ip_is_forbidden(ip.ipv4_mapped)
    return None


def resolve_and_check(host: str, policy: UrlPolicy) -> list[str]:
    """
    Resolve o host e valida TODOS os IPs devolvidos.

    Todos, e não só o primeiro: um nome pode responder com um IP público e um
    privado, e qual deles a conexão vai usar não é nossa escolha.
    """
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise BlockedUrl(f"não foi possível resolver o host '{host}': {exc}") from exc

    if not infos:
        raise BlockedUrl(f"host '{host}' não resolveu para nenhum endereço")

    addresses: list[str] = []
    for info in infos:
        raw = info[4][0]
        try:
            ip = ipaddress.ip_address(raw)
        except ValueError:
            raise BlockedUrl(f"endereço inválido para '{host}': {raw}") from None

        reason = _ip_is_forbidden(ip)
        if reason and not policy.allow_private:
            raise BlockedUrl(f"'{host}' resolve para {ip} — {reason}")
        addresses.append(str(ip))

    return addresses


def validate_url(url: str, policy: UrlPolicy | None = None) -> str:
    """
    Valida uma URL antes de qualquer conexão. Devolve a URL normalizada.
    Lança BlockedUrl com o motivo — que é registrado, para ficar claro que foi
    recusa de segurança e não erro de rede.
    """
    policy = policy or UrlPolicy()

    parsed = urllib.parse.urlparse(url)

    if parsed.scheme not in ALLOWED_SCHEMES:
        # file://, ftp://, gopher://, dict:// — todos já foram vetor de SSRF.
        raise BlockedUrl(f"esquema '{parsed.scheme or '(vazio)'}' não é permitido")

    if policy.require_https and parsed.scheme != "https":
        raise BlockedUrl("apenas https é aceito")

    if not parsed.hostname:
        raise BlockedUrl("URL sem host")

    # Credencial embutida (http://user:pass@host) costuma ser tentativa de
    # confundir parser, e não temos caso de uso legítimo para ela.
    if parsed.username or parsed.password:
        raise BlockedUrl("URL com credencial embutida não é permitida")

    # Porta arbitrária é como se alcança Redis (6379), Postgres (5432) ou
    # qualquer serviço interno que não fale HTTP mas responda a bytes. CDN de
    # mídia sempre serve em 80/443.
    #
    # `allow_private` libera junto porque é o modo de teste, onde o servidor
    # local sobe numa porta efêmera. Os dois relaxamentos andam juntos de
    # propósito: quem liga um, está declarando contexto confiável.
    if parsed.port is not None and parsed.port not in (80, 443) and not policy.allow_private:
        raise BlockedUrl(f"porta {parsed.port} não é permitida (só 80 e 443)")

    resolve_and_check(parsed.hostname, policy)
    return url


def validate_redirect(location: str, current_url: str, policy: UrlPolicy | None = None) -> str:
    """
    Valida cada salto de redirecionamento.

    Um destino público pode responder 302 apontando para 127.0.0.1 — validar só
    a URL inicial deixaria exatamente esse caminho aberto.
    """
    absolute = urllib.parse.urljoin(current_url, location)
    return validate_url(absolute, policy)


def content_type_allowed(content_type: str) -> bool:
    base = (content_type or "").split(";")[0].strip().lower()
    return any(base.startswith(prefix) for prefix in ALLOWED_CONTENT_PREFIXES)
