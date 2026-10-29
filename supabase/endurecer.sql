-- Endurecimento de segurança (idempotente: pode correr mais do que uma vez).
-- Cola tudo no SQL Editor do Supabase e carrega em Run. Não apaga nem altera dados.

-- 1. Links expirados deixam de devolver conteúdo (turmas, códigos de alunos, reclamações do dashboard).
--    A janela mostra só "Pedido expirado".
create or replace function public.op_pedido(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v jsonb;
begin
  if length(coalesce(p_token, '')) < 32 then return null; end if;
  -- Primeira abertura do link: deixa de precisar de lembrete.
  update pedidos_operacionais set aberto_em = now() where token = p_token and aberto_em is null;
  -- Link expirado: só diz que expirou (não devolve turmas, alunos nem reclamações).
  select jsonb_build_object('escola', p.escola, 'expira', p.expira, 'expirado', true)
    into v from pedidos_operacionais p where p.token = p_token and p.expira < now();
  if v is not null then return v; end if;
  select jsonb_build_object('escola', p.escola, 'itens', p.itens, 'respostas', p.respostas, 'respondido_em', p.respondido_em,
    'expira', p.expira, 'expirado', p.expira < now(),
    'propostas', (select coalesce(jsonb_agg(jsonb_build_object('id', c.aluno, 'de', c.de, 'para', c.para) order by c.id), '[]'::jsonb)
                    from alteracoes_turma c where c.escola = p.escola and c.estado = 'pendente'))
    into v from pedidos_operacionais p where p.token = p_token;
  return v;
end $$;
revoke all on function public.op_pedido(text) from public;
grant execute on function public.op_pedido(text) to anon, authenticated;

-- 2. A pré-visualização de e-mails só pode ser pedida por quem tem sessão da equipa
--    (a função já recusava; assim nem chega a correr sem sessão).
revoke all on function public.op_previa(text, text) from public, anon;
grant execute on function public.op_previa(text, text) to authenticated;
revoke all on function public.op_enviar_oportunidade(jsonb, jsonb) from public, anon;
grant execute on function public.op_enviar_oportunidade(jsonb, jsonb) to authenticated;
revoke all on function public.e_equipa() from public, anon;
grant execute on function public.e_equipa() to authenticated;

-- 3. Verificação: deve devolver 0 linhas.
select p.proname as funcao_aberta_sem_sessao
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('op_previa', 'op_enviar_oportunidade', 'e_equipa')
  and has_function_privilege('anon', p.oid, 'execute');
