-- Remove o resumo para o NotebookLM (já não se usa). Idempotente: pode correr mais de uma vez.
-- Não toca em dados nem noutras funções.
drop function if exists public.nlm_resumo(text);
