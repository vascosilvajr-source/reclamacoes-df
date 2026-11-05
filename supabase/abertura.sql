-- "Abriu" só quando uma pessoa interage com a página (idempotente: pode correr mais do que uma vez).
-- Cola tudo no SQL Editor do Supabase e carrega em Run. Não apaga nem altera dados.
--
-- Porquê: antes, o pedido ficava "aberto" assim que o link carregava. Os filtros de segurança do
-- e-mail (Outlook/Defender, antivírus, Gmail) abrem os links sozinhos, por isso aparecia "Abriu, sem
-- resposta" mesmo quando a pessoa nem tinha visto o e-mail. Agora só conta quando alguém clica,
-- toca, usa o teclado ou faz scroll na página.

-- 1. Abrir o link deixa de marcar "aberto" (o resto fica igual ao endurecer.sql).
create or replace function public.op_pedido(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare v jsonb;
begin
  if length(coalesce(p_token, '')) < 32 then return null; end if;
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

-- 2. A página chama isto na primeira interação humana.
create or replace function public.op_aberto(p_token text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if length(coalesce(p_token, '')) < 32 then return; end if;
  update pedidos_operacionais set aberto_em = now() where token = p_token and aberto_em is null and expira > now();
end $$;
revoke all on function public.op_aberto(text) from public;
grant execute on function public.op_aberto(text) to anon, authenticated;
