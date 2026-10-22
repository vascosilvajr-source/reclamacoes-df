-- =====================================================================
-- E-mails aos operacionais, ao coordenador técnico e ao coordenador geral (Dragon Force)
-- + pedidos de avaliação de eficácia de reclamações
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
alter table public.pedidos_operacionais add column if not exists enviado_em timestamptz;
alter table public.pedidos_operacionais enable row level security;
-- Só quem entra na app (com conta) vê e atualiza os pedidos. O link do e-mail não dá acesso à tabela.
drop policy if exists "app autenticada vê pedidos" on public.pedidos_operacionais;
create policy "app autenticada vê pedidos" on public.pedidos_operacionais for select to authenticated using (true);
drop policy if exists "app autenticada atualiza pedidos" on public.pedidos_operacionais;
create policy "app autenticada atualiza pedidos" on public.pedidos_operacionais for update to authenticated using (true) with check (true);
-- A app (com conta) cria os pedidos de avaliação de eficácia; o agente envia-os na hora seguinte.
drop policy if exists "app autenticada cria pedidos" on public.pedidos_operacionais;
create policy "app autenticada cria pedidos" on public.pedidos_operacionais for insert to authenticated with check (true);

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

-- 2a. Página de uma reclamação para o coordenador (link sem login): descrição e contexto, nunca o nome de quem reclamou.
create or replace function privado.link_reclamacao(p_escola text, p_x jsonb) returns text language plpgsql as $$
declare v_tok text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  insert into pedidos_operacionais (token, escola, emails, expira, itens, enviado_em)
  values (v_tok, p_escola, '[]'::jsonb, now() + interval '30 days',
    jsonb_build_object('tipo', 'reclamacao', 'numero', p_x->>'entryNumber', 'tema', coalesce(p_x->>'tema', ''), 'categoria', coalesce(p_x->>'categoria', ''),
      'recebida', coalesce(p_x->>'receivedDate', ''), 'estado', case when p_x->>'status' = 'concluido' then 'concluída' else 'em aberto' end,
      'descricao', left(coalesce(p_x->>'description', ''), 4000), 'contexto', left(coalesce(p_x->>'context', ''), 4000)), now());
  return v_tok;
end $$;

-- 2c. Resumo das reclamações de origem técnica de uma escola na época: quantas, quantas em aberto
--     e os temas mais mencionados. Técnica = categoria "Técnico" ou um dos temas técnicos escolhidos na app.
create or replace function privado.resumo_tecnicas(p_rec jsonb, p_tem jsonb, p_escola text, p_desde date)
returns jsonb language sql stable as $$
  with t as (
    select x from jsonb_array_elements(coalesce(p_rec, '[]'::jsonb)) x
     where x->>'school' = p_escola
       and left(coalesce(x->>'receivedDate', ''), 10) >= p_desde::text
       and (coalesce(p_tem, '[]'::jsonb) ? coalesce(x->>'tema', '') or coalesce(x->>'categoria', '') ~* 't[eé]cnic')
  ), temas as (
    select coalesce(nullif(x->>'tema', ''), 'Sem tema') tema, count(*) n from t group by 1 order by 2 desc, 1 limit 3
  )
  select jsonb_build_object(
    'total', (select count(*) from t),
    'abertas', (select count(*) from t where x->>'status' <> 'concluido'),
    'temas', coalesce((select jsonb_agg(jsonb_build_object('tema', tema, 'n', n) order by n desc, tema) from temas), '[]'::jsonb))
$$;
create or replace function privado.inicio_epoca(p_hoje date) returns date language sql immutable as $$
  select make_date(case when extract(month from p_hoje) >= 8 then extract(year from p_hoje)::int else extract(year from p_hoje)::int - 1 end, 8, 1)
$$;

