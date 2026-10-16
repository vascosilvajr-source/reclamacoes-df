-- =====================================================================
-- E-mails aos operacionais e ao coordenador técnico (Dragon Force)
-- Colar tudo no Supabase → SQL Editor → Run. Pode correr-se mais de uma vez.
-- Não apaga nem altera dados existentes: só acrescenta uma tabela e funções.
-- =====================================================================

-- 1. Pedidos enviados às escolas (um por escola e por envio).
--    O código (token) é o que vai no link do e-mail: longo, aleatório e válido 10 dias.
create table if not exists public.pedidos_operacionais (
  token text primary key,
  escola text not null,
  emails jsonb not null default '[]'::jsonb,
  criado timestamptz not null default now(),
  expira timestamptz not null,
  itens jsonb not null default '{}'::jsonb,
  respostas jsonb not null default '{}'::jsonb,
  respondido_em timestamptz,
  ids_aplicados_em timestamptz
);
alter table public.pedidos_operacionais enable row level security;
-- Só quem entra na app (com conta) vê e atualiza os pedidos. O link do e-mail não dá acesso à tabela.
drop policy if exists "app autenticada vê pedidos" on public.pedidos_operacionais;
create policy "app autenticada vê pedidos" on public.pedidos_operacionais for select to authenticated using (true);
drop policy if exists "app autenticada atualiza pedidos" on public.pedidos_operacionais;
create policy "app autenticada atualiza pedidos" on public.pedidos_operacionais for update to authenticated using (true) with check (true);

-- 2. Ajudas internas (esquema privado, não exposto).
create or replace function privado.emails_validos(v jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(distinct lower(trim(e))), '[]'::jsonb)
    from jsonb_array_elements_text(case when jsonb_typeof(v) = 'array' then v when jsonb_typeof(v) = 'string' then jsonb_build_array(v) else '[]'::jsonb end) e
   where trim(e) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
$$;
create or replace function privado.epoca_atual() returns text language sql stable as $$
  select a || '/' || right((a + 1)::text, 2) from (
    select case when extract(month from d) >= 8 then extract(year from d)::int else extract(year from d)::int - 1 end a
      from (select (now() at time zone 'Europe/Lisbon')::date d) x) y
$$;

