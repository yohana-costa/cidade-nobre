# Cidade Nobre, Barbearia Premium

Sistema da **Cidade Nobre**: site do cliente com agendamento online e Clube de fidelidade, e a área de gestão da barbearia. Tudo roda num único projeto da Vercel: o site estático e a API (Express) como função serverless no mesmo domínio, com banco PostgreSQL no Neon.

- **Site do cliente** (`/`): Início, Serviços, Agendamento (profissional, dia e horário), Dados, Confirmação, Clube Cidade Nobre e Perfil. Agendar não exige conta; Clube e Perfil exigem entrar com telefone e senha.
- **Gestão** (`/gestao`): login da equipe; Visão geral, Agenda (com registro de atendimento de balcão), Clientes, Serviços e equipe, Fidelidade, Oportunidades e Configurações (regras e acessos).
- **Link de indicação** (`/indique/CODIGO`): guarda o código e aplica a indicação no primeiro agendamento do amigo.

---

## 1. Estrutura

```
cidade-nobre/
├── api/index.ts              função da Vercel: exporta o app Express (sem listen)
├── backend/src/
│   ├── app.ts                monta o Express (rotas, JSON, logger, erros)
│   ├── server.ts             só para desenvolvimento local (listen na 3341)
│   ├── config/env.ts         variáveis de ambiente
│   ├── middleware/           auth (equipe e cliente), errorHandler, logger
│   ├── lib/                  prisma, jwt, datas (fuso), base (formatos e fórmulas de leitura)
│   ├── routes/ → controllers/ → services/   (regras de negócio ficam nos services)
├── prisma/
│   ├── schema.prisma         modelo de dados (PostgreSQL)
│   ├── migrations/           migrations versionadas (aplicadas no build da Vercel)
│   └── seed.ts               dados iniciais (rodar uma vez, manualmente)
├── src/                      front (HTML/CSS/JS puro, sem framework)
│   ├── api.js                fetch com token (equipe e cliente separados)
│   ├── core.js               utilidades, estado da tela, cache das leituras da API
│   ├── icons.js, client.js, admin.js, main.js, styles.css
├── index.html                página do site (desenvolvimento)
├── assets/                   imagens e fontes
├── scripts/build.mjs         gera dist/ (site estático com nomes com hash)
├── scripts/servidor-dev.mjs  servidor local do site com /api repassado ao backend
├── testes/api.mjs            teste ponta a ponta da API
├── testes/fluxos.mjs         teste no navegador (cliente e gestão)
├── ferramentas/, referencias/  scripts de recorte das imagens a partir das telas aprovadas
└── vercel.json               build, pasta de saída e rewrites
```

---

## 2. Rodar localmente

Requisitos: Node 20+ e um PostgreSQL.

```bash
npm install                     # também roda "prisma generate"
cp .env.example .env            # ajuste DATABASE_URL, DATABASE_URL_UNPOOLED e JWT_SECRET
npx prisma migrate deploy       # cria as tabelas
npm run db:seed                 # admin, serviços, profissionais e regras padrão
npm run dev:api                 # API em http://localhost:3341
npm run dev                     # site em http://localhost:8092 (repassa /api para a 3341)
```

Abra `http://localhost:8092` (site) e `http://localhost:8092/gestao` (gestão).

Para servir o site gerado pelo build: `npm run build` e depois `DIR=dist npm run dev`. Para apontar o front para uma API em outro endereço sem o repasse, defina `window.CN_API_BASE = 'https://.../api'` antes de carregar os scripts.

### Variáveis de ambiente

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão com pool, usada pela API (Neon: criada pela integração da Vercel). |
| `DATABASE_URL_UNPOOLED` | Conexão direta, usada por `prisma migrate`. |
| `JWT_SECRET` | Segredo dos tokens. Obrigatório em produção, mínimo de 24 caracteres. |
| `JWT_EXPIRES_IN` / `JWT_CLIENTE_EXPIRES_IN` | Opcionais. Duração da sessão da equipe (7d) e do cliente (30d). |
| `TZ_NEGOCIO` | Opcional. Fuso do negócio (padrão `America/Sao_Paulo`). |
| `CORS_ORIGINS` | Opcional. Só se o site rodar em outro domínio que não o da API. |

