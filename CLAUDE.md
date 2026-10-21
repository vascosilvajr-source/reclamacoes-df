# Auditoria e Gestão de Qualidade DF

**O que é:** App de gestão de qualidade da Dragon Force (FC Porto) — inscrições, experiências, espaços, objetivos, relatórios e e-mails às escolas.

- **Repo:** `vascosilvajr-source/reclamacoes-df`
- **Stack:** React 18 + Vite, JavaScript (sem TypeScript), Supabase (PostgreSQL + RPC)
- **Deploy:** Cloudflare Workers (main → produção automática) — https://gestaodaqualidade-df.dfqualidade.workers.dev
- **Supabase project:** `dvkzayecqgcvowyrvmfr`

---

## Comandos

```bash
# Build (obrigatório antes de cada commit)
npx vite build

# Dev local (porta 5173)
npm run dev
```

---

## Workflow de commits

Sempre nesta ordem:

```bash
npx vite build
git add <ficheiros específicos — nunca git add -A>
git commit -m "mensagem"
git fetch -q origin main && git rebase -q origin/main && git push -q origin main
```

**Trailer obrigatório em todos os commits:**
```
Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Tj5HwVs4WGxkiC96R9RioF
```

Nunca commitar `.harness/` — `rm -rf .harness/` antes se existir.

`pkill -f "vite --config .harness"` corre sozinho num comando separado (sai com código 144, é normal).

---

## Estrutura dos ficheiros principais

| Ficheiro | O que contém |
|---|---|
| `src/App.jsx` | App principal — todos os painéis, componentes e lógica |
| `src/operacional.jsx` | Janela pública `?op=<token>` para operacionais das escolas |
| `src/main.jsx` | Entry point — router entre App e Operacional |
| `src/foto.js` | `imprimirBalanco()` — geração de PDF via print |
| `src/imagens.js` | `LOGO_BRANCO`, `FOTO_ESTADIO` |
| `src/sgq.js` | Lógica de qualidade — estados, metas, derivações |
| `supabase/` | SQL das migrações (aplicar manualmente no Supabase SQL Editor) |

---

## Supabase

- **Chave pública:** `sb_publishable_KLx3medCXPqV-JZC9NXW-Q_K62OUHCu`
- Todas as chamadas são RPCs com SECURITY DEFINER
- Token de autenticação interna: verificado contra `privado.segredos.radar_token`
- Migrações: **nunca usar `apply_migration` direto** — gerar SQL e o utilizador cola no Supabase SQL Editor

---

## Convenções de código

- JavaScript funcional, sem TypeScript
- Componentes em `src/App.jsx` (app é monoficheiro com exceções em ficheiros próprios)
- Não instalar pacotes npm sem perguntar primeiro
- Nunca commitar `.env` ou chaves secretas

---

## Segurança (dados de menores)

- A app contém dados pessoais de menores — tratar com cuidado máximo
- Testes com dados sintéticos ou agregados, nunca dados reais
- E-mails e a janela operacional mostram apenas **códigos de aluno, turmas e datas** — nunca nomes
- Não expor dados reais em outputs, logs ou sandboxes

---

## Estilo e linguagem

- PT-PT, direto, sem linguagem corporativa
- **"turmas"** e **"equipas de competição"** (nunca "escolinhas")
- **"alunas"** ou **"feminino"** (nunca "raparigas")
- **"encarregados de educação"** (nunca "pais")
- Evitar vermelho na UI — usar laranja (`#C2570C` claro / `#F08A4B` escuro) para alertas graves

---

## Agentes externos

### Emails_Escolas.gs (Google Apps Script)
- Corre de hora a hora na conta que envia os e-mails (não a conta do utilizador)
- Chama `op_preparar` no Supabase; envia e-mails operacionais e ao coordenador técnico
- `replyTo` aponta para `@fcporto.pt`
- Ficheiro em `scratchpad/agente/Emails_Escolas.gs`

### Radar_Gemini.gs (Google Apps Script)
- Agente externo Gemini + Tavily para radar de mercado
- Não fazer pesquisa web aqui — corre no agente externo
- Ficheiro em `scratchpad/agente/Radar_Gemini.gs`

---

## Ações proibidas

- Não apagar nem sobrescrever schemas de produção no Supabase
- Não instalar pacotes npm sem perguntar
- Não commitar `.harness/`, `.env` ou chaves
- Não usar `git add -A` ou `git add .`
- Não fazer `apply_migration` direto — sempre gerar SQL para o utilizador aplicar