-- 3. Chamada de hora a hora pelo agente do Google. Só prepara envios à segunda-feira (a partir das 8h)
--    ou quando se carrega em "Enviar agora" na app. Devolve ao agente a lista de e-mails a enviar.
create or replace function public.op_preparar(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public','privado' as $$
declare
  v_opc jsonb; v_reg jsonb; v_exps jsonb; v_esp jsonb; v_vistos jsonb; v_env jsonb;
  v_agora timestamptz := now(); v_lx timestamp := now() at time zone 'Europe/Lisbon';
  v_hoje date := (now() at time zone 'Europe/Lisbon')::date;
  v_ep text := privado.epoca_atual();
  v_pedido text; v_ultimo text; v_forcado boolean; v_semanal boolean;
  e text; v_em jsonb; v_xp jsonb; v_tu jsonb; v_te jsonb; v_inc jsonb; v_tok text; v_turmasEsc jsonb;
  v_ops jsonb := '[]'::jsonb; v_coords jsonb := '[]'::jsonb; v_avisos jsonb; v_avisados text[] := '{}';
begin
  if p_token is null or p_token <> (select valor from privado.segredos where nome = 'radar_token') then
    raise exception 'token inválido';
  end if;
  select value into v_opc from app_storage where key = 'reclamacoes:opcoes';
  v_opc := coalesce(v_opc, '{}'::jsonb);
  select value into v_env from app_storage where key = 'reclamacoes:operacionais-envio' for update;
  v_env := coalesce(v_env, '{}'::jsonb);
  v_pedido := v_opc->'pedidoEnvioOperacionais'->>'em';
  v_ultimo := coalesce(v_env->>'ultimo', '');
  v_forcado := v_pedido is not null and v_pedido > v_ultimo;
  v_semanal := extract(isodow from v_lx) = 1 and extract(hour from v_lx) >= 8
               and (v_ultimo = '' or (v_ultimo::timestamptz at time zone 'Europe/Lisbon')::date < v_hoje);
  if not v_forcado and not v_semanal then return jsonb_build_object('enviar', false); end if;

  select value->v_ep into v_reg from app_storage where key = 'reclamacoes:alunos';
  select value into v_exps from app_storage where key = 'reclamacoes:experiencias';
  if v_exps is null or jsonb_typeof(v_exps) <> 'array' then v_exps := '[]'::jsonb; end if;
  select value into v_esp from app_storage where key = 'reclamacoes:espacos';
  if v_esp is null or jsonb_typeof(v_esp) <> 'array' then v_esp := '[]'::jsonb; end if;
  v_vistos := coalesce(v_opc->'planosNormalizacao'->'semAlunosVistos', '{}'::jsonb);
  v_avisos := coalesce(v_env->'avisosTurma', '{}'::jsonb);

  for e in select jsonb_array_elements_text(coalesce(v_opc->'schools', '[]'::jsonb)) loop
    -- ---- operacionais: experiências com 14+ dias por decidir e turmas do plano sem alunos ----
    v_em := privado.emails_validos(v_opc->'emailsOperacionais'->e);
    if jsonb_array_length(v_em) > 0 then
      select coalesce(jsonb_agg(jsonb_build_object('id', x->>'alunoId', 'data', x->>'data', 'turma', coalesce(x->>'turma','')) order by x->>'data'), '[]'::jsonb) into v_xp
        from jsonb_array_elements(v_exps) x
       where x->>'escola' = e and x->>'epoca' = v_ep and coalesce(x->>'alunoId','') <> ''
         and coalesce((x->>'manual')::boolean, false) = false
         and coalesce(x->>'resultado','pendente') <> 'sucesso'
         and coalesce((x->>'entraram')::int, 0) = 0
         and coalesce(x->>'data','') ~ '^\d{4}-\d{2}-\d{2}'
         and (x->>'data')::date <= v_hoje - 14 and (x->>'data')::date >= v_hoje - 70
         and not (coalesce(v_reg->'alunos','{}'::jsonb) ? (x->>'alunoId'));
      select coalesce(jsonb_agg(jsonb_build_object('turma', turma, 'horarios', horarios) order by turma), '[]'::jsonb) into v_tu from (
        select t.turma, jsonb_agg(distinct left(s->>'dia', 3) || ' ' || coalesce(s->>'hora','')) horarios
          from jsonb_array_elements(v_esp) s,
               lateral (select jsonb_array_elements_text(case when jsonb_typeof(s->'turmas') = 'array' and jsonb_array_length(s->'turmas') > 0 then s->'turmas' else jsonb_build_array(coalesce(s->>'turma','')) end) turma) t
         where s->>'escola' = e and t.turma <> ''
           and not (v_vistos ? (e || '|' || t.turma))
           and not exists (select 1 from jsonb_each(coalesce(v_reg->'alunos','{}'::jsonb)) a(id, al)
                            where al->>'escola' = e and al->>'turma' = t.turma and al->>'estado' = 'ativo')
         group by t.turma) q;
      if jsonb_array_length(v_xp) > 0 or jsonb_array_length(v_tu) > 0 then
        select coalesce(jsonb_agg(t order by t), '[]'::jsonb) into v_turmasEsc from (
          select distinct al->>'turma' t from jsonb_each(coalesce(v_reg->'alunos','{}'::jsonb)) a(id, al)
           where al->>'escola' = e and coalesce(al->>'turma','') <> '') q;
        v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        insert into pedidos_operacionais (token, escola, emails, expira, itens)
        values (v_tok, e, v_em, v_agora + interval '10 days',
                jsonb_build_object('epoca', v_ep, 'experiencias', v_xp, 'turmas', v_tu, 'turmasEscola', v_turmasEsc,
                                   'motivos', coalesce(v_opc->'motivosExperiencia', '["Técnico (treino ou treinador)","Horário","Preço","Distância ou transporte","Escolheu outro clube","Outra modalidade","Família sem resposta","Outro"]'::jsonb)));
        v_ops := v_ops || jsonb_build_array(jsonb_build_object('escola', e, 'emails', v_em, 'token', v_tok,
                   'experiencias', jsonb_array_length(v_xp), 'turmas', jsonb_array_length(v_tu)));
      end if;
    end if;

    -- ---- coordenador técnico: motivos técnicos e turmas com muitas experiências não convertidas ----
    v_em := privado.emails_validos(v_opc->'emailsCoordenadores'->e);
    if jsonb_array_length(v_em) > 0 then
      select coalesce(jsonb_agg(jsonb_build_object('id', x->>'alunoId', 'data', x->>'data', 'turma', coalesce(x->>'turma',''), 'motivo', x->>'motivo', 'nota', coalesce(x->>'nota',''))), '[]'::jsonb),
             coalesce(array_agg(x->>'id'), '{}')
        into v_te, v_avisados
        from jsonb_array_elements(v_exps) x
       where x->>'escola' = e and x->>'epoca' = v_ep and x->>'resultado' = 'insucesso'
         and coalesce(x->>'motivo','') ~* 't[eé]cnic' and not coalesce((x->>'coordAvisado')::boolean, false);
      -- 3 ou mais não convertidas e pelo menos metade das decididas nessa turma/equipa (avisa no máximo de 4 em 4 semanas)
      select coalesce(jsonb_agg(jsonb_build_object('turma', turma, 'nao', nao, 'decididas', dec) order by nao desc), '[]'::jsonb) into v_inc from (
        select x->>'turma' turma, count(*) filter (where x->>'resultado' = 'insucesso') nao, count(*) filter (where x->>'resultado' in ('sucesso','insucesso')) dec
          from jsonb_array_elements(v_exps) x
         where x->>'escola' = e and x->>'epoca' = v_ep and coalesce(x->>'turma','') <> ''
         group by 1) q
       where nao >= 3 and nao * 2 >= dec
         and coalesce(v_avisos->>(e || '|' || turma), '') < (v_hoje - 28)::text;
      if jsonb_array_length(v_te) > 0 or jsonb_array_length(v_inc) > 0 then
        v_coords := v_coords || jsonb_build_array(jsonb_build_object('escola', e, 'emails', v_em, 'tecnicos', v_te, 'turmas', v_inc));
        if coalesce(array_length(v_avisados, 1), 0) > 0 then
          update app_storage s set value = (
            select jsonb_agg(case when x->>'id' = any(v_avisados) then x || '{"coordAvisado": true}'::jsonb else x end order by o)
              from jsonb_array_elements(s.value) with ordinality t(x, o)), updated_at = now()
           where key = 'reclamacoes:experiencias';
          select value into v_exps from app_storage where key = 'reclamacoes:experiencias';
        end if;
        select v_avisos || coalesce(jsonb_object_agg(e || '|' || (i->>'turma'), v_hoje::text), '{}'::jsonb) into v_avisos from jsonb_array_elements(v_inc) i;
      end if;
    end if;
  end loop;

  v_env := v_env || jsonb_build_object('ultimo', to_char(v_agora at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'avisosTurma', v_avisos,
             'ultimoResumo', jsonb_build_object('em', to_char(v_agora at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'operacionais', jsonb_array_length(v_ops), 'coordenadores', jsonb_array_length(v_coords), 'forcado', v_forcado));
  insert into app_storage (key, value, updated_at) values ('reclamacoes:operacionais-envio', v_env, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('enviar', true, 'operacionais', v_ops, 'coordenadores', v_coords,
                            'responderPara', privado.emails_validos(v_opc->'emailResponderOperacionais'));
end $$;
revoke all on function public.op_preparar(text) from public;
grant execute on function public.op_preparar(text) to anon, authenticated;

-- 4. A janela do link: devolve só o pedido daquela escola (códigos, turmas e datas; nunca nomes).
create or replace function public.op_pedido(p_token text)
returns jsonb language sql security definer set search_path to 'public' as $$
  select jsonb_build_object('escola', p.escola, 'itens', p.itens, 'respostas', p.respostas, 'respondido_em', p.respondido_em,
    'expira', p.expira, 'expirado', p.expira < now())
  from pedidos_operacionais p where p.token = p_token and length(coalesce(p_token,'')) >= 32;
$$;
revoke all on function public.op_pedido(text) from public;
grant execute on function public.op_pedido(text) to anon, authenticated;

-- 5. Respostas da janela: as experiências entram logo na app (com motivo e turma);
--    os códigos dos alunos das turmas ficam guardados para confirmares na app.
create or replace function public.op_responder(p_token text, p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  p pedidos_operacionais; v_exp jsonb := '{}'::jsonb; v_ids jsonb := '{}'::jsonb; k text; r jsonb; v text;
  v_validos text[]; v_turmas text[];
begin
  select * into p from pedidos_operacionais where token = p_token and length(coalesce(p_token,'')) >= 32 for update;
  if p.token is null then raise exception 'pedido inexistente'; end if;
  if p.expira < now() then raise exception 'pedido expirado'; end if;
  select coalesce(array_agg(x->>'id'), '{}') into v_validos from jsonb_array_elements(coalesce(p.itens->'experiencias','[]'::jsonb)) x;
  select coalesce(array_agg(x->>'turma'), '{}') into v_turmas from jsonb_array_elements(coalesce(p.itens->'turmas','[]'::jsonb)) x;
  for k, r in select key, value from jsonb_each(coalesce(p_respostas->'experiencias','{}'::jsonb)) loop
    v := case when jsonb_typeof(r) = 'string' then r #>> '{}' else r->>'r' end;
    if k = any(v_validos) and v in ('sucesso','pendente','insucesso') then
      v_exp := v_exp || jsonb_build_object(k, jsonb_strip_nulls(jsonb_build_object('r', v,
        'motivo', case when v = 'insucesso' then nullif(left(coalesce(r->>'motivo',''), 80), '') end,
        'turma', nullif(left(coalesce(r->>'turma',''), 60), ''),
        'nota', nullif(left(coalesce(r->>'nota',''), 300), ''))));
    end if;
  end loop;
  for k in select key from jsonb_each(coalesce(p_respostas->'turmas','{}'::jsonb)) loop
    if k = any(v_turmas) then
      v_ids := v_ids || jsonb_build_object(k, (select coalesce(jsonb_agg(distinct trim(i)), '[]'::jsonb)
        from jsonb_array_elements_text(case when jsonb_typeof(p_respostas->'turmas'->k) = 'array' then p_respostas->'turmas'->k else '[]'::jsonb end) i
        where trim(i) ~ '^[0-9A-Za-z-]{1,20}$'));
    end if;
  end loop;
  if v_exp <> '{}'::jsonb then
    update app_storage s set value = (
      select jsonb_agg(case when x->>'escola' = p.escola and x->>'epoca' = p.itens->>'epoca' and v_exp ? (x->>'alunoId')
          then jsonb_strip_nulls(x || jsonb_build_object('resultado', v_exp->(x->>'alunoId')->>'r',
                 -- "Ainda a decorrer" não fecha a experiência: volta no e-mail da semana seguinte
                 'manual', (v_exp->(x->>'alunoId')->>'r') <> 'pendente', 'decididoPor', 'operacional',
                 'motivo', v_exp->(x->>'alunoId')->>'motivo', 'nota', v_exp->(x->>'alunoId')->>'nota',
                 'turma', coalesce(nullif(x->>'turma',''), v_exp->(x->>'alunoId')->>'turma')))
          else x end order by o)
        from jsonb_array_elements(s.value) with ordinality t(x, o)), updated_at = now()
     where key = 'reclamacoes:experiencias' and jsonb_typeof(value) = 'array';
    update app_storage s set value = jsonb_set(s.value, array[p.itens->>'epoca', 'experiencias'], (
      select coalesce(jsonb_object_agg(id, case when v_exp ? id then jsonb_strip_nulls(x || jsonb_build_object('resultado', v_exp->id->>'r', 'motivo', v_exp->id->>'motivo',
                 'turma', coalesce(nullif(x->>'turma',''), v_exp->id->>'turma'))) else x end), '{}'::jsonb)
        from jsonb_each(coalesce(s.value->(p.itens->>'epoca')->'experiencias', '{}'::jsonb)) e(id, x))), updated_at = now()
     where key = 'reclamacoes:alunos' and s.value ? (p.itens->>'epoca');
  end if;
  update pedidos_operacionais set respostas = jsonb_build_object(
      'experiencias', coalesce(respostas->'experiencias','{}'::jsonb) || v_exp,
      'turmas', coalesce(respostas->'turmas','{}'::jsonb) || v_ids,
      'nota', left(coalesce(p_respostas->>'nota', respostas->>'nota', ''), 1000)),
    respondido_em = now()
   where token = p.token;
  return jsonb_build_object('ok', true, 'experiencias', (select count(*) from jsonb_object_keys(v_exp)), 'turmas', (select count(*) from jsonb_object_keys(v_ids)));
end $$;
revoke all on function public.op_responder(text, jsonb) from public;
grant execute on function public.op_responder(text, jsonb) to anon, authenticated;
