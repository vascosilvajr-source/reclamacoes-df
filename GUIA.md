# Guia: publicar a app "Auditoria e Gestão de Qualidade DF" com Supabase (grátis)

Este guia leva-te do zero até teres a app online, num link público, com os
dados a sincronizar em tempo real para todas as pessoas que a usarem —
tudo com serviços gratuitos (Supabase + Vercel).

Ficheiros incluídos neste pacote:

```
reclamacoes-app/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── .gitignore
├── supabase-setup.sql        ← script SQL para criares a base de dados
├── GUIA.md                   ← este ficheiro
└── src/
    ├── main.jsx
    ├── App.jsx                ← a tua app, já adaptada para usar Supabase
    └── supabaseClient.js      ← liga a app ao Supabase
```

A app já foi alterada para deixar de usar o armazenamento interno do
Claude (`window.storage`) e passar a gravar tudo numa tabela do Supabase
chamada `app_storage`. A lógica da app (formulários, prazos, auditorias,
certificação FPF) não foi tocada — só a forma como os dados são guardados.

---

## Parte 1 — Criar a base de dados no Supabase (grátis)

1. Vai a **https://supabase.com** e clica em **"Start your project"**.
2. Cria conta (podes usar o GitHub para entrar mais rápido).
3. Clica em **"New project"**.
   - **Name**: por exemplo `reclamacoes-df`
   - **Database Password**: cria uma password forte e **guarda-a** num
     local seguro (não vais precisar dela no dia a dia, mas convém teres).
   - **Region**: escolhe a mais próxima, por exemplo `West EU (Ireland)` ou `West EU (London)`.
   - Plano: mantém o **Free**.
4. Clica em **"Create new project"** e espera 1-2 minutos enquanto o
   Supabase prepara a base de dados.

### Criar a tabela

5. No menu lateral esquerdo, clica em **"SQL Editor"**.
6. Clica em **"New query"**.
7. Abre o ficheiro `supabase-setup.sql` (incluído neste pacote), copia
   todo o conteúdo, cola no editor e clica em **"Run"** (ou `Ctrl/Cmd + Enter`).
8. Deves ver "Success. No rows returned" — a tabela `app_storage` foi criada.

### Obter as chaves de ligação

9. No menu lateral, vai a **"Project Settings"** (ícone de engrenagem) → **"Data API"** (ou "API", consoante a versão da interface).
10. Anota dois valores:
    - **Project URL** (algo como `https://xxxxxxxxxx.supabase.co`)
    - **anon public key** (uma chave longa, começa por `eyJ...`)

Vais precisar destes dois valores já a seguir.

> **Nota de segurança:** a chave "anon" é pública por natureza (fica
> visível no browser de quem usa a app) — é assim que o Supabase
> funciona em apps client-side. O script SQL cria políticas que
> permitem leitura/escrita a quem tiver essa chave, tal como a app já
> funcionava antes (dados partilhados por todos, sem login). Se mais
> tarde quiseres exigir login antes de mexer nos dados, o Supabase tem
> autenticação incorporada — posso ajudar-te a adicionar isso depois.

---

## Parte 2 — Preparar o projeto no teu computador

Precisas de ter o **Node.js** instalado (versão 18 ou superior).
Se não tiveres, instala em **https://nodejs.org** (escolhe a versão "LTS").

1. Descarrega e descompacta a pasta `reclamacoes-app` (partilhada nesta conversa).
2. Abre um terminal dentro dessa pasta.
3. Cria o ficheiro de configuração local:

   ```bash
   cp .env.example .env
   ```

4. Abre o ficheiro `.env` num editor de texto e substitui pelos valores
   que anotaste no Supabase:

   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...a-tua-chave...
   ```

5. Instala as dependências:

   ```bash
   npm install
   ```

6. Corre a app localmente para testar:

   ```bash
   npm run dev
   ```

7. Abre o link que aparece no terminal (normalmente `http://localhost:5173`).
   Cria uma reclamação de teste e confirma que tudo funciona. Se abrires
   o "Table Editor" no Supabase (menu lateral) e olhares para a tabela
   `app_storage`, deves ver uma linha com `key = "reclamacoes:registo"`.

