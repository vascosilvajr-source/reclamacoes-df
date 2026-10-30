-- Junta uma pessoa à equipa (idempotente). Antes, cria a conta em Supabase → Authentication → Users → Add user
-- (e-mail + palavra-passe, com "Auto Confirm User" ligado). Troca o e-mail e o nome e corre.
-- Sem esta linha a pessoa entra, mas não vê nem grava nada.
insert into privado.equipa (user_id, nota)
select id, 'Nome da pessoa' from auth.users where email = 'email@exemplo.pt'
on conflict do nothing;

-- Quem está na equipa agora:
select u.email, e.nota from privado.equipa e join auth.users u on u.id = e.user_id order by 1;