### Acesso inicial

O seed cria **admin@cidadenobre.com.br / admin123**. **Troque essa senha no primeiro acesso** (Gestão → Configurações → Minha senha) e crie os acessos da equipe na mesma tela.

---

## 3. Deploy na Vercel

1. **Criar o projeto**: importe este repositório na Vercel. Não precisa escolher framework: o `vercel.json` já define `buildCommand` (`npm run vercel-build`), `outputDirectory` (`dist`) e os rewrites (`/api/*` vai para a função `api/index.ts`; o resto cai no `index.html`).
2. **Banco**: em *Storage* (ou *Integrations*), adicione o **Neon** ao projeto. A integração cria `DATABASE_URL` e `DATABASE_URL_UNPOOLED` nos ambientes.
3. **Segredo**: em *Settings → Environment Variables*, crie `JWT_SECRET` com um valor longo e aleatório (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
4. **Primeiro deploy**: o build roda `prisma migrate deploy` (cria ou atualiza as tabelas) e depois gera o site em `dist/`. O `postinstall` gera o Prisma Client com o binário da Vercel (`rhel-openssl-3.0.x`).
5. **Seed, uma única vez**, da sua máquina, apontando para o banco de produção:
   ```bash
   DATABASE_URL="<url do Neon>" DATABASE_URL_UNPOOLED="<url direta do Neon>" npm run db:seed
   ```
   O seed é idempotente: rodar de novo não duplica nada.
6. Entre em `/gestao`, troque a senha do admin, ajuste serviços, preços, profissionais e regras.

Mudanças no banco: altere `prisma/schema.prisma`, rode `npx prisma migrate dev --name descricao` localmente e faça o commit da pasta `prisma/migrations`. O próximo deploy aplica a migration. Confira se o `migration.sql` gerado não tem BOM (UTF-8 com BOM quebra o Postgres).

---

## 4. Regras do negócio (todas no servidor)

As regras que antes eram constantes no front ficam na tabela `configuracoes` e são editáveis em **Gestão → Configurações** (só administrador): pontos por R$ 1, bônus de indicação, pontos e valor do resgate, horário de abertura e fechamento, dias fechados, horários oferecidos no site, dias para "sem retorno", antecedência mínima, dias exibidos no agendamento e domínio do link de indicação.

- **Disponibilidade** (`services/agenda.service.ts`): mesmas regras do protótipo (`slotFree`/`bookingDays`). "Sem preferência" escolhe o profissional com menor carga no dia. Hoje só entra na lista se ainda houver 3 horários livres.
- **Sem dupla reserva**: cada gravação trava o dia (`pg_advisory_xact_lock`) e confere sobreposição por profissional dentro da transação. Três reservas simultâneas no mesmo horário: uma passa, duas recebem 409.
- **Conclusão** (`concluir`): só hoje ou datas passadas; aplica o benefício disponível (um por atendimento); credita `pontos = (preço − desconto) × pontos por real`, uma vez por atendimento (linha travada + índice único no extrato); no primeiro atendimento concluído de um indicado, libera o bônus para quem indicou.
- **Resgate**: consome os pontos e cria o benefício, com trava por cliente (dois cliques simultâneos não gastam o saldo duas vezes).
- **Reativar cancelado**: confere de novo se o horário ainda está livre.
- **Indicadores** (`lib/base.ts`): `metrics()` e `periodRange()` com as mesmas fórmulas do protótipo. Ocupação = minutos agendados ÷ (profissionais × horas abertas por dia × dias abertos).
- **Agendamentos guardam nome, duração e preço dos serviços** no momento da reserva. Mudar preço não altera o que já foi marcado.

### Conta do cliente

- Agendar não exige conta: o cliente é identificado pelo telefone. Telefone novo cria o cadastro; se a pessoa informar uma senha, a conta é criada e ela já entra logada.
- Telefone já cadastrado e sem login: o agendamento entra no cadastro existente, sem alterar nome, e-mail ou senha dele.
- Clube e Perfil exigem **telefone + senha** (token separado do da equipe). Ninguém vê pontos de outra pessoa só digitando um telefone.
- Quem já era cliente e não tem senha (cadastrado no balcão, por exemplo) pede na barbearia um **código de primeiro acesso** (Gestão → cliente → Gerar código de acesso, válido por 48 h) e cria a senha em Perfil → "Tenho um código".

### Perfis da equipe

| Perfil | Pode |
|---|---|
| Operador | Agenda (registrar, confirmar, concluir, cancelar), clientes, fidelidade, oportunidades. |
| Gerente | O que o operador faz, mais serviços e profissionais. |
| Administrador | Tudo, mais regras do negócio e acessos da equipe. |

---

## 5. API

Todas as rotas ficam em `/api`. Respostas em JSON; erro vem como `{ "error": "mensagem" }`.

| Grupo | Rotas |
|---|---|
| Saúde | `GET /health` |
| Equipe | `POST /auth/login`, `GET /auth/me`; `GET/POST /usuarios`, `PUT /usuarios/:id` (admin), `POST /usuarios/senha` |
| Site (sem login) | `GET /publico/catalogo`, `GET /publico/disponibilidade?serviceIds=a,b&proId=any`, `GET /publico/indicacao/:codigo`, `POST /publico/agendamentos` |
| Conta do cliente | `POST /conta/entrar`, `POST /conta/primeiro-acesso`; com token: `GET/PUT /conta`, `POST /conta/senha`, `POST /conta/resgatar`, `PUT /conta/agendamentos/:id`, `POST /conta/agendamentos/:id/cancelar` |
| Gestão (token da equipe) | `GET /gestao/painel?periodo=hoje\|7\|30`, `GET /gestao/contadores`, `GET /gestao/agenda?data=`, `POST /gestao/agendamentos`, `GET /gestao/agendamentos/:id`, `PATCH /gestao/agendamentos/:id/status`, `GET /gestao/clientes`, `GET /gestao/clientes/busca?q=`, `GET/PUT /gestao/clientes/:id`, `POST /gestao/clientes/:id/codigo-acesso`, `GET /gestao/fidelidade`, `GET /gestao/oportunidades`, `GET /gestao/catalogo`, `POST/PUT/DELETE /gestao/servicos[/:id]` e `/gestao/profissionais[/:id]` (gerente), `GET/PUT /gestao/configuracoes` (alterar: admin) |

---

## 6. Testes

Com a API e o site rodando localmente (seção 2):

```bash
npm run typecheck   # backend, api/index.ts e prisma/*.ts
npm run test:api    # 50 verificações: login, CRUD, agendamento, dupla reserva, pontos, indicação, resgate, métricas, privacidade
npm test            # navegador (Chrome instalado): fluxo do cliente e da gestão em celular e desktop, sem erros no console
```

`npm test` aceita `SITE_URL` (padrão `http://localhost:8092`) e `SO=celular` ou `SO=desktop`. Os testes criam clientes e agendamentos com nomes aleatórios: rode-os só em banco local ou de teste.

---

## 7. Licenças e créditos

- **Código:** SMG (Smart Management Group).
- **Marca, logo e fotografias:** pertencem à Cidade Nobre.
- **Fontes:** Newsreader e Figtree, sob SIL Open Font License 1.1 (ver `assets/fonts/LICENSE-*.txt`).

### Versões

- **2.0.0 (30/10/2026):** sistema real: API com banco PostgreSQL, conta do cliente, gestão com login, regras configuráveis, deploy na Vercel. Removidos os dados de demonstração.
- **1.0.x (outubro/2026):** protótipo navegável só com front-end e dados fictícios.