---

## Parte 3 — Publicar num link público, grátis (Vercel)

A forma mais simples e gratuita de publicar é via **Vercel**, ligado a
um repositório no **GitHub**.

### 3.1 Colocar o projeto no GitHub

1. Cria conta em **https://github.com** (se ainda não tiveres).
2. Clica em **"New repository"**, dá um nome (ex: `reclamacoes-df`), deixa
   como **Private** se preferires que não seja público o código-fonte
   (isto não afeta o link da app, que pode ser aberto por qualquer
   pessoa mesmo com o repositório privado).
3. No terminal, dentro da pasta do projeto:

   ```bash
   git init
   git add .
   git commit -m "Primeira versão"
   git branch -M main
   git remote add origin https://github.com/SEU-UTILIZADOR/reclamacoes-df.git
   git push -u origin main
   ```

   (O `.env` não vai ser enviado — está no `.gitignore` de propósito,
   para a tua chave nunca ficar exposta no código no GitHub.)

### 3.2 Ligar ao Vercel

4. Vai a **https://vercel.com** e cria conta com o GitHub (login com um clique).
5. Clica em **"Add New..." → "Project"**.
6. Escolhe o repositório `reclamacoes-df` que acabaste de criar e clica
   em **"Import"**.
7. O Vercel deteta automaticamente que é um projeto Vite — não precisas
   mudar nada nas definições de build.
8. Antes de publicar, clica em **"Environment Variables"** e adiciona
   as duas variáveis (os mesmos valores do teu `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
9. Clica em **"Deploy"**. Em cerca de 1 minuto tens um link do tipo:

   ```
   https://reclamacoes-df.vercel.app
   ```

10. Partilha esse link com quem precisar de usar a app. Todos vão ler e
    escrever na mesma base de dados Supabase, por isso os dados ficam
    sempre sincronizados entre todos, em tempo real (basta recarregar a
    página para ver as alterações de outra pessoa).

A partir daqui, sempre que fizeres alterações ao código e fizeres
`git push`, o Vercel volta a publicar automaticamente a nova versão.

---

## Alternativas gratuitas ao Vercel

Se preferires, o mesmo processo funciona quase de forma idêntica em:

- **Netlify** (https://netlify.com) — importa o repositório do GitHub,
  define `npm run build` como comando de build e `dist` como pasta de
  publicação, e adiciona as mesmas variáveis de ambiente.
- **Cloudflare Pages** (https://pages.cloudflare.com) — processo semelhante.

Todas têm planos gratuitos mais do que suficientes para uma app interna
como esta.

---

## Resumo do que muda em relação à versão no Claude

| | Antes (Artifact Claude) | Agora (site próprio + Supabase) |
|---|---|---|
| Onde corre | Só dentro do Claude | Em qualquer navegador, em qualquer lugar |
| Onde ficam os dados | `window.storage` do Claude | Tabela `app_storage` no Supabase |
| Quem pode aceder | Quem tiver o link do Artifact e conta Claude | Qualquer pessoa com o link do site |
| Sincronização entre utilizadores | Sim (storage partilhado) | Sim (mesma base de dados para todos) |
| Custo | Grátis | Grátis (planos free do Supabase e Vercel) |

## Limites do plano gratuito a ter em conta

- **Supabase Free**: até 500 MB de base de dados e o projeto pausa
  automaticamente após 1 semana sem atividade (basta abrir o painel do
  Supabase para o reativar caso isso aconteça). Mais do que suficiente
  para este tipo de registo.
- **Vercel Free (Hobby)**: destinado a uso pessoal/não-comercial, mas
  cobre perfeitamente uma ferramenta interna de uma escola/entidade.

Se precisares de ajuda em qualquer um destes passos, ou quiseres que eu
adicione autenticação (login) mais tarde, é só dizeres.