-- 2b. Resumo para o coordenador geral: escolas a precisar de atenção, escolas em destaque e reclamações
--     de temas técnicos (os temas escolhe-os o utilizador na app). Só números e textos curtos, nunca nomes.
create or replace function privado.resumo_geral(p_opc jsonb, p_reg jsonb, p_regp jsonb, p_hoje date)
returns jsonb language plpgsql as $$
declare
  e text; v_rec jsonb; v_tem jsonb := coalesce(p_opc->'temasTecnicos', '[]'::jsonb);
  v_ref date := (p_hoje - interval '1 year')::date;
  v_at int; v_ant int; v_des int; v_conv int; v_nao int; v_tecab int;
  v_var numeric; v_taxa numeric; v_cv numeric; v_tx jsonb;
  v_atencao jsonb := '[]'::jsonb; v_destaque jsonb := '[]'::jsonb; v_tecnicas jsonb := '[]'::jsonb;
  v_resumos jsonb := '[]'::jsonb; v_rt jsonb; v_ini date := privado.inicio_epoca(p_hoje);
  t_at int := 0; t_ant int := 0; t_des int := 0; t_conv int := 0; t_nao int := 0;
begin
  select value into v_rec from app_storage where key = 'reclamacoes:registo';
  if v_rec is null or jsonb_typeof(v_rec) <> 'array' then v_rec := '[]'::jsonb; end if;
  for e in select jsonb_array_elements_text(coalesce(p_opc->'schools', '[]'::jsonb)) loop
    select count(*) filter (where al->>'estado' = 'ativo'), count(*) filter (where al->>'estado' = 'desistiu')
      into v_at, v_des
      from jsonb_each(coalesce(p_reg->'alunos', '{}'::jsonb)) a(id, al) where al->>'escola' = e;
    -- mesmo dia da época passada: já tinha entrado e ainda não tinha saído
    select count(*) into v_ant
      from jsonb_each(coalesce(p_regp->'alunos', '{}'::jsonb)) a(id, al)
     where al->>'escola' = e
       and case when coalesce(al->>'entrada', '') ~ '^\d{4}-\d{2}-\d{2}' then left(al->>'entrada', 10) <= v_ref::text else false end
       and (al->>'estado' = 'ativo' or left(coalesce(al->>'saida', ''), 10) > v_ref::text);
    select count(*) filter (where x->>'resultado' = 'sucesso' or coalesce(p_reg->'alunos', '{}'::jsonb) ? ex.id),
           count(*) filter (where x->>'resultado' = 'insucesso' and not (coalesce(p_reg->'alunos', '{}'::jsonb) ? ex.id))
      into v_conv, v_nao
      from jsonb_each(coalesce(p_reg->'experiencias', '{}'::jsonb)) ex(id, x) where x->>'escola' = e;
    select count(*) filter (where x->>'status' <> 'concluido' and v_tem ? coalesce(x->>'tema', ''))
      into v_tecab
      from jsonb_array_elements(v_rec) x where x->>'school' = e;

    t_at := t_at + v_at; t_ant := t_ant + v_ant; t_des := t_des + v_des; t_conv := t_conv + v_conv; t_nao := t_nao + v_nao;

    if v_ant >= 20 then
      v_var := (v_at - v_ant)::numeric / v_ant * 100;
      -- diferenças pequenas não entram: pelo menos 10% e 10 alunos
      if v_var <= -10 and v_ant - v_at >= 10 then
        v_atencao := v_atencao || jsonb_build_array(jsonb_build_object('escola', e, 'texto', format('%s inscritos, %s%% abaixo do mesmo dia da época passada (%s)', v_at, replace(abs(round(v_var, 1))::text, '.', ','), v_ant)));
      elsif v_var >= 15 and v_at - v_ant >= 10 then
        v_destaque := v_destaque || jsonb_build_array(jsonb_build_object('escola', e, 'texto', format('%s inscritos, %s%% acima do mesmo dia da época passada (%s)', v_at, replace(round(v_var, 1)::text, '.', ','), v_ant)));
      end if;
    end if;
    if v_des >= 5 and v_at + v_des > 0 then
      v_taxa := v_des::numeric / (v_at + v_des) * 100;
      if v_taxa >= 15 then
        v_atencao := v_atencao || jsonb_build_array(jsonb_build_object('escola', e, 'texto', format('%s desistências, %s%% dos alunos da época', v_des, replace(round(v_taxa, 1)::text, '.', ','))));
      end if;
    end if;
    if v_conv + v_nao >= 5 then
      v_cv := v_conv::numeric / (v_conv + v_nao) * 100;
      if v_cv < 40 then
        v_atencao := v_atencao || jsonb_build_array(jsonb_build_object('escola', e, 'texto', format('só %s%% das experiências converteram (%s de %s decididas)', round(v_cv), v_conv, v_conv + v_nao)));
      elsif v_cv >= 70 then
        v_destaque := v_destaque || jsonb_build_array(jsonb_build_object('escola', e, 'texto', format('%s%% das experiências converteram (%s de %s decididas)', round(v_cv), v_conv, v_conv + v_nao)));
      end if;
    end if;
    if v_tecab > 0 then
      v_atencao := v_atencao || jsonb_build_array(jsonb_build_object('escola', e, 'texto', format('%s %s de tema técnico em aberto', v_tecab, case when v_tecab = 1 then 'reclamação' else 'reclamações' end)));
    end if;

    -- reclamações de temas técnicos ainda em aberto (as concluídas já não entram)
    select coalesce(jsonb_agg(jsonb_build_object('escola', e, 'numero', x->>'entryNumber', 'tema', x->>'tema', 'recebida', x->>'receivedDate',
             'estado', 'em aberto', 'token', privado.link_reclamacao(e, x)) order by x->>'receivedDate' desc), '[]'::jsonb)
      into v_tx
      from jsonb_array_elements(v_rec) x
     where x->>'school' = e and v_tem ? coalesce(x->>'tema', '') and x->>'status' <> 'concluido';
    v_tecnicas := v_tecnicas || v_tx;
    -- resumo da época: reclamações de origem técnica e temas mais mencionados
    v_rt := privado.resumo_tecnicas(v_rec, v_tem, e, v_ini);
    if (v_rt->>'total')::int > 0 then v_resumos := v_resumos || jsonb_build_array(jsonb_build_object('escola', e) || v_rt); end if;
  end loop;

  return jsonb_build_object(
    'rede', jsonb_build_object('inscritos', t_at, 'anterior', t_ant, 'desistencias', t_des,
        'convertidas', t_conv, 'naoConvertidas', t_nao),
    'atencao', v_atencao, 'destaque', v_destaque, 'tecnicas', v_tecnicas,
    'resumoTecnicas', coalesce((select jsonb_agg(r order by (r->>'total')::int desc, r->>'escola') from jsonb_array_elements(v_resumos) r), '[]'::jsonb),
    'temasTecnicos', v_tem);
