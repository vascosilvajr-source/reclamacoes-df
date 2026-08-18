-- Corre este script no SQL Editor do teu projeto Supabase
-- (menu lateral "SQL Editor" -> "New query" -> colar -> Run)

create table if not exists app_storage (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Ativa Row Level Security (obrigatório para permitir acesso via chave "anon")
alter table app_storage enable row level security;

-- Política simples: qualquer pessoa com a chave "anon" do projeto pode
-- ler e escrever. Isto reproduz o comportamento atual da app (dados
-- partilhados por todos). Ver o guia para reforçar isto mais tarde
-- com autenticação, caso venhas a precisar.
create policy "Permitir leitura publica"
  on app_storage for select
  using (true);

create policy "Permitir escrita publica"
  on app_storage for insert
  with check (true);

create policy "Permitir atualizacao publica"
  on app_storage for update
  using (true);
