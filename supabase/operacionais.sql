-- =====================================================================
-- E-mails aos operacionais, ao coordenador técnico e ao coordenador geral (Dragon Force)
-- + pedidos de avaliação de eficácia de reclamações
-- Colar tudo no Supabase → SQL Editor → Run. Pode correr-se mais de uma vez.
-- Requer o supabase/seguranca.sql corrido antes (cria a lista da equipa e a função e_equipa).
-- Não apaga nem altera dados existentes: só acrescenta tabelas e funções.
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
-- Quando o link foi aberto pela primeira vez e quando saiu o lembrete (um só, no dia seguinte).
alter table public.pedidos_operacionais add column if not exists aberto_em timestamptz;
alter table public.pedidos_operacionais add column if not exists lembrete_em timestamptz;
-- Quando foi contactada (por telefone) a escola que não abriu o e-mail nem o lembrete (marcado na app).
alter table public.pedidos_operacionais add column if not exists contactado_em timestamptz;
-- Pedidos novos (validar = true): o que o operacional responde NÃO entra na app; fica na resposta até validares
-- no painel "Por validar" da app. 'validado' guarda, por item, o que foi aceite ou rejeitado.
-- Os pedidos que já existiam ficam como estavam (validar = false: já entraram na app).
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pedidos_operacionais' and column_name = 'validar') then
    alter table public.pedidos_operacionais add column validar boolean not null default false;
    alter table public.pedidos_operacionais alter column validar set default true;
  end if;
end $$;
alter table public.pedidos_operacionais add column if not exists validado jsonb not null default '{}'::jsonb;
alter table public.pedidos_operacionais enable row level security;
-- Só quem entra na app (com conta) vê e atualiza os pedidos. O link do e-mail não dá acesso à tabela.
drop policy if exists "app autenticada vê pedidos" on public.pedidos_operacionais;
create policy "app autenticada vê pedidos" on public.pedidos_operacionais for select to authenticated using ((select public.e_equipa()));
drop policy if exists "app autenticada atualiza pedidos" on public.pedidos_operacionais;
create policy "app autenticada atualiza pedidos" on public.pedidos_operacionais for update to authenticated using ((select public.e_equipa())) with check ((select public.e_equipa()));
-- A app (com conta) cria os pedidos de avaliação de eficácia; o agente envia-os na hora seguinte.
drop policy if exists "app autenticada cria pedidos" on public.pedidos_operacionais;
create policy "app autenticada cria pedidos" on public.pedidos_operacionais for insert to authenticated with check ((select public.e_equipa()));

-- 1b. Fila de e-mails: o Supabase prepara, o agente do Google envia e confirma cada um.
--     Um envio que falhe (ex.: limite diário do Gmail) fica na fila e volta a ser tentado.
create table if not exists public.emails_fila (
  id bigserial primary key,
  criado timestamptz not null default now(),
  tipo text not null,                 -- operacional | coordenador | geral | eficacia | oportunidade
  escola text,
  emails jsonb not null default '[]'::jsonb,
  responder text,
  dados jsonb not null default '{}'::jsonb,
  tentativas int not null default 0,
  proxima timestamptz not null default now(),
  reservado_em timestamptz,
  enviado_em timestamptz,
  erro text
);
alter table public.emails_fila enable row level security;
drop policy if exists "app autenticada vê fila" on public.emails_fila;
create policy "app autenticada vê fila" on public.emails_fila for select to authenticated using ((select public.e_equipa()));
create index if not exists emails_fila_pendentes on public.emails_fila (id) where enviado_em is null;

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

-- 2b'. Link do dashboard da rede (só leitura, 30 dias): guarda uma cópia do resumo que vai no e-mail.
create or replace function privado.link_painel(p_dados jsonb) returns text language plpgsql as $$
declare v_tok text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  insert into pedidos_operacionais (token, escola, emails, expira, itens, enviado_em)
  values (v_tok, 'Rede', '[]'::jsonb, now() + interval '30 days',
    jsonb_build_object('tipo', 'painel', 'gerado', to_char(now() at time zone 'Europe/Lisbon', 'YYYY-MM-DD'), 'dados', p_dados - 'emails'), now());
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
-- Escola aberta nesta época: não marcada como encerrada (desta época ou anterior) e com alunos registados.
create or replace function privado.escola_aberta(p_opc jsonb, p_reg jsonb, p_escola text, p_ep text)
returns boolean language sql immutable as $$
  select not (coalesce(p_opc->'estadoEscolas'->p_escola->>'encerrada', '') <> '' and (p_opc->'estadoEscolas'->p_escola->>'encerrada') <= p_ep)
     and (coalesce(p_reg->'alunos', '{}'::jsonb) = '{}'::jsonb
          or exists (select 1 from jsonb_each(p_reg->'alunos') a(id, al) where al->>'escola' = p_escola));
$$;

create or replace function privado.resumo_geral(p_opc jsonb, p_reg jsonb, p_regp jsonb, p_hoje date)
returns jsonb language plpgsql as $$
declare
  e text; v_rec jsonb; v_tem jsonb := coalesce(p_opc->'temasTecnicos', '[]'::jsonb);
  v_ref date := (p_hoje - interval '1 year')::date;
  v_at int; v_ant int; v_des int; v_conv int; v_nao int; v_tecab int;
  v_var numeric; v_taxa numeric; v_cv numeric; v_tx jsonb;
  v_atencao jsonb := '[]'::jsonb; v_destaque jsonb := '[]'::jsonb; v_tecnicas jsonb := '[]'::jsonb; v_abertas jsonb := '[]'::jsonb;
  v_resumos jsonb := '[]'::jsonb; v_desl jsonb := '[]'::jsonb; v_rt jsonb; v_ini date := privado.inicio_epoca(p_hoje);
  t_at int := 0; t_ant int := 0; t_des int := 0; t_conv int := 0; t_nao int := 0;
