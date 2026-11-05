-- =====================================================================
-- Formação e integração com quizz (Dragon Force)
-- Colar tudo no Supabase → SQL Editor → Run. Pode correr-se mais de uma vez.
-- Requer o supabase/seguranca.sql corrido antes (cria a lista da equipa e a função e_equipa).
-- Não apaga nem altera dados existentes: só acrescenta uma tabela e funções.
-- =====================================================================

-- 1. Um pedido de formação por pessoa e por módulo. O módulo (slides e perguntas, com as
--    respostas certas) fica guardado aqui, no servidor: o link só mostra as perguntas e só
--    revela a resposta certa e o "porquê" depois de a pessoa responder.
create table if not exists public.formacao_pedidos (
  token text primary key,
  colaborador_id text not null,
  iniciais text not null default '',
  modulo jsonb not null,
  criado timestamptz not null default now(),
  expira timestamptz not null,
  aberto_em timestamptz,
  respostas jsonb not null default '{}'::jsonb,
  resultado jsonb,
  concluido_em timestamptz,
  tentativas int not null default 0,
  historico jsonb not null default '[]'::jsonb,
  aplicado_em timestamptz
);
alter table public.formacao_pedidos enable row level security;
drop policy if exists "app autenticada vê formações" on public.formacao_pedidos;
create policy "app autenticada vê formações" on public.formacao_pedidos for select to authenticated using ((select public.e_equipa()));
drop policy if exists "app autenticada cria formações" on public.formacao_pedidos;
create policy "app autenticada cria formações" on public.formacao_pedidos for insert to authenticated with check ((select public.e_equipa()));
drop policy if exists "app autenticada atualiza formações" on public.formacao_pedidos;
create policy "app autenticada atualiza formações" on public.formacao_pedidos for update to authenticated using ((select public.e_equipa())) with check ((select public.e_equipa()));
drop policy if exists "app autenticada apaga formações" on public.formacao_pedidos;
create policy "app autenticada apaga formações" on public.formacao_pedidos for delete to authenticated using ((select public.e_equipa()));

-- 2. Ver o módulo (sem respostas certas). Link expirado ou inexistente não devolve conteúdo.
create or replace function public.fm_obter(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.formacao_pedidos;
  p jsonb;
  o int;
  fb jsonb := '{}'::jsonb;
begin
  select * into r from public.formacao_pedidos where token = p_token;
  if not found then return null; end if;
  if r.expira <= now() then return jsonb_build_object('expirado', true); end if;
  if r.aberto_em is null then
    update public.formacao_pedidos set aberto_em = now() where token = p_token;
  end if;
  for p in select x from jsonb_array_elements(r.modulo->'perguntas') x loop
    if r.respostas ? (p->>'id') then
      o := (r.respostas->>(p->>'id'))::int;
      fb := fb || jsonb_build_object(p->>'id', jsonb_build_object(
        'opcao', o,
        'certa', (p->>'certa')::int,
        'correto', o = (p->>'certa')::int,
        'porque', coalesce(p->>'porque', ''),
        'ref', coalesce(p->'ref', 'null'::jsonb)));
    end if;
  end loop;
  return jsonb_build_object(
    'expirado', false,
    'iniciais', r.iniciais,
    'tentativa', r.tentativas + 1,
    'resultado', r.resultado,
    'feedback', fb,
    'modulo', jsonb_build_object(
      'nome', r.modulo->>'nome',
      'notaMinima', coalesce((r.modulo->>'notaMinima')::int, 80),
      'slides', coalesce(r.modulo->'slides', '[]'::jsonb),
      'perguntas', (select coalesce(jsonb_agg(jsonb_build_object('id', t.x->>'id', 'enunciado', t.x->>'enunciado', 'opcoes', t.x->'opcoes') order by t.n), '[]'::jsonb)
                    from jsonb_array_elements(r.modulo->'perguntas') with ordinality as t(x, n))));
end $$;

-- 3. Responder a uma pergunta: guarda a resposta (não se muda depois) e devolve já se acertou,
--    qual era a certa e o "porquê" com o documento e o artigo.
create or replace function public.fm_responder(p_token text, p_pergunta text, p_opcao int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.formacao_pedidos;
  p jsonb;
  o int;
begin
  select * into r from public.formacao_pedidos where token = p_token for update;
  if not found or r.expira <= now() or r.concluido_em is not null then raise exception 'indisponível'; end if;
  select x into p from jsonb_array_elements(r.modulo->'perguntas') x where x->>'id' = p_pergunta limit 1;
  if p is null then raise exception 'pergunta inexistente'; end if;
  if r.respostas ? p_pergunta then
    o := (r.respostas->>p_pergunta)::int;
  else
    o := p_opcao;
    update public.formacao_pedidos set respostas = respostas || jsonb_build_object(p_pergunta, p_opcao) where token = p_token;
  end if;
  return jsonb_build_object(
    'opcao', o,
    'certa', (p->>'certa')::int,
    'correto', o = (p->>'certa')::int,
    'porque', coalesce(p->>'porque', ''),
    'ref', coalesce(p->'ref', 'null'::jsonb));
end $$;

-- 4. Fechar: a nota calcula-se aqui, no servidor, e só se todas as perguntas tiverem resposta.
create or replace function public.fm_concluir(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.formacao_pedidos;
  p jsonb;
  total int := 0;
  certas int := 0;
  nota int;
  res jsonb;
begin
  select * into r from public.formacao_pedidos where token = p_token for update;
  if not found or r.expira <= now() then raise exception 'indisponível'; end if;
  if r.concluido_em is not null then return r.resultado; end if;
  for p in select x from jsonb_array_elements(r.modulo->'perguntas') x loop
    total := total + 1;
    if not (r.respostas ? (p->>'id')) then raise exception 'faltam respostas'; end if;
    if (r.respostas->>(p->>'id'))::int = (p->>'certa')::int then certas := certas + 1; end if;
  end loop;
  nota := case when total = 0 then 100 else round(100.0 * certas / total) end;
  res := jsonb_build_object(
    'nota', nota,
    'certas', certas,
    'total', total,
    'passou', nota >= coalesce((r.modulo->>'notaMinima')::int, 80),
    'tentativa', r.tentativas + 1,
    'data', to_char(now() at time zone 'Europe/Lisbon', 'YYYY-MM-DD'));
  update public.formacao_pedidos set resultado = res, concluido_em = now() where token = p_token;
  return res;
end $$;

-- 5. Tentar outra vez (só depois de não passar). O resultado anterior fica no histórico.
create or replace function public.fm_repetir(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.formacao_pedidos;
begin
  select * into r from public.formacao_pedidos where token = p_token for update;
  if not found or r.expira <= now() or r.concluido_em is null or coalesce((r.resultado->>'passou')::boolean, false) then raise exception 'indisponível'; end if;
  update public.formacao_pedidos
    set historico = historico || jsonb_build_array(r.resultado), resultado = null, concluido_em = null, respostas = '{}'::jsonb, tentativas = tentativas + 1
    where token = p_token;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.fm_obter(text) from public;
revoke all on function public.fm_responder(text, text, int) from public;
revoke all on function public.fm_concluir(text) from public;
revoke all on function public.fm_repetir(text) from public;
grant execute on function public.fm_obter(text) to anon, authenticated;
grant execute on function public.fm_responder(text, text, int) to anon, authenticated;
grant execute on function public.fm_concluir(text) to anon, authenticated;
grant execute on function public.fm_repetir(text) to anon, authenticated;
