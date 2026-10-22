-- ======================================================================
-- Fonte para o NotebookLM: resumo anonimizado da app, lido pelo script do Google
-- (NotebookLM_Fonte.gs), que o escreve num Google Doc usado como fonte no NotebookLM.
-- Colar no SQL Editor do Supabase e correr. Pode correr-se mais de uma vez.
--
-- O resumo NÃO leva: nomes, códigos de aluno, contactos, quem reclamou, nem o texto
-- das reclamações ou das respostas. Leva números por escola, temas, estados e prazos,
-- constatações das auditorias, riscos e oportunidades, objetivos.
-- Protegido pelo mesmo código do agente (privado.segredos.radar_token).
-- ======================================================================

create or replace function public.nlm_resumo(p_token text)
returns jsonb language plpgsql stable security definer set search_path to 'public','privado' as $$
declare
  v_ep text := privado.epoca_atual();
  v_rec jsonb; v_aud jsonb; v_des jsonb; v_exp jsonb; v_alu jsonb; v_ris jsonb; v_obj jsonb;
  v_ini date := privado.inicio_epoca((now() at time zone 'Europe/Lisbon')::date);
  t text := '[]';
begin
  if p_token is null or p_token <> (select valor from privado.segredos where nome = 'radar_token') then
    raise exception 'token inválido';
  end if;

  select value into v_rec from app_storage where key = 'reclamacoes:registo';
  if jsonb_typeof(v_rec) is distinct from 'array' then v_rec := '[]'; end if;
  select value into v_aud from app_storage where key = 'reclamacoes:auditorias';
  if jsonb_typeof(v_aud) is distinct from 'array' then v_aud := '[]'; end if;
  select value into v_des from app_storage where key = 'reclamacoes:desistencias';
  if jsonb_typeof(v_des) is distinct from 'array' then v_des := '[]'; end if;
  select value into v_exp from app_storage where key = 'reclamacoes:experiencias';
  if jsonb_typeof(v_exp) is distinct from 'array' then v_exp := '[]'; end if;
  select value->v_ep into v_alu from app_storage where key = 'reclamacoes:alunos';
  select value->'epocas'->v_ep->'itens' into v_ris from app_storage where key = 'reclamacoes:riscos';
  if jsonb_typeof(v_ris) is distinct from 'array' then v_ris := '[]'; end if;
  select value->'epocas'->v_ep->'itens' into v_obj from app_storage where key = 'reclamacoes:objetivos';
  if jsonb_typeof(v_obj) is distinct from 'array' then v_obj := '[]'; end if;

  return jsonb_build_object(
    'geradoEm', to_char(now() at time zone 'Europe/Lisbon', 'YYYY-MM-DD HH24:MI'),
    'epoca', v_ep,

    -- Reclamações: só campos de classificação (sem descrição, notas, respostas nem quem reclamou)
    'reclamacoes', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'numero', x->>'entryNumber', 'epoca', x->>'epoca', 'escola', x->>'school', 'tema', x->>'tema',
          'categoria', x->>'categoria', 'canal', x->>'canal', 'gravidade', x->>'severity', 'estado', x->>'status',
          'causaRaiz', left(x->>'causaRaiz', 200), 'recebida', left(x->>'receivedDate', 10), 'concluida', left(x->>'resolvedDate', 10),
          'prazo', left(x->>'deadline', 10), 'eficacia', case when jsonb_typeof(x->'eficacia') = 'object' then x->'eficacia'->>'resultado' else x->>'eficacia' end
        )) order by x->>'receivedDate' desc), '[]') from jsonb_array_elements(v_rec) x),

    -- Auditorias: constatações (texto da constatação e da ação, que descrevem a escola, não pessoas)
    'auditorias', (select coalesce(jsonb_agg(jsonb_build_object(
          'escola', a->>'school', 'data', left(a->>'date', 10), 'epoca', a->>'epoca', 'ambito', a->>'ambito',
          'constatacoes', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
              'tipo', f->>'classification', 'area', f->>'area', 'categoria', f->>'category',
              'descricao', left(f->>'description', 500), 'acao', left(f->>'acao', 400), 'causaRaiz', left(f->>'causaRaiz', 200),
              'prazo', left(f->>'prazo', 10), 'resolvida', coalesce(f->>'resolvida', 'false') = 'true', 'resolvidaEm', left(f->>'resolvidaEm', 10)))), '[]')
            from jsonb_array_elements(coalesce(a->'findings', '[]')) f)
        ) order by a->>'date' desc), '[]') from jsonb_array_elements(v_aud) a where a->>'epoca' = v_ep or left(a->>'date', 10) >= v_ini::text),

    -- Desistências da época: contagens por escola e motivo (sem códigos de aluno)
    'desistencias', (select coalesce(jsonb_agg(jsonb_build_object('escola', escola, 'motivo', motivo, 'n', n) order by n desc, escola), '[]') from (
        select coalesce(d->>'escola', '—') escola, coalesce(nullif(d->>'motivo', ''), 'sem motivo') motivo,
               sum(case when (d->>'n') ~ '^\d+$' then (d->>'n')::int else 1 end) n
          from jsonb_array_elements(v_des) d where d->>'epoca' = v_ep group by 1, 2) q),

    -- Experiências da época por escola
    'experiencias', (select coalesce(jsonb_agg(jsonb_build_object('escola', escola, 'total', total, 'sucesso', suc, 'insucesso', ins, 'pendentes', pen) order by escola), '[]') from (
        select x->>'escola' escola, count(*) total,
               count(*) filter (where x->>'resultado' = 'sucesso') suc,
               count(*) filter (where x->>'resultado' = 'insucesso') ins,
               count(*) filter (where coalesce(x->>'resultado', 'pendente') = 'pendente') pen
          from jsonb_array_elements(v_exp) x where x->>'epoca' = v_ep group by 1) q),

    -- Inscritos da época por escola
    'inscritos', (select coalesce(jsonb_agg(jsonb_build_object('escola', escola, 'ativos', at, 'desistiram', de) order by escola), '[]') from (
        select al->>'escola' escola, count(*) filter (where al->>'estado' = 'ativo') at, count(*) filter (where al->>'estado' = 'desistiu') de
          from jsonb_each(coalesce(v_alu->'alunos', '{}')) a(id, al) group by 1) q),

    -- Riscos e oportunidades da época
    'riscos', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'n', r->>'n', 'tipo', case when r->>'tipo' = 'O' then 'Oportunidade' else 'Risco' end, 'processo', r->>'processo',
          'identificacao', left(r->>'identificacao', 400), 'causa', left(r->>'causa', 300), 'impacto', left(r->>'impacto', 300),
          'po', r->>'po', 'gr', r->>'gr', 'aceitacao', r->>'aceitacao', 'acao', left(r->>'acao', 400),
          'responsavel', r->>'responsavel', 'data', r->>'data', 'estado', r->>'estado'))), '[]') from jsonb_array_elements(v_ris) r),

    -- Objetivos da época
    'objetivos', (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'processo', o->>'processo', 'objetivo', left(o->>'objetivo', 300), 'indicador', left(o->>'indicador', 300),
          'meta', coalesce(o->>'metaFmt', o->>'meta'), 'prazo', o->>'prazo', 'responsavel', o->>'responsavel',
          'monitorizacao', left(o->>'monitorizacao', 200)))), '[]') from jsonb_array_elements(v_obj) o)
  );
end $$;
revoke all on function public.nlm_resumo(text) from public;
grant execute on function public.nlm_resumo(text) to anon, authenticated;