begin
  select value into v_rec from app_storage where key = 'reclamacoes:registo';
  if v_rec is null or jsonb_typeof(v_rec) <> 'array' then v_rec := '[]'::jsonb; end if;
  for e in select jsonb_array_elements_text(coalesce(p_opc->'schools', '[]'::jsonb)) loop
    if not privado.escola_aberta(p_opc, p_reg, e, privado.epoca_atual()) then continue; end if;
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
    if v_des > 0 then
      v_desl := v_desl || jsonb_build_array(jsonb_build_object('escola', e, 'n', v_des,
        'taxa', replace(round(v_des::numeric / nullif(v_at + v_des, 0) * 100, 1)::text, '.', ',')));
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

    -- todas as reclamações ainda não concluídas (de qualquer tema), com link para a descrição
    select coalesce(jsonb_agg(jsonb_build_object('escola', e, 'numero', x->>'entryNumber', 'tema', coalesce(nullif(x->>'tema', ''), x->>'categoria', ''),
             'recebida', x->>'receivedDate', 'prazo', left(coalesce(x->>'deadline', ''), 10), 'tecnica', v_tem ? coalesce(x->>'tema', ''),
             'estado', case when coalesce(x->>'deadline', '') ~ '^\d{4}-\d{2}-\d{2}' and left(x->>'deadline', 10)::date < p_hoje then 'atrasada'
                            when x->>'status' = 'em_andamento' then 'em andamento' else 'por iniciar' end,
             'token', privado.link_reclamacao(e, x)) order by x->>'receivedDate' desc), '[]'::jsonb)
      into v_tx
      from jsonb_array_elements(v_rec) x
     where x->>'school' = e and coalesce(x->>'status', '') <> 'concluido';
    v_abertas := v_abertas || v_tx;
    v_tecnicas := v_tecnicas || coalesce((select jsonb_agg(t) from jsonb_array_elements(v_tx) t where (t->>'tecnica')::boolean), '[]'::jsonb);
    -- resumo da época: reclamações de origem técnica e temas mais mencionados
    v_rt := privado.resumo_tecnicas(v_rec, v_tem, e, v_ini);
    if (v_rt->>'total')::int > 0 then v_resumos := v_resumos || jsonb_build_array(jsonb_build_object('escola', e) || v_rt); end if;
  end loop;

  return jsonb_build_object(
    'rede', jsonb_build_object('inscritos', t_at, 'anterior', t_ant, 'desistencias', t_des,
        'convertidas', t_conv, 'naoConvertidas', t_nao),
    'atencao', v_atencao, 'destaque', v_destaque, 'tecnicas', v_tecnicas,
    -- todas as reclamações em andamento (as atrasadas primeiro)
    'abertas', coalesce((select jsonb_agg(a order by case a->>'estado' when 'atrasada' then 0 when 'em andamento' then 1 else 2 end, a->>'recebida') from jsonb_array_elements(v_abertas) a), '[]'::jsonb),
    'desistencias', coalesce((select jsonb_agg(r order by (r->>'n')::int desc, r->>'escola') from (select r from jsonb_array_elements(v_desl) r order by (r->>'n')::int desc limit 5) q(r)), '[]'::jsonb),
    'resumoTecnicas', coalesce((select jsonb_agg(r order by (r->>'total')::int desc, r->>'escola') from jsonb_array_elements(v_resumos) r), '[]'::jsonb),
    'temasTecnicos', v_tem);
end $$;

-- 3. Chamada pelo agente do Google. Só prepara envios à terça-feira (a partir das 8h)
--    ou quando se carrega em "Enviar agora" na app. Devolve ao agente a lista de e-mails a enviar.
-- 3b. Lotação por turma (para o e-mail e para a janela do operacional) e alterações propostas por eles.
create or replace function privado.ordem_turma(t text) returns numeric language sql immutable as $$
  select case
    when lower(t) like 'raíz%' or lower(t) like 'raiz%' then 1
    when lower(t) like 'inicia%' then 2
    when lower(t) like 'básico%' or lower(t) like 'basico%' then 3
    when lower(t) like 'intermédio%' or lower(t) like 'intermedio%' then 4
    when lower(t) like 'avançado%' or lower(t) like 'avancado%' then 5
    when lower(t) like 'expert%' then 6
    when lower(t) ~ '^sub[\s-]*\d+' then 100 + (substring(lower(t) from '^sub[\s-]*(\d+)'))::numeric
    else 999 end $$;
create or replace function privado.lotacao_turma(p_opc jsonb, p_escola text, p_turma text) returns int language sql immutable as $$
  select coalesce(
    nullif(case when (p_opc->'capacidades'->>(p_escola || '|' || p_turma)) ~ '^\d+$' then (p_opc->'capacidades'->>(p_escola || '|' || p_turma))::int end, 0),
    case privado.ordem_turma(p_turma) when 1 then 8 when 2 then 10 when 3 then 12 when 4 then 14 when 5 then 16 when 6 then 18 end) $$;

