# Cidade Nobre — Protótipo do ecossistema digital (SMG)

Protótipo front-end navegável para a **Cidade Nobre — Barbearia Premium**. Ele reúne dois ambientes conectados aos mesmos dados:

- **Experiência do cliente:** Início, Serviços, Agendamento (profissional, dia e horário), Dados, Confirmação, Clube Cidade Nobre e Perfil.
- **Gestão da barbearia:** Visão geral, Agenda, Clientes, Serviços e equipe, Fidelidade e Oportunidades de retorno.

Não há backend, login nem integrações reais. Todos os dados são fictícios e ficam salvos apenas no navegador de quem abre (localStorage).

---

## 1. Abrir e enviar

| Arquivo | Para que serve |
|---|---|
| `dist/Cidade-Nobre-Prototipo-SMG.html` | **Arquivo para o cliente.** É um HTML único e autônomo, com fontes, imagens e código embutidos. Abre offline no Chrome, Safari, Edge ou Firefox e também pode ser hospedado em qualquer servidor estático (Netlify, Vercel, S3, cPanel). |
| `dist/cidade-nobre-artifact.html` | Mesmo conteúdo no formato de Artifact do Claude (sem `<html>`/`<head>`). |

No celular, o arquivo deve ser salvo e aberto no navegador. A pré-visualização de anexos do WhatsApp ou do e-mail costuma não executar JavaScript.

---

## 2. Estrutura

```
cidade-nobre-prototipo/
├── src/                      código-fonte (HTML/CSS/JS puro, sem framework)
│   ├── core.js               utilidades, dados de demonstração, store, regras e métricas
│   ├── icons.js              ícones SVG em linha
│   ├── client.js             telas do cliente
│   ├── admin.js              telas da gestão
│   ├── main.js               renderização, eventos, modais, toasts
│   ├── styles.css            identidade visual e layout (mobile-first)
│   └── index.tpl.html        template usado pelo build
├── assets/                   imagens finais + fontes (assets/fonts)
├── referencias/              as 4 telas aprovadas (base dos recortes)
├── ferramentas/assets/       scripts que geram assets/ a partir de referencias/
├── testes/                   testes automatizados (Playwright + simulação de datas)
├── dist/                     arquivos finais gerados pelo build
├── dev.html                  modo de desenvolvimento (carrega src/ direto)
├── build.py                  gera dist/ (só biblioteca padrão do Python)
└── package.json              atalhos npm para build e testes
```

---

## 3. Desenvolvimento

```bash
# 1. editar com recarregamento simples
python3 -m http.server 8000        # ou: npm run dev
# abrir http://localhost:8000/dev.html, editar src/ e recarregar a página

# 2. gerar os arquivos finais
python3 build.py                   # ou: npm run build
```

O `dev.html` precisa de um servidor local. Aberto direto pelo arquivo, alguns navegadores bloqueiam as fontes.

### Como o código funciona

- **Renderização:** cada tela é uma função que devolve HTML (`vHome`, `vServicos`, `vAgendar`, `vClube`, `vDash`, `vAgenda` etc.). `render()` em `main.js` redesenha o app a partir do estado.
- **Eventos:** há um único listener de clique, que usa delegação por atributos.
  - `data-go="tela"` navega entre telas.
  - `data-act="acao"` executa ações; a lista completa está no `switch` de `main.js`.
- **Estado:** a variável `DB` guarda os dados do negócio e a `UI` guarda a navegação, os filtros e o rascunho do agendamento. Os dois são salvos no localStorage, nas chaves `cn-demo-data-v4` e `cn-demo-ui-v4`.
- **Dados novos a cada apresentação:** a base é recriada automaticamente quando tem mais de 2 dias, com datas recalculadas a partir de hoje. Também pode ser recriada a qualquer momento por **Menu → Restaurar dados da demonstração**.

### Entidades e relações (`core.js`)

| Entidade | Campos principais | Relações |
|---|---|---|
| `clients` | nome, telefone, e-mail, código de indicação | `referredBy` → cliente |
| `services` | nome, categoria, duração, preço, visível no site | `cat` → categoria |
| `pros` | nome | `services[]` → serviços que realiza |
| `appts` (agendamentos) | data, hora, duração, preço, desconto, status, origem | `clientId`, `proId`, `serviceIds[]` |
| `moves` (pontos) | tipo (serviço, indicação, resgate), pontos, data | `apptId` ou `referralId` |
| `referrals` (indicações) | status (pendente/concluída) | quem indicou, indicado, `apptId` que liberou |
| `vouchers` (benefícios) | valor, status (disponível/utilizado) | cliente, atendimento em que foi usado |

### Regras (todas centralizadas em `core.js`)

