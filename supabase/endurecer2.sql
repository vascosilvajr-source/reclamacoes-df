-- Endurecimento 2 (idempotente: pode correr mais do que uma vez). Cola tudo no SQL Editor e carrega em Run.
-- Não apaga nem altera dados.

-- 1. Verificação do token interno: "p_token <> (select ...)" dá NULL (e deixa passar) se o segredo faltar.
--    Troca por "is distinct from" em todas as funções que ainda usam a forma antiga (op_* e radar_*),
--    mantendo o resto do corpo, o SECURITY DEFINER, o search_path e as permissões.
do $$
declare f record;
begin
  for f in
    select p.oid, pg_get_functiondef(p.oid) def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'privado') and p.prokind = 'f'
       and pg_get_functiondef(p.oid) like '%p_token <> (select valor from privado.segredos%'
  loop
    execute replace(f.def, 'p_token <> (select valor from privado.segredos', 'p_token is distinct from (select valor from privado.segredos');
  end loop;
end $$;

-- 2. Links das reclamações para os coordenadores: reaproveita o link ainda válido (com pelo menos 7 dias)
--    da mesma reclamação em vez de criar um novo em cada envio. O conteúdo é atualizado.
create or replace function privado.link_reclamacao(p_escola text, p_x jsonb) returns text
language plpgsql set search_path = public, privado, pg_temp as $$
declare
  v_tok text;
  v_itens jsonb := jsonb_build_object('tipo', 'reclamacao', 'numero', p_x->>'entryNumber', 'tema', coalesce(p_x->>'tema', ''), 'categoria', coalesce(p_x->>'categoria', ''),
      'recebida', coalesce(p_x->>'receivedDate', ''), 'estado', case when p_x->>'status' = 'concluido' then 'concluída' else 'em aberto' end,
      'descricao', left(coalesce(p_x->>'description', ''), 4000), 'contexto', left(coalesce(p_x->>'context', ''), 4000));
begin
  if coalesce(p_x->>'entryNumber', '') <> '' then
    select token into v_tok from pedidos_operacionais
     where escola = p_escola and itens->>'tipo' = 'reclamacao' and itens->>'numero' = p_x->>'entryNumber'
       and expira > now() + interval '7 days'
     order by expira desc limit 1;
    if v_tok is not null then
      update pedidos_operacionais set itens = v_itens where token = v_tok;
      return v_tok;
    end if;
  end if;
  v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into pedidos_operacionais (token, escola, emails, expira, itens, enviado_em)
  values (v_tok, p_escola, '[]'::jsonb, now() + interval '30 days', v_itens, now());
  return v_tok;
end $$;

-- 3. app_storage: a versão (updated_at) é sempre a hora do servidor. A app só grava por cima da versão
--    que leu; se alguém gravou entretanto, avisa em vez de apagar as alterações dos outros.
create or replace function privado.app_storage_versao() returns trigger
language plpgsql set search_path = public, privado, pg_temp as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists app_storage_versao on public.app_storage;
create trigger app_storage_versao before insert or update on public.app_storage
  for each row execute function privado.app_storage_versao();