create table if not exists public.alteracoes_turma (
  id bigserial primary key,
  criado timestamptz not null default now(),
  escola text not null,
  epoca text not null,
  aluno text not null,
  de text,
  para text not null,
  estado text not null default 'pendente',   -- pendente | aceite | rejeitada
  decidido_em timestamptz
);
create unique index if not exists alteracoes_turma_pendente on public.alteracoes_turma (escola, epoca, aluno) where estado = 'pendente';
alter table public.alteracoes_turma enable row level security;
drop policy if exists "app autenticada vê alterações" on public.alteracoes_turma;
create policy "app autenticada vê alterações" on public.alteracoes_turma for select to authenticated using ((select public.e_equipa()));
drop policy if exists "app autenticada decide alterações" on public.alteracoes_turma;
create policy "app autenticada decide alterações" on public.alteracoes_turma for update to authenticated using ((select public.e_equipa())) with check ((select public.e_equipa()));

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
  v_regs jsonb; v_rc jsonb; v_marc jsonb; v_recAv jsonb; v_lot jsonb; v_at jsonb; v_alvo jsonb; v_papeis jsonb; v_manual boolean; v_dest jsonb; v_dg boolean; v_da boolean; v_dd boolean; v_geral_ok boolean; v_preview boolean := false; v_para jsonb; v_prevj jsonb := '{}'::jsonb;
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
  -- Pedido de envio: para todas as escolas ou só para as indicadas (escolas). Os pedidos só para algumas escolas
  -- não gastam o envio semanal nem o "último envio" geral.
  v_forcado := v_pedido is not null and v_pedido > greatest(v_ultimo, coalesce(v_env->>'ultimoPedido', ''));
  v_alvo := case when v_forcado and jsonb_typeof(v_opc->'pedidoEnvioOperacionais'->'escolas') = 'array' and jsonb_array_length(v_opc->'pedidoEnvioOperacionais'->'escolas') > 0
                 then v_opc->'pedidoEnvioOperacionais'->'escolas' end;
  -- Quem recebe num pedido manual: operacional, coordenador (da escola indicada), geral, auditoria, direcao.
  -- Sem lista, o pedido vai a todos (ou só aos operacionais da escola, se houver escola indicada).
  v_papeis := case when v_forcado and jsonb_typeof(v_opc->'pedidoEnvioOperacionais'->'papeis') = 'array' and jsonb_array_length(v_opc->'pedidoEnvioOperacionais'->'papeis') > 0
                   then v_opc->'pedidoEnvioOperacionais'->'papeis'
                   when v_alvo is not null then '["operacional"]'::jsonb end;
  -- Vários destinatários num só pedido: destinos = [{"escola": "DF Alfa", "papel": "operacional"}, {"papel": "direcao"}, ...]
  v_dest := case when v_forcado and jsonb_typeof(v_opc->'pedidoEnvioOperacionais'->'destinos') = 'array' and jsonb_array_length(v_opc->'pedidoEnvioOperacionais'->'destinos') > 0
                 then v_opc->'pedidoEnvioOperacionais'->'destinos' end;
  if v_dest is not null then v_alvo := null; v_papeis := null; end if;
  v_manual := v_papeis is not null or v_dest is not null;
  v_dg := case when v_dest is not null then exists (select 1 from jsonb_array_elements(v_dest) d where d->>'papel' = 'geral') else v_papeis is null or v_papeis ? 'geral' end;
  v_da := case when v_dest is not null then exists (select 1 from jsonb_array_elements(v_dest) d where d->>'papel' = 'auditoria') else v_papeis is null or v_papeis ? 'auditoria' end;
  v_dd := case when v_dest is not null then exists (select 1 from jsonb_array_elements(v_dest) d where d->>'papel' = 'direcao') else v_papeis is null or v_papeis ? 'direcao' end;
  v_geral_ok := case when v_dest is not null then (v_dg or v_da or v_dd) else (v_papeis is null and v_alvo is null) or coalesce(v_papeis ?| array['geral','auditoria','direcao'], false) end;
  -- Pré-visualização: o e-mail real (mesmo conteúdo e ligações) sai só para quem pediu, sem marcar nada como enviado.
  v_para := privado.emails_validos(jsonb_build_array(coalesce(v_opc->'pedidoEnvioOperacionais'->>'para', '')));
  v_preview := v_forcado and v_manual and coalesce(v_opc->'pedidoEnvioOperacionais'->>'preview', '') = 'true' and jsonb_array_length(v_para) > 0;
  if v_preview then v_prevj := '{"preview": true}'::jsonb; end if;
  -- à terça-feira: à segunda atualizam-se os dados (mapa de acompanhamento) e o resumo ainda não está certo
  v_semanal := extract(isodow from v_lx) = 2 and extract(hour from v_lx) >= 8
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
    if not privado.escola_aberta(v_opc, v_reg, e, v_ep) then continue; end if;
    if v_alvo is not null and not (v_alvo ? e) then continue; end if;
    if v_dest is not null and not exists (select 1 from jsonb_array_elements(v_dest) d where d->>'escola' = e) then continue; end if;
    -- ---- operacionais: experiências com 14+ dias por decidir e turmas do plano sem alunos ----
    v_em := case when v_preview then v_para else privado.emails_validos(v_opc->'emailsOperacionais'->e) end;
    if jsonb_array_length(v_em) > 0 and (case when v_dest is not null then exists (select 1 from jsonb_array_elements(v_dest) d where d->>'escola' = e and d->>'papel' = 'operacional') else v_papeis is null or v_papeis ? 'operacional' end) then
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
      if jsonb_array_length(v_xp) > 0 or jsonb_array_length(v_tu) > 0 or v_manual then
        -- turmas e equipas da escola: as dos alunos e as do plano semanal (inclui equipas de competição, "Sub-…")
        select coalesce(jsonb_agg(t order by t), '[]'::jsonb) into v_turmasEsc from (
          select distinct al->>'turma' t from jsonb_each(coalesce(v_reg->'alunos','{}'::jsonb)) a(id, al)
           where al->>'escola' = e and coalesce(al->>'turma','') <> ''
          union
          select distinct pt.turma from jsonb_array_elements(v_esp) s,
                 lateral (select jsonb_array_elements_text(case when jsonb_typeof(s->'turmas') = 'array' and jsonb_array_length(s->'turmas') > 0 then s->'turmas' else jsonb_build_array(coalesce(s->>'turma','')) end) turma) pt
           where s->>'escola' = e and pt.turma <> '') q;
        select coalesce(jsonb_agg(jsonb_build_object('turma', t, 'alunos', n, 'cap', privado.lotacao_turma(v_opc, e, t)) order by privado.ordem_turma(t), t), '[]'::jsonb) into v_lot
          from (select tt.t, (select count(*) from jsonb_each(coalesce(v_reg->'alunos','{}'::jsonb)) a(id, al)
                               where al->>'escola' = e and al->>'turma' = tt.t and al->>'estado' = 'ativo') n
                  from jsonb_array_elements_text(v_turmasEsc) tt(t) where tt.t <> 'Sem turma') q;
        select coalesce(jsonb_object_agg(turma, ids), '{}'::jsonb) into v_at
          from (select al->>'turma' turma, jsonb_agg(a.id order by a.id) ids
                  from jsonb_each(coalesce(v_reg->'alunos','{}'::jsonb)) a(id, al)
                 where al->>'escola' = e and al->>'estado' = 'ativo' and coalesce(al->>'turma','') <> '' group by 1) q;
        v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
        insert into pedidos_operacionais (token, escola, emails, expira, itens)
        values (v_tok, e, v_em, v_agora + interval '10 days',
                v_prevj || jsonb_build_object('epoca', v_ep, 'experiencias', v_xp, 'turmas', v_tu, 'turmasEscola', v_turmasEsc, 'lotacao', v_lot, 'alunosTurmas', v_at,
                                   'motivos', coalesce(v_opc->'motivosExperiencia', '["Técnico (treino ou treinador)","Horário","Preço","Distância ou transporte","Escolheu outro clube","Outra modalidade","Família sem resposta","Outro"]'::jsonb)));
        v_ops := v_ops || jsonb_build_array(jsonb_build_object('escola', e, 'emails', v_em, 'token', v_tok,
                   'experiencias', jsonb_array_length(v_xp), 'turmas', jsonb_array_length(v_tu), 'lotacao', v_lot));
      end if;
    end if;

    -- ---- coordenador técnico: motivos técnicos e turmas com muitas experiências não convertidas ----
    v_em := case when v_preview then v_para else privado.emails_validos(v_opc->'emailsCoordenadores'->e) end;
    if jsonb_array_length(v_em) > 0 and (case when v_dest is not null then exists (select 1 from jsonb_array_elements(v_dest) d where d->>'escola' = e and d->>'papel' = 'coordenador') else v_papeis is null or v_papeis ? 'coordenador' end) then
      select coalesce(jsonb_agg(jsonb_build_object('id', x->>'alunoId', 'data', x->>'data', 'turma', coalesce(x->>'turma',''), 'motivo', x->>'motivo', 'nota', coalesce(x->>'nota',''))), '[]'::jsonb),
             coalesce(array_agg(x->>'id'), '{}')
        into v_te, v_avisados
        from jsonb_array_elements(v_exps) x
       where x->>'escola' = e and x->>'epoca' = v_ep and x->>'resultado' = 'insucesso'
         and coalesce(x->>'motivo','') ~* 't[eé]cnic' and (v_manual or not coalesce((x->>'coordAvisado')::boolean, false));
      -- 3 ou mais não convertidas e pelo menos metade das decididas nessa turma/equipa (avisa no máximo de 4 em 4 semanas)
      select coalesce(jsonb_agg(jsonb_build_object('turma', turma, 'nao', nao, 'decididas', dec) order by nao desc), '[]'::jsonb) into v_inc from (
        select x->>'turma' turma, count(*) filter (where x->>'resultado' = 'insucesso') nao, count(*) filter (where x->>'resultado' in ('sucesso','insucesso')) dec
          from jsonb_array_elements(v_exps) x
         where x->>'escola' = e and x->>'epoca' = v_ep and coalesce(x->>'turma','') <> ''
         group by 1) q
       where nao >= 3 and nao * 2 >= dec
         and (v_manual or coalesce(v_avisos->>(e || '|' || turma), '') < (v_hoje - 28)::text);
      -- reclamações de temas técnicos em aberto que ainda não foram enviadas, cada uma com link para a página (as concluídas não entram)
      with t as (
        select x from jsonb_array_elements(v_regs) x
         where x->>'school' = e and coalesce(v_opc->'temasTecnicos', '[]'::jsonb) ? coalesce(x->>'tema', '')
           and x->>'status' <> 'concluido'
           and (v_manual or not (v_recAv ? coalesce(x->>'id', '')))
      )
      select coalesce(jsonb_agg(jsonb_build_object('numero', x->>'entryNumber', 'tema', x->>'tema', 'recebida', x->>'receivedDate',
                      'estado', 'em aberto', 'token', privado.link_reclamacao(e, x))
                      order by x->>'receivedDate' desc), '[]'::jsonb),
             coalesce(jsonb_object_agg(x->>'id', v_hoje::text), '{}'::jsonb)
        into v_rc, v_marc from t;
      if jsonb_array_length(v_te) > 0 or jsonb_array_length(v_inc) > 0 or jsonb_array_length(v_rc) > 0 or v_manual then
        v_recAv := v_recAv || v_marc;
        v_coords := v_coords || jsonb_build_array(jsonb_build_object('escola', e, 'emails', v_em, 'tecnicos', v_te, 'turmas', v_inc, 'reclamacoes', v_rc,
                      'resumoTecnicas', privado.resumo_tecnicas(v_regs, coalesce(v_opc->'temasTecnicos', '[]'::jsonb), e, privado.inicio_epoca(v_hoje))));
        if coalesce(array_length(v_avisados, 1), 0) > 0 and not v_preview then
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

  -- ---- resumo da rede: coordenador geral, responsável de área da auditoria e direção executiva ----
  --      (escolas a precisar de atenção, escolas em destaque e todas as reclamações em andamento)
  v_gem := privado.emails_validos(
             case when v_dg then privado.emails_validos(v_opc->'emailsCoordenadorGeral') else '[]'::jsonb end
          || case when v_da then privado.emails_validos(v_opc->'emailsResponsavelAuditoria') else '[]'::jsonb end
          || case when v_dd then privado.emails_validos(v_opc->'emailsDirecaoExecutiva') else '[]'::jsonb end);
  if v_preview then v_gem := v_para; end if;
  if jsonb_array_length(v_gem) > 0 and v_geral_ok then
    v_prev := (left(v_ep, 4)::int - 1)::text || '/' || right(left(v_ep, 4), 2);
    select value->v_prev into v_regp from app_storage where key = 'reclamacoes:alunos';
    v_geral := jsonb_build_object('emails', v_gem) || privado.resumo_geral(v_opc, v_reg, v_regp, v_hoje);
    v_geral := v_geral || jsonb_build_object('painel', privado.link_painel(v_geral));
  end if;

  v_env := v_env || case when v_forcado then jsonb_build_object('ultimoPedido', v_pedido) else '{}'::jsonb end
             || case when v_manual then '{}'::jsonb else jsonb_build_object('ultimo', to_char(v_agora at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) end
             || case when v_preview then '{}'::jsonb else jsonb_build_object( 'avisosTurma', v_avisos, 'reclamacoesAvisadas', v_recAv,
             'ultimoResumo', jsonb_build_object('em', to_char(v_agora at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'operacionais', jsonb_array_length(v_ops), 'coordenadores', jsonb_array_length(v_coords),
                                                'geral', case when v_geral is null then 0 else 1 end, 'forcado', v_forcado)) end;
  insert into app_storage (key, value, updated_at) values ('reclamacoes:operacionais-envio', v_env, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  -- Tudo vai para a fila; o agente envia e confirma. As listas voltam vazias para um agente antigo não enviar em duplicado.
  insert into emails_fila (tipo, escola, emails, responder, dados)
  select 'operacional', o->>'escola', o->'emails', privado.emails_validos(v_opc->'emailResponderOperacionais')->>0, o || v_prevj from jsonb_array_elements(v_ops) o
  union all
  select 'coordenador', c->>'escola', c->'emails', privado.emails_validos(v_opc->'emailResponderOperacionais')->>0, c || v_prevj from jsonb_array_elements(v_coords) c
  union all
  select 'geral', null, v_geral->'emails', privado.emails_validos(v_opc->'emailResponderOperacionais')->>0, v_geral || v_prevj where v_geral is not null;
  return jsonb_build_object('enviar', true, 'fila', jsonb_array_length(v_ops) + jsonb_array_length(v_coords) + case when v_geral is null then 0 else 1 end,
                            'operacionais', '[]'::jsonb, 'coordenadores', '[]'::jsonb, 'geral', null,
                            'responderPara', privado.emails_validos(v_opc->'emailResponderOperacionais'));
end $$;
revoke all on function public.op_preparar(text) from public;
grant execute on function public.op_preparar(text) to anon, authenticated;

-- 4. A janela do link: devolve só o pedido daquela escola (códigos, turmas e datas; nunca nomes).
create or replace function public.op_pedido(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v jsonb;
begin
  if length(coalesce(p_token, '')) < 32 then return null; end if;
  -- Primeira abertura do link: deixa de precisar de lembrete.
  update pedidos_operacionais set aberto_em = now() where token = p_token and aberto_em is null;
  select jsonb_build_object('escola', p.escola, 'itens', p.itens, 'respostas', p.respostas, 'respondido_em', p.respondido_em,
    'expira', p.expira, 'expirado', p.expira < now(),
    'propostas', (select coalesce(jsonb_agg(jsonb_build_object('id', c.aluno, 'de', c.de, 'para', c.para) order by c.id), '[]'::jsonb)
                    from alteracoes_turma c where c.escola = p.escola and c.estado = 'pendente'))
    into v from pedidos_operacionais p where p.token = p_token;
  return v;
end $$;
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
  if p.itens->>'tipo' in ('reclamacao','painel') then raise exception 'pedido só de leitura'; end if;
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
        -- turma ou equipa onde o atleta ficou (só quando converteu e só das turmas da escola)
        'turmaFicou', case when v = 'sucesso' and coalesce(p.itens->'turmasEscola', '[]'::jsonb) ? coalesce(r->>'turmaFicou', '') then r->>'turmaFicou' end,
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
                 'motivo', case when v_r = 'insucesso' then v_mo end, 'nota', v_no,
                 'turmaFicou', case when v_r = 'sucesso' and coalesce(p.itens->'turmasEscola', '[]'::jsonb) ? coalesce(n->>'turmaFicou', '') then n->>'turmaFicou' end)));
  end loop;
  -- Pedidos novos: nada entra na app aqui. As respostas ficam no pedido e entram quando as validares (painel "Por validar").
  if jsonb_array_length(v_novas) > 0 and not p.validar then
    -- as que já existem (mesmo atleta, época e escola) são atualizadas
    update app_storage s set value = (
      select coalesce(jsonb_agg(case when x->>'escola' = p.escola and x->>'epoca' = v_ep and exists (select 1 from jsonb_array_elements(v_novas) nn where nn->>'id' = x->>'alunoId')
          then jsonb_strip_nulls(x || (select jsonb_build_object('resultado', nn->>'r', 'manual', (nn->>'r') <> 'pendente', 'decididoPor', 'operacional',
                 'motivo', nn->>'motivo', 'nota', nn->>'nota', 'turma', coalesce(nullif(x->>'turma', ''), nn->>'turma'),
                 'turmaFicou', case when nn->>'r' = 'sucesso' then coalesce(nn->>'turmaFicou', x->>'turmaFicou') end)
                 from jsonb_array_elements(v_novas) nn where nn->>'id' = x->>'alunoId' limit 1))
          else x end order by o), '[]'::jsonb)
        from jsonb_array_elements(s.value) with ordinality t(x, o)), updated_at = now()
     where key = 'reclamacoes:experiencias' and jsonb_typeof(value) = 'array';
    -- as que ainda não existem são acrescentadas
    update app_storage s set value = s.value || coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', 'x_' || v_ep || '_' || (nn->>'id'), 'alunoId', nn->>'id', 'epoca', v_ep, 'escola', p.escola,
               'turma', nn->>'turma', 'n', 1, 'data', nn->>'data', 'resultado', nn->>'r', 'manual', (nn->>'r') <> 'pendente', 'origem', 'operacional',
               'decididoPor', 'operacional', 'motivo', nn->>'motivo', 'nota', nn->>'nota', 'entraram', 0, 'turmaFicou', nn->>'turmaFicou')))
        from jsonb_array_elements(v_novas) nn
       where not exists (select 1 from jsonb_array_elements(s.value) x where x->>'alunoId' = nn->>'id' and x->>'epoca' = v_ep and x->>'escola' = p.escola)), '[]'::jsonb), updated_at = now()
     where key = 'reclamacoes:experiencias' and jsonb_typeof(value) = 'array';
    -- e entram no registo da época, como as experiências registadas à mão
    update app_storage s set value = jsonb_set(s.value, array[v_ep, 'experiencias'], coalesce(s.value->v_ep->'experiencias', '{}'::jsonb) || (
      select coalesce(jsonb_object_agg(nn->>'id', jsonb_strip_nulls(jsonb_build_object('id', nn->>'id', 'escola', p.escola, 'data', nn->>'data', 'turma', nn->>'turma', 'resultado', nn->>'r', 'motivo', nn->>'motivo'))), '{}'::jsonb)
        from jsonb_array_elements(v_novas) nn where not (coalesce(s.value->v_ep->'experiencias', '{}'::jsonb) ? (nn->>'id')))), updated_at = now()
     where key = 'reclamacoes:alunos' and s.value ? v_ep;
  end if;
  if v_exp <> '{}'::jsonb and not p.validar then
    update app_storage s set value = (
      select jsonb_agg(case when x->>'escola' = p.escola and x->>'epoca' = p.itens->>'epoca' and v_exp ? (x->>'alunoId')
          then jsonb_strip_nulls(x || jsonb_build_object('resultado', v_exp->(x->>'alunoId')->>'r',
                 -- "Ainda a decorrer" não fecha a experiência: volta no e-mail da semana seguinte
                 'manual', (v_exp->(x->>'alunoId')->>'r') <> 'pendente', 'decididoPor', 'operacional',
                 'motivo', v_exp->(x->>'alunoId')->>'motivo', 'nota', v_exp->(x->>'alunoId')->>'nota',
                 'turma', coalesce(nullif(x->>'turma',''), v_exp->(x->>'alunoId')->>'turma'),
                 'turmaFicou', case when v_exp->(x->>'alunoId')->>'r' = 'sucesso' then coalesce(v_exp->(x->>'alunoId')->>'turmaFicou', x->>'turmaFicou') end))
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

-- 5a. Pré-visualização dentro da app: gera os e-mails de verdade (mesmos dados) e desfaz tudo no fim, por isso não fica
--     nada gravado nem enviado. p_papel: operacional | coordenador | geral | auditoria | direcao; p_escola só nos dois primeiros.
create or replace function public.op_previa(p_escola text, p_papel text)
returns jsonb language plpgsql security definer set search_path to 'public','privado' as $$
declare v_max bigint; v_tok text; v_res jsonb; v_det text;
begin
  if not (select public.e_equipa()) then raise exception 'sem acesso'; end if;
  if p_papel not in ('operacional','coordenador','geral','auditoria','direcao') then raise exception 'destinatário inválido'; end if;
  begin
    select coalesce(max(id), 0) into v_max from emails_fila;
    select valor into v_tok from privado.segredos where nome = 'radar_token';
    update app_storage set value = jsonb_set(coalesce(value, '{}'::jsonb), '{pedidoEnvioOperacionais}',
        jsonb_strip_nulls(jsonb_build_object('em', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'papeis', jsonb_build_array(p_papel),
          'escolas', case when coalesce(p_escola, '') = '' then null else jsonb_build_array(p_escola) end)), true)
     where key = 'reclamacoes:opcoes';
    perform op_preparar(v_tok);
    select coalesce(jsonb_agg(jsonb_build_object('tipo', tipo, 'escola', escola, 'emails', emails, 'dados', dados) order by id), '[]'::jsonb) into v_res
      from emails_fila where id > v_max;
    raise exception 'previa' using errcode = 'PX001', detail = v_res::text;
  exception when sqlstate 'PX001' then
    get stacked diagnostics v_det = pg_exception_detail;
    return v_det::jsonb;
  end;
end $$;
revoke all on function public.op_previa(text, text) from public;
grant execute on function public.op_previa(text, text) to authenticated;

-- 5b. Alterações de turma propostas pelo operacional: ficam sempre pendentes até validares na app.
--     p_alt = [{"id": "22534", "para": "Iniciação A"}, ...]. Só turmas da escola e códigos que existem na época.
create or replace function public.op_propor_alteracoes(p_token text, p_alt jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  p pedidos_operacionais; x jsonb; v_id text; v_para text; v_ep text; v_de text; v_al jsonb; v_n int := 0; v_inv int := 0;
begin
  select * into p from pedidos_operacionais where token = p_token and length(coalesce(p_token,'')) >= 32;
  if p.token is null then raise exception 'pedido inexistente'; end if;
  if p.expira < now() then raise exception 'pedido expirado'; end if;
  if p.itens ? 'tipo' then raise exception 'pedido sem turmas'; end if;
  if jsonb_typeof(p_alt) <> 'array' then raise exception 'formato inválido'; end if;
  v_ep := p.itens->>'epoca';
  select value->v_ep->'alunos' into v_al from app_storage where key = 'reclamacoes:alunos';
  for x in select value from jsonb_array_elements(p_alt) limit 80 loop
    v_id := trim(coalesce(x->>'id', '')); v_para := trim(coalesce(x->>'para', ''));
    if v_id !~ '^[0-9A-Za-z-]{1,20}$' or not (coalesce(p.itens->'turmasEscola', '[]'::jsonb) ? v_para) or not (coalesce(v_al, '{}'::jsonb) ? v_id) then
      v_inv := v_inv + 1; continue;
    end if;
    v_de := v_al->v_id->>'turma';
    if v_de = v_para and v_al->v_id->>'escola' = p.escola then continue; end if;
    delete from alteracoes_turma where escola = p.escola and epoca = v_ep and aluno = v_id and estado = 'pendente';
    insert into alteracoes_turma (escola, epoca, aluno, de, para) values (p.escola, v_ep, v_id, v_de, v_para);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'propostas', v_n, 'invalidas', v_inv);
end $$;
revoke all on function public.op_propor_alteracoes(text, jsonb) from public;
grant execute on function public.op_propor_alteracoes(text, jsonb) to anon, authenticated;

-- 6. Avaliação da eficácia de reclamações: o agente pede, de hora a hora, os pedidos criados pela app
--    que ainda não foram enviados (um por papel: operacional e coordenador) e marca-os como enviados.
create or replace function public.op_eficacia_pendentes(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public','privado' as $$
declare v_res jsonb; v_opc jsonb; v_n int;
begin
  if p_token is null or p_token <> (select valor from privado.segredos where nome = 'radar_token') then
    raise exception 'token inválido';
  end if;
  select value into v_opc from app_storage where key = 'reclamacoes:opcoes';
  -- Os pedidos passam para a fila de e-mails (o agente envia e confirma); a lista volta vazia.
  with p as (
    update pedidos_operacionais set enviado_em = now()
     where enviado_em is null and itens->>'tipo' = 'eficacia' and expira > now()
       and jsonb_array_length(privado.emails_validos(emails)) > 0
    returning token, escola, emails, itens)
  insert into emails_fila (tipo, escola, emails, responder, dados)
  select 'eficacia', escola, privado.emails_validos(emails), privado.emails_validos(coalesce(v_opc, '{}'::jsonb)->'emailResponderOperacionais')->>0,
         jsonb_build_object('token', token, 'escola', escola, 'papel', itens->>'papel', 'numero', itens->>'numero', 'tema', itens->>'tema',
           'recebida', itens->>'recebida', 'concluida', itens->>'concluida', 'resumo', itens->>'resumo')
    from p;
  get diagnostics v_n = row_count;
  return jsonb_build_object('pedidos', '[]'::jsonb, 'fila', v_n, 'responderPara', privado.emails_validos(coalesce(v_opc, '{}'::jsonb)->'emailResponderOperacionais'));
end $$;
revoke all on function public.op_eficacia_pendentes(text) from public;
grant execute on function public.op_eficacia_pendentes(text) to anon, authenticated;


-- 6b. Lembretes: e-mails com link (operacionais e avaliação de eficácia) enviados há mais de 24 horas
--     cujo link ainda não foi aberto nem respondido recebem UM lembrete, em dia útil entre as 8h e as 19h.
--     O e-mail genérico continua a sair só à terça-feira.
create or replace function privado.enfileirar_lembretes() returns int language plpgsql as $$
declare v_lx timestamp := now() at time zone 'Europe/Lisbon'; v_n int;
begin
  if extract(isodow from v_lx) > 5 or extract(hour from v_lx) < 8 or extract(hour from v_lx) >= 19 then return 0; end if;
  with alvo as (
    select distinct on (p.token) f.tipo, f.escola, f.emails, f.responder, f.dados, p.token
      from emails_fila f
      join pedidos_operacionais p on p.token = f.dados->>'token'
     where f.tipo in ('operacional', 'eficacia')
       and f.enviado_em is not null
       and f.enviado_em < now() - interval '24 hours'
       and f.enviado_em > now() - interval '7 days'
       and coalesce((f.dados->>'lembrete')::boolean, false) = false
       and coalesce((f.dados->>'preview')::boolean, false) = false
       and p.aberto_em is null and p.respondido_em is null and p.lembrete_em is null and p.expira > now()
     order by p.token, f.id
  ), marca as (
    update pedidos_operacionais p set lembrete_em = now() from alvo a where p.token = a.token returning p.token
  )
  insert into emails_fila (tipo, escola, emails, responder, dados)
  select a.tipo, a.escola, a.emails, a.responder, a.dados || '{"lembrete": true}'::jsonb from alvo a join marca m on m.token = a.token;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- 7. Fila de e-mails: o agente pede os próximos (até p_max), envia-os e confirma um a um.
--    Cada pedido fica reservado 20 minutos; se não for confirmado, volta a estar disponível.
create or replace function public.op_fila_proximos(p_token text, p_max int default 40)
returns jsonb language plpgsql security definer set search_path to 'public','privado' as $$
declare v_res jsonb;
begin
  if p_token is null or p_token <> (select valor from privado.segredos where nome = 'radar_token') then
    raise exception 'token inválido';
  end if;
  perform privado.enfileirar_lembretes();
  with c as (
    select id from emails_fila
     where enviado_em is null and tentativas < 6 and proxima <= now()
       and (reservado_em is null or reservado_em < now() - interval '20 minutes')
     order by id limit greatest(1, least(coalesce(p_max, 40), 100))
     for update skip locked),
  u as (update emails_fila f set reservado_em = now() from c where f.id = c.id
        returning f.id, f.tipo, f.escola, f.emails, f.responder, f.dados, f.tentativas)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'escola', escola, 'emails', emails, 'responder', responder,
           'dados', dados, 'tentativas', tentativas) order by id), '[]'::jsonb) into v_res from u;
  return jsonb_build_object('itens', v_res,
    'pendentes', (select count(*) from emails_fila where enviado_em is null and tentativas < 6),
    'desistidos', (select count(*) from emails_fila where enviado_em is null and tentativas >= 6 and criado > now() - interval '14 days'));