- **Pontos por serviço:** 1 ponto por R$ 1 pago. O crédito só acontece quando o atendimento é **concluído**, uma vez por atendimento (`conclude()`).
- **Pontos por indicação:** +50 para quem indicou, liberados no primeiro atendimento concluído do indicado. Copiar ou compartilhar o link não gera pontos.
- **Resgate:** 250 pontos geram R$ 20 de desconto (`redeem()`). O desconto é aplicado no próximo atendimento concluído.
- **Indicadores da gestão:** calculados apenas por `metrics()` e `periodRange()`, para que um mesmo número nunca seja calculado de dois jeitos diferentes. Ocupação = minutos agendados ÷ (profissionais × 10 h por dia aberto).

### Onde mudar cada coisa

| Quero mudar | Onde |
|---|---|
| Serviços, preços, durações, descrições | `baseServices()` em `core.js` |
| Profissionais e o que cada um faz | `pros` dentro de `seed()` em `core.js` |
| Horários exibidos no agendamento | `SLOT_TIMES` em `core.js` |
| Horário de funcionamento / dias fechados | `OPEN`, `CLOSE` e `isOpen()` em `core.js` (domingo fechado) |
| Regra de pontos, meta e benefício | `benefit` e `rules` no `return` de `seed()` em `core.js` |
| Dias para considerar "sem retorno" | `LAPSE_DAYS` em `core.js` |
| Domínio do link de indicação | `REF_DOMAIN` em `core.js` |
| Cores, tipografia, espaçamentos | variáveis `:root` no topo de `styles.css` |
| Avisos de "dados ilustrativos" no rodapé | `NOTES` em `client.js` |
| Trocar uma imagem | substituir o arquivo em `assets/` (mesmo nome) e rodar `python3 build.py` |

Depois de mudar dados em `core.js`, use **Restaurar dados da demonstração** ou limpe o localStorage para ver a base nova.

### Caminho para um sistema real

As funções de `core.js` já separam leitura de escrita e são o ponto natural de troca por uma API:

- **Leitura:** `load()`, `clientStats()`, `club()`, `metrics()`, `bookingDays()`, `slotFree()`.
- **Escrita:** `commitBooking()`, `setStatus()`, `conclude()`, `redeem()`.

As telas não acessam o armazenamento diretamente.

---

## 4. Testes

```bash
npm install
npx playwright install chromium

npm test            # fluxos completos no arquivo de dist/ (celular, tablet, desktop)
npm run test:dev    # os mesmos fluxos usando src/ sem build
npm run test:datas  # gera a base em 366 dias × 3 horários e confere o roteiro da demonstração
npm run comparar    # imagens lado a lado (referência | protótipo) em build/comparacao/
```

`npm test` cobre os 14 cenários do briefing, mais persistência e ausência de erros no console. São 99 verificações no total.

---

## 5. Regerar as imagens a partir das referências

```bash
pip install -r ferramentas/requirements.txt
python3 ferramentas/assets/extrair_todos.py   # escreve em assets/ e as máscaras de conferência em build/debug/
python3 build.py
```

Os scripts recortam a logo, a logo horizontal, as fotos de topo (removendo os textos por inpainting), as miniaturas de serviços e categorias, a coroa d'água e os ícones. **Com os arquivos originais da marca e das fotos, basta colocá-los em `assets/` com os mesmos nomes. A qualidade melhora bastante, porque os recortes atuais vêm de prints de tela.**

---

## 6. Roteiro sugerido para a apresentação

1. **Clube:** abrir o Clube. O Lucas (perfil demonstrativo) tem 180 pontos e faltam 70 para o resgate.
2. **Agendamento:** fazer um agendamento pelo site. Na confirmação, tocar em "Ver como a barbearia recebe".
3. **Indicação:** na Agenda de hoje, concluir o atendimento do **Diego** (15h). Ele foi indicado pelo Lucas, que ganha +50 pontos.
4. **Resgate:** concluir o atendimento do **Lucas** (17h30). Ele ganha +45, chega a 275 pontos e o resgate de R$ 20 é liberado.
5. **Antes de cada apresentação:** Menu → Restaurar dados da demonstração.

**Limitação conhecida:** aos domingos a barbearia aparece fechada, então os atendimentos do roteiro vão para segunda-feira e só podem ser concluídos nesse dia.

---

## 7. Licenças e créditos

- **Código:** SMG (Smart Management Group).
- **Marca, logo e fotografias:** pertencem à Cidade Nobre e foram usados somente para esta demonstração.
- **Fontes:** Newsreader e Figtree, sob SIL Open Font License 1.1 (ver `assets/fonts/LICENSE-*.txt`).
- **Dados:** todos os nomes, telefones, valores, horários e indicadores são fictícios.

### Versões

- **1.0.2 (30/10/2026):** corrige a falha ao abrir o protótipo às sextas-feiras (data do roteiro que caía em domingo). Inclui a simulação de datas nos testes.
- **1.0.1 (27/10/2026):** arquivo autônomo para envio. Inclui uma cópia alternativa para o botão "Copiar link" quando o arquivo é aberto direto do computador.
- **1.0.0 (24/10/2026):** primeira versão.
