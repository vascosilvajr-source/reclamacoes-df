-- Fixa o search_path das funções do esquema privado (aviso "Function Search Path Mutable" do Supabase).
-- Impede que uma função seja enganada por objetos com o mesmo nome noutro esquema.
-- Idempotente: pode correr-se várias vezes. Não altera dados nem a lógica das funções.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'privado' and p.prokind = 'f'
  loop
    execute format('alter function %s set search_path = public, privado, pg_temp', f.assinatura);
  end loop;
end $$;
