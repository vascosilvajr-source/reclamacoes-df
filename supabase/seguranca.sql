-- ======================================================================
-- Segurança da app (Auditoria e Gestão de Qualidade DF)
-- Colar no SQL Editor do Supabase e correr. Pode correr-se mais de uma vez.
--
-- O que faz:
-- 1. Só as contas da equipa (lista privado.equipa) leem e escrevem dados.
--    Até aqui bastava ter uma conta qualquer no Supabase. Se alguém
--    conseguisse criar uma conta, via os dados todos (incluindo de menores).
-- 2. Fecha permissões que não são usadas (apagar pedidos, mexer na fila de e-mails,
--    acesso direto do "anon" às tabelas dos pedidos e da fila).
-- 3. Fixa o search_path das funções internas (aviso do Supabase Advisor).
--
-- Na primeira vez, a lista da equipa fica com as contas que existem hoje.
-- Para juntar outra conta mais tarde (depois de a criar em Authentication → Users):
--   insert into privado.equipa (user_id, nota)
--   select id, 'Nome da pessoa' from auth.users where email = 'email@exemplo.pt'
--   on conflict do nothing;
-- Para tirar uma conta:
--   delete from privado.equipa where user_id = (select id from auth.users where email = 'email@exemplo.pt');
-- ======================================================================

create schema if not exists privado;

-- 1. Lista da equipa ---------------------------------------------------
create table if not exists privado.equipa (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nota text,
  criado timestamptz not null default now()
);
alter table privado.equipa enable row level security;

-- Só na primeira vez (lista vazia): entram as contas que já existem.
-- Correr outra vez mais tarde NÃO junta contas novas.
insert into privado.equipa (user_id, nota)
select id, 'conta existente em ' || to_char(now(), 'YYYY-MM-DD') from auth.users
where not exists (select 1 from privado.equipa)
on conflict do nothing;

create or replace function public.e_equipa()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from privado.equipa where user_id = auth.uid());
$$;
revoke all on function public.e_equipa() from public, anon;
grant execute on function public.e_equipa() to authenticated;

-- app_storage: dados da app (o keep-alive do anon fica como está)
drop policy if exists "Equipa le" on public.app_storage;
drop policy if exists "Equipa cria" on public.app_storage;
drop policy if exists "Equipa altera" on public.app_storage;
drop policy if exists "Equipa apaga" on public.app_storage;
-- políticas antigas do supabase-setup.sql, se ainda existirem (abriam tudo a toda a gente)
drop policy if exists "Permitir leitura publica" on public.app_storage;
drop policy if exists "Permitir escrita publica" on public.app_storage;
drop policy if exists "Permitir atualizacao publica" on public.app_storage;
create policy "Equipa le" on public.app_storage for select to authenticated using ((select public.e_equipa()));
create policy "Equipa cria" on public.app_storage for insert to authenticated with check ((select public.e_equipa()));
create policy "Equipa altera" on public.app_storage for update to authenticated using ((select public.e_equipa())) with check ((select public.e_equipa()));
create policy "Equipa apaga" on public.app_storage for delete to authenticated using ((select public.e_equipa()));

-- pedidos_operacionais e emails_fila (se já existirem)
do $$
begin
  if to_regclass('public.pedidos_operacionais') is not null then
    drop policy if exists "app autenticada vê pedidos" on public.pedidos_operacionais;
    drop policy if exists "app autenticada atualiza pedidos" on public.pedidos_operacionais;
    drop policy if exists "app autenticada cria pedidos" on public.pedidos_operacionais;
    create policy "app autenticada vê pedidos" on public.pedidos_operacionais for select to authenticated using ((select public.e_equipa()));
    create policy "app autenticada atualiza pedidos" on public.pedidos_operacionais for update to authenticated using ((select public.e_equipa())) with check ((select public.e_equipa()));
    create policy "app autenticada cria pedidos" on public.pedidos_operacionais for insert to authenticated with check ((select public.e_equipa()));
    revoke all on public.pedidos_operacionais from anon;
    revoke delete, truncate, references, trigger on public.pedidos_operacionais from authenticated;
  end if;
  if to_regclass('public.emails_fila') is not null then
    drop policy if exists "app autenticada vê fila" on public.emails_fila;
    create policy "app autenticada vê fila" on public.emails_fila for select to authenticated using ((select public.e_equipa()));
    revoke all on public.emails_fila from anon;
    -- a fila só muda pelas funções (o agente e a app usam RPCs)
    revoke insert, update, delete, truncate, references, trigger on public.emails_fila from authenticated;
  end if;
end $$;
revoke truncate, references, trigger on public.app_storage from anon, authenticated;

-- Documentos (bucket privado "documentos")
drop policy if exists "Equipa le documentos" on storage.objects;
drop policy if exists "Equipa cria documentos" on storage.objects;
drop policy if exists "Equipa altera documentos" on storage.objects;
drop policy if exists "Equipa apaga documentos" on storage.objects;
create policy "Equipa le documentos" on storage.objects for select to authenticated using (bucket_id = 'documentos' and (select public.e_equipa()));
create policy "Equipa cria documentos" on storage.objects for insert to authenticated with check (bucket_id = 'documentos' and (select public.e_equipa()));
create policy "Equipa altera documentos" on storage.objects for update to authenticated using (bucket_id = 'documentos' and (select public.e_equipa())) with check (bucket_id = 'documentos' and (select public.e_equipa()));
create policy "Equipa apaga documentos" on storage.objects for delete to authenticated using (bucket_id = 'documentos' and (select public.e_equipa()));
update storage.buckets set public = false where id = 'documentos';

-- Oportunidades do radar: só a equipa põe e-mails na fila
do $$
begin
  if to_regprocedure('public.op_enviar_oportunidade(jsonb, jsonb)') is not null then
    execute $f$
    create or replace function public.op_enviar_oportunidade(p_emails jsonb, p_dados jsonb)
    returns bigint language plpgsql security definer set search_path to 'public','privado' as $b$
    declare v_em jsonb := privado.emails_validos(p_emails); v_opc jsonb; v_id bigint;
    begin
      if not public.e_equipa() then raise exception 'sem permissão'; end if;
      if jsonb_array_length(v_em) = 0 then raise exception 'sem e-mails válidos'; end if;
      if jsonb_array_length(v_em) > 10 or length(p_dados::text) > 20000 then raise exception 'pedido demasiado grande'; end if;
      select value into v_opc from app_storage where key = 'reclamacoes:opcoes';
      insert into emails_fila (tipo, escola, emails, responder, dados)
      values ('oportunidade', null, v_em, privado.emails_validos(coalesce(v_opc, '{}'::jsonb)->'emailResponderOperacionais')->>0, coalesce(p_dados, '{}'::jsonb))
      returning id into v_id;
      return v_id;
    end $b$;
    $f$;
  end if;
end $$;

-- 3. search_path fixo nas funções internas (as que existirem) ------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'privado' and p.prokind = 'f'
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, privado', f.sig);
  end loop;
end $$;
revoke all on all functions in schema privado from public, anon, authenticated;

-- Confirmação: quem está na equipa
select u.email, e.nota, e.criado from privado.equipa e join auth.users u on u.id = e.user_id order by e.criado;