end $$;
revoke all on function public.op_fila_proximos(text, int) from public;
grant execute on function public.op_fila_proximos(text, int) to anon, authenticated;

-- p_ok = true: enviado. p_ok = false: volta a tentar mais tarde (30 min, 1 h, 1h30…), até 6 tentativas.
-- p_adiar = true: não falhou, só não havia quota; volta a tentar daqui a 1 hora sem contar como tentativa.
create or replace function public.op_fila_confirmar(p_token text, p_id bigint, p_ok boolean, p_erro text default null, p_adiar boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public','privado' as $$
begin
  if p_token is null or p_token <> (select valor from privado.segredos where nome = 'radar_token') then
    raise exception 'token inválido';
  end if;
  if p_ok then
    update emails_fila set enviado_em = now(), reservado_em = null, erro = null where id = p_id;
  elsif p_adiar then
    update emails_fila set reservado_em = null, proxima = now() + interval '1 hour', erro = left(coalesce(p_erro, 'sem quota'), 500) where id = p_id;
  else
    update emails_fila set reservado_em = null, tentativas = tentativas + 1,
           proxima = now() + (interval '30 minutes' * (tentativas + 1)), erro = left(coalesce(p_erro, ''), 500)
     where id = p_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.op_fila_confirmar(text, bigint, boolean, text, boolean) from public;
grant execute on function public.op_fila_confirmar(text, bigint, boolean, text, boolean) to anon, authenticated;

-- 9. Oportunidades do radar: a app (com conta) põe o e-mail na fila e o agente envia-o com o mesmo aspeto dos outros.
create or replace function public.op_enviar_oportunidade(p_emails jsonb, p_dados jsonb)
returns bigint language plpgsql security definer set search_path to 'public','privado' as $$
declare v_em jsonb := privado.emails_validos(p_emails); v_opc jsonb; v_id bigint;
begin
  if not public.e_equipa() then raise exception 'sem permissão'; end if;
  if jsonb_array_length(v_em) = 0 then raise exception 'sem e-mails válidos'; end if;
  if jsonb_array_length(v_em) > 10 or length(p_dados::text) > 20000 then raise exception 'pedido demasiado grande'; end if;
  select value into v_opc from app_storage where key = 'reclamacoes:opcoes';
  insert into emails_fila (tipo, escola, emails, responder, dados)
  values ('oportunidade', null, v_em,
          privado.emails_validos(coalesce(v_opc, '{}'::jsonb)->'emailResponderOperacionais')->>0,
          coalesce(p_dados, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.op_enviar_oportunidade(jsonb, jsonb) from public, anon;
grant execute on function public.op_enviar_oportunidade(jsonb, jsonb) to authenticated;
