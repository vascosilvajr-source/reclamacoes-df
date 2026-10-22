-- Configuração inicial da tabela de dados da app (só para um projeto Supabase novo).
-- Corre isto no SQL Editor; depois corre supabase/seguranca.sql e supabase/operacionais.sql.
--
-- ATENÇÃO: versões antigas deste ficheiro criavam regras que abriam a tabela a toda a gente
-- (qualquer pessoa com a chave pública lia e escrevia). Não as voltes a criar.
-- O acesso é dado pelo supabase/seguranca.sql: só as contas da equipa (privado.equipa).

create table if not exists app_storage (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table app_storage enable row level security;

drop policy if exists "Permitir leitura publica" on app_storage;
drop policy if exists "Permitir escrita publica" on app_storage;
drop policy if exists "Permitir atualizacao publica" on app_storage;