end $$;

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
  v_prev text; v_regp jsonb; v_gem jsonb; v_geral jsonb;
  v_regs jsonb; v_rc jsonb; v_marc jsonb; v_recAv jsonb;
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
  v_recAv := coalesce(v_env->'reclamacoesAvisadas', '{}'::jsonb);
  select value into v_regs from app_storage where key = 'reclamacoes:registo';
  if v_regs is null or jsonb_typeof(v_regs) <> 'array' then v_regs := '[]'::jsonb; end if;

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
           -- "Ainda não há alunos": o operacional já respondeu nas últimas 4 semanas, não volta a perguntar
           and not exists (select 1 from pedidos_operacionais po
                            where po.escola = e and po.respondido_em > v_agora - interval '28 days'
                              and coalesce(po.respostas->'turmasVazias', '[]'::jsonb) ? t.turma)
         group by t.turma) q;
      if jsonb_array_length(v_xp) > 0 or jsonb_array_length(v_tu) > 0 then
        -- turmas e equipas da escola: as dos alunos e as do plano semanal (inclui equipas de competição, "Sub-…")
        select coalesce(jsonb_agg(t order by t), '[]'::jsonb) into v_turmasEsc from (
          select distinct al->>'turma' t from jsonb_each(coalesce(v_reg->'alunos','{}'::jsonb)) a(id, al)
           where al->>'escola' = e and coalesce(al->>'turma','') <> ''
          union
          select distinct pt.turma from jsonb_array_elements(v_esp) s,
                 lateral (select jsonb_array_elements_text(case when jsonb_typeof(s->'turmas') = 'array' and jsonb_array_length(s->'turmas') > 0 then s->'turmas' else jsonb_build_array(coalesce(s->>'turma','')) end) turma) pt
           where s->>'escola' = e and pt.turma <> '') q;
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
      -- reclamações de temas técnicos em aberto que ainda não foram enviadas, cada uma com link para a página (as concluídas não entram)
      with t as (
        select x from jsonb_array_elements(v_regs) x
         where x->>'school' = e and coalesce(v_opc->'temasTecnicos', '[]'::jsonb) ? coalesce(x->>'tema', '')
           and x->>'status' <> 'concluido'
           and not (v_recAv ? coalesce(x->>'id', ''))
      )
      select coalesce(jsonb_agg(jsonb_build_object('numero', x->>'entryNumber', 'tema', x->>'tema', 'recebida', x->>'receivedDate',
                      'estado', 'em aberto', 'token', privado.link_reclamacao(e, x))
                      order by x->>'receivedDate' desc), '[]'::jsonb),
             coalesce(jsonb_object_agg(x->>'id', v_hoje::text), '{}'::jsonb)
        into v_rc, v_marc from t;
      if jsonb_array_length(v_te) > 0 or jsonb_array_length(v_inc) > 0 or jsonb_array_length(v_rc) > 0 then
        v_recAv := v_recAv || v_marc;
        v_coords := v_coords || jsonb_build_array(jsonb_build_object('escola', e, 'emails', v_em, 'tecnicos', v_te, 'turmas', v_inc, 'reclamacoes', v_rc,
                      'resumoTecnicas', privado.resumo_tecnicas(v_regs, coalesce(v_opc->'temasTecnicos', '[]'::jsonb), e, privado.inicio_epoca(v_hoje))));
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

  -- ---- coordenador geral: escolas a precisar de atenção, escolas em destaque e reclamações técnicas ----
  v_gem := privado.emails_validos(v_opc->'emailsCoordenadorGeral');
  if jsonb_array_length(v_gem) > 0 then
    v_prev := (left(v_ep, 4)::int - 1)::text || '/' || right(left(v_ep, 4), 2);
    select value->v_prev into v_regp from app_storage where key = 'reclamacoes:alunos';
    v_geral := jsonb_build_object('emails', v_gem) || privado.resumo_geral(v_opc, v_reg, v_regp, v_hoje);
  end if;

  v_env := v_env || jsonb_build_object('ultimo', to_char(v_agora at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'avisosTurma', v_avisos, 'reclamacoesAvisadas', v_recAv,
             'ultimoResumo', jsonb_build_object('em', to_char(v_agora at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'operacionais', jsonb_array_length(v_ops), 'coordenadores', jsonb_array_length(v_coords),
                                                'geral', case when v_geral is null then 0 else 1 end, 'forcado', v_forcado));
  insert into app_storage (key, value, updated_at) values ('reclamacoes:operacionais-envio', v_env, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return jsonb_build_object('enviar', true, 'operacionais', v_ops, 'coordenadores', v_coords, 'geral', v_geral,
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
  v_validos text[]; v_turmas text[]; v_vaz jsonb; v_av text; v_nota text;
  v_novas jsonb := '[]'::jsonb; n jsonb; v_id text; v_dt text; v_tu text; v_r text; v_mo text; v_no text; v_ep text;
  v_hoje date := (now() at time zone 'Europe/Lisbon')::date;
begin
  select * into p from pedidos_operacionais where token = p_token and length(coalesce(p_token,'')) >= 32 for update;
  if p.token is null then raise exception 'pedido inexistente'; end if;
  if p.expira < now() then raise exception 'pedido expirado'; end if;
  if p.itens->>'tipo' = 'reclamacao' then raise exception 'pedido só de leitura'; end if;
  -- Avaliação da eficácia de uma reclamação (operacional ou coordenador da escola)
  if p.itens->>'tipo' = 'eficacia' then
    v_av := p_respostas->>'avaliacao';
    if v_av is null or v_av not in ('eficaz','parcial','ineficaz') then raise exception 'avaliação inválida'; end if;
    v_nota := left(trim(coalesce(p_respostas->>'nota','')), 600);
    update pedidos_operacionais set respostas = jsonb_build_object('avaliacao', v_av, 'nota', v_nota), respondido_em = now() where token = p.token;
    return jsonb_build_object('ok', true, 'avaliacao', v_av);
  end if;
  select coalesce(array_agg(x->>'id'), '{}') into v_validos from jsonb_array_elements(coalesce(p.itens->'experiencias','[]'::jsonb)) x;
  select coalesce(array_agg(x->>'turma'), '{}') into v_turmas from jsonb_array_elements(coalesce(p.itens->'turmas','[]'::jsonb)) x;
  for k, r in select key, value from jsonb_each(coalesce(p_respostas->'experiencias','{}'::jsonb)) loop
    v := case when jsonb_typeof(r) = 'string' then r #>> '{}' else r->>'r' end;
    if k = any(v_validos) and v in ('sucesso','pendente','insucesso') then
      -- motivo "Outro": o detalhe é obrigatório, é ele que diz qual foi o motivo
      if v = 'insucesso' and coalesce(r->>'motivo','') ~* '^outr' and trim(coalesce(r->>'nota','')) = '' then
        raise exception 'falta o detalhe do motivo';
      end if;
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
  -- turmas/equipas em que ainda não há alunos (só as que foram pedidas)
  select coalesce(jsonb_agg(distinct t), '[]'::jsonb) into v_vaz
    from jsonb_array_elements_text(case when jsonb_typeof(p_respostas->'turmasVazias') = 'array' then p_respostas->'turmasVazias' else '[]'::jsonb end) t
   where t = any(v_turmas);
  -- Experiências acrescentadas pelo operacional (ex.: equipas de competição, que não vêm no Excel)
  v_ep := p.itens->>'epoca';
  for n in select value from jsonb_array_elements(case when jsonb_typeof(p_respostas->'novas') = 'array' then p_respostas->'novas' else '[]'::jsonb end) limit 30 loop
    v_id := trim(coalesce(n->>'id', '')); v_dt := coalesce(n->>'data', ''); v_tu := left(trim(coalesce(n->>'turma', '')), 60); v_r := n->>'r';
    v_mo := nullif(left(trim(coalesce(n->>'motivo', '')), 80), ''); v_no := nullif(left(trim(coalesce(n->>'nota', '')), 300), '');
    if v_id !~ '^[0-9A-Za-z-]{1,20}$' then raise exception 'código inválido'; end if;
    if v_dt !~ '^\d{4}-\d{2}-\d{2}$' or v_dt::date > v_hoje or v_dt::date < v_hoje - 150 then raise exception 'data inválida'; end if;
    if v_r is null or v_r not in ('sucesso','pendente','insucesso') then raise exception 'resultado inválido'; end if;
    if v_tu = '' or not (coalesce(p.itens->'turmasEscola', '[]'::jsonb) ? v_tu) then raise exception 'turma inválida'; end if;
    if v_r = 'insucesso' and v_mo is null then raise exception 'falta o motivo'; end if;
    if v_r = 'insucesso' and v_mo ~* '^outr' and v_no is null then raise exception 'falta o detalhe do motivo'; end if;
    v_novas := v_novas || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('id', v_id, 'data', v_dt, 'turma', v_tu, 'r', v_r,
                 'motivo', case when v_r = 'insucesso' then v_mo end, 'nota', v_no)));
  end loop;
  if jsonb_array_length(v_novas) > 0 then
    -- as que já existem (mesmo atleta, época e escola) são atualizadas
    update app_storage s set value = (
      select coalesce(jsonb_agg(case when x->>'escola' = p.escola and x->>'epoca' = v_ep and exists (select 1 from jsonb_array_elements(v_novas) nn where nn->>'id' = x->>'alunoId')
          then jsonb_strip_nulls(x || (select jsonb_build_object('resultado', nn->>'r', 'manual', (nn->>'r') <> 'pendente', 'decididoPor', 'operacional',
                 'motivo', nn->>'motivo', 'nota', nn->>'nota', 'turma', coalesce(nullif(x->>'turma', ''), nn->>'turma'))
                 from jsonb_array_elements(v_novas) nn where nn->>'id' = x->>'alunoId' limit 1))
          else x end order by o), '[]'::jsonb)
        from jsonb_array_elements(s.value) with ordinality t(x, o)), updated_at = now()
     where key = 'reclamacoes:experiencias' and jsonb_typeof(value) = 'array';
    -- as que ainda não existem são acrescentadas
    update app_storage s set value = s.value || coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', 'x_' || v_ep || '_' || (nn->>'id'), 'alunoId', nn->>'id', 'epoca', v_ep, 'escola', p.escola,
               'turma', nn->>'turma', 'n', 1, 'data', nn->>'data', 'resultado', nn->>'r', 'manual', (nn->>'r') <> 'pendente', 'origem', 'operacional',
               'decididoPor', 'operacional', 'motivo', nn->>'motivo', 'nota', nn->>'nota', 'entraram', 0)))
        from jsonb_array_elements(v_novas) nn
       where not exists (select 1 from jsonb_array_elements(s.value) x where x->>'alunoId' = nn->>'id' and x->>'epoca' = v_ep and x->>'escola' = p.escola)), '[]'::jsonb), updated_at = now()
     where key = 'reclamacoes:experiencias' and jsonb_typeof(value) = 'array';
    -- e entram no registo da época, como as experiências registadas à mão
    update app_storage s set value = jsonb_set(s.value, array[v_ep, 'experiencias'], coalesce(s.value->v_ep->'experiencias', '{}'::jsonb) || (
      select coalesce(jsonb_object_agg(nn->>'id', jsonb_strip_nulls(jsonb_build_object('id', nn->>'id', 'escola', p.escola, 'data', nn->>'data', 'turma', nn->>'turma', 'resultado', nn->>'r', 'motivo', nn->>'motivo'))), '{}'::jsonb)
        from jsonb_array_elements(v_novas) nn where not (coalesce(s.value->v_ep->'experiencias', '{}'::jsonb) ? (nn->>'id')))), updated_at = now()
     where key = 'reclamacoes:alunos' and s.value ? v_ep;
  end if;
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
      -- uma turma marcada como "sem alunos" deixa de ter códigos pendentes
      'turmas', (coalesce(respostas->'turmas','{}'::jsonb) || v_ids) - coalesce((select array_agg(t) from jsonb_array_elements_text(v_vaz) t), '{}'::text[]),
      'turmasVazias', v_vaz,
      'novas', coalesce((select jsonb_agg(o) from jsonb_array_elements(coalesce(respostas->'novas', '[]'::jsonb)) o
                          where not exists (select 1 from jsonb_array_elements(v_novas) nn where nn->>'id' = o->>'id')), '[]'::jsonb) || v_novas,
      'nota', left(coalesce(p_respostas->>'nota', respostas->>'nota', ''), 1000)),
    respondido_em = now()
   where token = p.token;
  return jsonb_build_object('ok', true, 'experiencias', (select count(*) from jsonb_object_keys(v_exp)), 'turmas', (select count(*) from jsonb_object_keys(v_ids)), 'vazias', jsonb_array_length(v_vaz), 'novas', jsonb_array_length(v_novas));
