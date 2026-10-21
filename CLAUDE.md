# Visão geral
- **Nome:** Auditoria e Gestão de Qualidade DF
- **Stack:** React 18 + Vite, JavaScript (sem TypeScript), Supabase (PostgreSQL + RPC), Cloudflare Workers
- **Objetivo:** gestão de qualidade da Dragon Force (FC Porto): inscrições, experiências, reclamações, auditorias, espaços, objetivos, relatórios e e-mails às escolas.
- **Repo:** `vascosilvajr-source/reclamacoes-df` (trabalho direto na `main`)
- **Produção:** https://gestaodaqualidade-df.dfqualidade.workers.dev (deploy automático a cada push na `main`)
- **Supabase:** projeto `dvkzayecqgcvowyrvmfr`. Dados na tabela `app_storage(key, value jsonb)`.

# Comandos
- **Instalar:** `npm install`
- **Dev:** `npm run dev` (porta 5173)
- **Build (obrigatório antes de cada commit):** `npx vite build`
- **Testes e lint:** não existem. Validar com o build e, se for preciso, com dados sintéticos.

# Commits
Sempre por esta ordem:
```bash
npx vite build
git add <ficheiros específicos>
git commit -m "mensagem"
git fetch -q origin main && git rebase -q origin/main && git push -q origin main
```
Trailer em todos os commits:
```
Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Tj5HwVs4WGxkiC96R9RioF
```
- Nunca `git add -A` nem `git add .`.
- Nunca commitar `.harness/` (`rm -rf .harness/` antes), `.env`, chaves ou tokens.
- `pkill -f "vite --config .harness"` corre sozinho, num comando separado (sai com código 144, é normal).

# Regras
- JavaScript funcional, sem TypeScript. Não instalar pacotes npm sem perguntar.
- Não apagar nem sobrescrever schemas de produção no Supabase.
- Migrações: nunca `apply_migration`. Gerar o SQL em `supabase/` e o utilizador cola-o no SQL Editor do Supabase. Os SQL têm de ser idempotentes.
- Respostas curtas e diretas, sem conversa a mais depois de chamar ferramentas.

# Segurança (dados de menores)
- A app tem dados pessoais de menores: cuidado máximo.
- Testes só com dados sintéticos ou agregados. Nunca puxar dados reais para sandboxes, logs ou outputs.
- E-mails e janela operacional mostram só **códigos de aluno, turmas e datas**. Nunca nomes.

# Estilo e linguagem
- PT-PT, direto, sem linguagem corporativa.
- "turmas" e "equipas de competição" (nunca "escolinhas").
- "alunas" ou "feminino" (nunca "raparigas").
- "encarregados de educação" (nunca "pais").
- Evitar vermelho na UI: usar laranja (`#C2570C` claro / `#F08A4B` escuro) para alertas graves.

# Arquitetura e ficheiros
| Ficheiro | O que contém |
|---|---|
| `src/App.jsx` | App principal (~28k linhas): painéis, componentes e lógica. Para localizar algo, usar `grep -n "function Nome"` e ler só o troço. |
| `src/operacional.jsx` | Janela pública `?op=<token>` para operacionais e coordenadores (sem login) |
| `src/main.jsx` | Entry point: escolhe entre App e Operacional |
| `src/foto.js` | `imprimirBalanco()`: PDF via impressão (A4, `vertical` opcional) |
| `src/imagens.js` | `LOGO_BRANCO`, `FOTO_ESTADIO` |
| `src/sgq.js` | Lógica de qualidade: estados, metas, derivações |
| `supabase/` | SQL das migrações (`operacionais.sql` tem as RPCs dos e-mails) |
| `wrangler.jsonc` | Config do deploy Cloudflare (serve `dist/`, modo SPA) |

- **PDFs:** usar `BotaoFoto` + `useRef` no nó a exportar. Botões e menus levam a classe `semFoto` para ficarem fora do PDF.
- **Supabase:** todas as chamadas são RPCs `SECURITY DEFINER`. Chave pública (publishable) em `sb_publishable_KLx3medCXPqV-JZC9NXW-Q_K62OUHCu`. Variáveis de build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. O token interno é verificado contra `privado.segredos.radar_token`.
- **Pedidos operacionais:** tabela `pedidos_operacionais`; tipos pelo `itens.tipo`: semanal (sem tipo), `eficacia`, `reclamacao` (só leitura).
- **Reclamações:** `reclamacoes:registo` em `app_storage`. O nome de quem reclama nunca sai da app.

# Agentes externos (fora do repo)
Correm no Google Apps Script, não nesta app. Não fazer pesquisa web aqui.
- **Emails_Escolas.gs:** corre de hora a hora numa conta Gmail separada, chama `op_preparar` e envia e-mails a operacionais, coordenadores técnicos e coordenador geral. `replyTo` aponta para o @fcporto.pt. Tem o `TOKEN_APP`, por isso **nunca vai para o repo**. `URL_APP` tem de coincidir com o endereço de produção.
- **Radar_Gemini.gs:** Gemini + Tavily para o radar de mercado.

# Ao mudar o endereço de produção
Atualizar: Supabase Auth (Site URL e Redirect URLs), `URL_APP` no `.gs` e este ficheiro.
