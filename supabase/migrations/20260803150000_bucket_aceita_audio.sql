-- ═══════════════════════════════════════════════════════════════════════════
-- Bucket hub-images passa a aceitar áudio — 03/08/2026
--
-- CAUSA DO "erro na edge function" NA TELA DE LOCUÇÃO:
--
-- O bucket aceitava apenas image/png, image/jpeg, image/webp e video/mp4.
-- A locução sobe MP3 (audio/mpeg) e era rejeitada com 415 invalid_mime_type.
--
-- O código então caía no plano B — devolver o áudio inline em base64 — e ali
-- estourava a pilha: `String.fromCharCode(...new Uint8Array(buf))` espalha
-- cada byte como argumento, e um MP3 de 30 segundos tem ~480 mil bytes.
-- O resultado era "Maximum call stack size exceeded", que o usuário via como
-- um erro genérico da edge function.
--
-- Dois defeitos encadeados: a restrição do bucket e um fallback que só
-- funcionava para áudios minúsculos. Este arquivo corrige o primeiro; o
-- segundo foi corrigido em hub-voice-gen (conversão em blocos).
-- ═══════════════════════════════════════════════════════════════════════════

update storage.buckets
set
  allowed_mime_types = array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'video/mp4',
    -- Locução (Fish Audio devolve MP3; os demais cobrem transcrição e upload
    -- de referência de áudio pelo usuário).
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/m4a'
  ]
where id = 'hub-images';