end $$;
revoke all on function public.op_responder(text, jsonb) from public;
grant execute on function public.op_responder(text, jsonb) to anon, authenticated;

-- 6. Avaliação da eficácia de reclamações: o agente pede, de hora a hora, os pedidos criados pela app
--    que ainda não foram enviados (um por papel: operacional e coordenador) e marca-os como enviados.
create or replace function public.op_eficacia_pendentes(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public','privado' as $$
declare v_res jsonb; v_opc jsonb;
begin
  if p_token is null or p_token <> (select valor from privado.segredos where nome = 'radar_token') then
    raise exception 'token inválido';
  end if;
  select value into v_opc from app_storage where key = 'reclamacoes:opcoes';
  with p as (
    update pedidos_operacionais set enviado_em = now()
     where enviado_em is null and itens->>'tipo' = 'eficacia' and expira > now()
       and jsonb_array_length(privado.emails_validos(emails)) > 0
    returning token, escola, emails, itens)
  select coalesce(jsonb_agg(jsonb_build_object('token', token, 'escola', escola, 'emails', privado.emails_validos(emails),
           'papel', itens->>'papel', 'numero', itens->>'numero', 'tema', itens->>'tema', 'recebida', itens->>'recebida',
           'concluida', itens->>'concluida', 'resumo', itens->>'resumo')), '[]'::jsonb)
    into v_res from p;
  return jsonb_build_object('pedidos', v_res, 'responderPara', privado.emails_validos(coalesce(v_opc, '{}'::jsonb)->'emailResponderOperacionais'));
end $$;
revoke all on function public.op_eficacia_pendentes(text) from public;
grant execute on function public.op_eficacia_pendentes(text) to anon, authenticated;
