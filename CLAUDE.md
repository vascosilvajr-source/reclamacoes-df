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
| `src/App.jsx` | Casca da app (~5k linhas): entrada, menu, estado global, gravação, página "Hoje" e a lista de reclamações |
| `src/nucleo.jsx` | O que é preciso logo ao abrir e partilhado: cores, estilos, utilitários, componentes base. Também os "embrulhos" das páginas carregadas à medida (`CARREGAR_PAGINA`, `aMedida`) |
| `src/partilhado.jsx` | Partilhado entre páginas mas não preciso para abrir (gráficos, fichas, importações): descarrega com a 1.ª página que o usa |
| `src/paginas/*.jsx` | Uma por área (inscritos, auditorias, reclamacoes, riscos, emails…): só descarregam quando abertas e ficam pré-carregadas 2,5 s depois de a app abrir |
| `src/operacional.jsx` | Janela pública `?op=<token>` para operacionais e coordenadores (sem login) |
| `src/main.jsx` | Entry point: escolhe entre App e Operacional |
| `src/foto.js` | `imprimirBalanco()`: PDF via impressão (A4, `vertical` opcional) |
| `src/imagens.js` | `LOGO_BRANCO`, `FOTO_ESTADIO` |
| `src/sgq.js` | Lógica de qualidade: estados, metas, derivações |
| `supabase/` | SQL das migrações: `seguranca.sql` (acesso só da equipa; correr primeiro), `operacionais.sql` (RPCs dos e-mails), `remover_notebooklm.sql` (apaga a função `nlm_resumo`, já sem uso), `endurecer.sql` (links expirados sem dados; pré-visualização só com sessão), `juntar_utilizador.sql` (juntar uma pessoa à equipa) |
| `wrangler.jsonc` | Config do deploy Cloudflare (serve `dist/`, modo SPA) |

- **Encontrar código:** `grep -rn "function Nome" src`. Uma página nova ou componente grande vai para `src/paginas/<area>.jsx` e entra em `CARREGAR_PAGINA` + `aMedida` no `nucleo.jsx`. O que é usado por várias páginas vai para `partilhado.jsx` (ou `nucleo.jsx` se o App/Hoje também usa). `nucleo.jsx` nunca importa de `App.jsx` nem das páginas.
- **Variáveis `let` reatribuídas** (estilos do tema, `CAUSAS_ATUAIS`…) só se mudam no ficheiro onde estão declaradas (um `import` não pode ser reatribuído): usar as funções `definir…`.
- **PDFs:** usar `BotaoFoto` + `useRef` no nó a exportar. Botões e menus levam a classe `semFoto` para ficarem fora do PDF.
- **Sessão:** termina ao fim de 4 h sem uso. Login por e-mail + palavra-passe (contas individuais em Supabase Auth). O e-mail não está no código; fica lembrado só no dispositivo.
- **CSP:** em `public/_headers`. Um domínio externo novo (API, fontes, imagens) tem de entrar lá, senão o browser bloqueia.
- **Acesso:** só contas em `privado.equipa` leem e escrevem (`public.e_equipa()` nas políticas; ver `supabase/seguranca.sql`). Conta nova: inserir o `user_id` nessa tabela.
- **Supabase:** todas as chamadas são RPCs `SECURITY DEFINER`. Chave pública (publishable) em `sb_publishable_KLx3medCXPqV-JZC9NXW-Q_K62OUHCu`. Variáveis de build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. O token interno é verificado contra `privado.segredos.radar_token`.
- **Pedidos operacionais:** tabela `pedidos_operacionais`; tipos pelo `itens.tipo`: semanal (sem tipo), `eficacia`, `reclamacao` (só leitura).
- **Reclamações:** `reclamacoes:registo` em `app_storage`. O nome de quem reclama nunca sai da app.

# Agentes externos (fora do repo)
Correm no Google Apps Script, não nesta app. Não fazer pesquisa web aqui.
- **Emails_Escolas.gs:** corre de 5 em 5 minutos numa conta Gmail separada, chama `op_preparar` e envia e-mails a operacionais, coordenadores técnicos e coordenador geral. `replyTo` aponta para o @fcporto.pt. Tem o `TOKEN_APP`, por isso **nunca vai para o repo**. `URL_APP` tem de coincidir com o endereço de produção.
- **Radar_Gemini.gs:** Gemini + Tavily para o radar de mercado.

# Ao mudar o endereço de produção
Atualizar: Supabase Auth (Site URL e Redirect URLs), `URL_APP` no `.gs` e este ficheiro.
