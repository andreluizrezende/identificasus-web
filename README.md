# IdentificaSUS — console da Central de Regulação

[![CI](https://github.com/andreluizrezende/identificasus-web/actions/workflows/ci.yml/badge.svg)](https://github.com/andreluizrezende/identificasus-web/actions/workflows/ci.yml)

Aplicação web, para computador, em que a Central de Regulação do SAMU 192
Salvador trabalha os casos de pessoas não identificadas que chegaram do campo.
É o lugar onde se decide vínculo, e por isso é o único módulo que vai mostrar
comparação de candidatos (o app de campo é proibido de mostrar,
regra `campo-nao-importa-motor` do `identificasus-app`).

| Repositório | Papel |
|---|---|
| `identificasus-app` | PWA/APK de captura em campo, nas bases e viaturas |
| `identificasus-web` | este console, nas estações da central |
| `identificasus-backend` | API NestJS que os dois consomem |

## O que já existe

| Tela | Rota | API |
|---|---|---|
| Entrar | `/entrar` | `POST /api/sessao` |
| Fila da regulação | `/fila` | `GET /api/regulacao/fila` |
| Detalhe do caso | `/casos/:coCaso` | `GET /api/regulacao/casos/:coCaso` |

- **Fila:** casos em `ANALISE` ou `ADJUDICACAO`, do prazo mais apertado para o
  mais folgado. O caso entra na fila quando a equipe fecha a captura no
  app de campo (decisão de 02/10/2026; `db/09` no backend). Prazo ainda não é
  definido por regra nenhuma: caso sem prazo vai para o fim da fila. Mostra só código, estado, base, data, completude e prazo
  (minimização, LGPD art. 6º, III).
- **Detalhe:** local e destino da ocorrência, atributos agrupados como no
  protocolo, com procedência (observado, informado, estimado), autor e hora de
  cada um, e o histórico de estados. Caso ainda em campo ou já decidido
  responde como "não está na fila".
- Cada consulta da fila e cada abertura de caso ficam na trilha de auditoria
  (`mob_auditoria`, finalidade `ADJUDICACAO`), gravadas pelo backend.

**Ainda não existe:** comparação de candidatos, dupla conferência e
adjudicação. O banco não tem fonte de candidatos (desaparecidos, registros
hospitalares etc.); de onde eles vêm é a decisão que destrava essa etapa.

## Stack

React 18 · Vite 7 · TypeScript strict · Zod · React Router 7 · Vitest ·
Testing Library · Playwright · dependency-cruiser

Sem PWA e sem modo offline, de propósito (ver `vite.config.ts`): a central
trabalha com rede, e cache de dado de caso numa estação compartilhada seria só
risco.

## Rodar

Requer Node na versão fixada em `.nvmrc` (22+) e o `identificasus-backend`
rodando.

```bash
npm install
npm run dev               # http://localhost:5174 (5173 é do app de campo)
```

O Vite repassa `/api` para `http://localhost:3000`. Se o backend estiver em
outra porta (nesta máquina ele roda na 3001, ver `.env` do backend):

```bash
VITE_API_ALVO=http://localhost:3001 npm run dev
```

### Conta para entrar em desenvolvimento

No backend, `npm run semear-ambiente-local` cria duas contas de teste. A do
console é a de finalidade `ADJUDICACAO` (e-mail e senha no próprio script,
`scripts/semear-ambiente-local.ts`). O **código da estação** é um dos
aparelhos de `db/04_homologacao.sql`, por exemplo `APAR-HOM-0002`.

> **A conta de campo não entra no console.** A finalidade é da conta
> (`mob_usuario.co_finalidade`), e toda rota da regulação exige
> `ADJUDICACAO`. Uma conta `ASSISTENCIAL` recebe "Seu acesso não é da Central
> de Regulação".

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | typecheck + build de produção |
| `npm run typecheck` | checagem de tipos (inclui `e2e/`) |
| `npm run lint` | ESLint |
| `npm run lint:arquitetura` | fronteiras de módulo (dependency-cruiser) |
| `npm test` | testes de unidade (Vitest + Testing Library) |
| `npm run e2e` | testes de interface (Playwright, Chromium, 1366×768) |

## Testes

**Unidade** (`src/**/*.test.ts(x)`), em jsdom:

| Arquivo | Cobre |
|---|---|
| `dominio/prazo.test.ts`, `dominio/datas.test.ts` | texto e cor do prazo, nomes dos estados, horário de Salvador |
| `servicos/sessao.test.ts` | entrar, `sessionStorage`, renovação única, sair sem rede |
| `servicos/api.test.ts` | token no cabeçalho, renovação e repetição no 401, validação Zod |
| `servicos/regulacao.test.ts` | URLs, código codificado, escore e candidatos descartados pelo esquema |
| `telas/*.test.tsx` | Entrar, Fila e Caso: estados de carga, erro, 401 e 404 |
| `componentes/componentes.test.tsx` | `Protegida` e `Moldura` |

**Interface** (`e2e/`), com Playwright. O backend é simulado com `page.route`
(`e2e/apoio.ts`), com respostas no formato real da API: os testes não dependem
de API nem de banco no ar.

| Arquivo | Cobre |
|---|---|
| `entrar-e-sair.spec.ts` | recusa, pedido de entrada, sessão só na aba, volta ao caso depois de entrar, sair |
| `fila-e-caso.spec.ts` | fila, detalhe do caso, caso fora da fila, sessão encerrada, navegação por teclado |

> **Dublê de serviço nos testes de tela é função comum, e não `vi.fn` que
> devolve promessa rejeitada.** O Vitest 4 acompanha a promessa devolvida pelo
> `vi.fn`, e a rejeição aparece como "não tratada" mesmo com a tela pegando o
> erro. Ver o comentário em `telas/Caso.test.tsx`.

## CI

`.github/workflows/ci.yml` é o mesmo do `identificasus-app`: roda a cada push
na `main` e em todo pull request, dentro da imagem oficial do Playwright, com o
Node do `.nvmrc`. Typecheck, lint, lint de arquitetura, testes de unidade,
build e testes de interface.

**Para atualizar o Playwright**, mude no mesmo commit a versão de
`@playwright/test` no `package.json` (fixa, sem `^`) e `container.image` e
`VERSAO_DA_IMAGEM` no `ci.yml`. Se divergirem, o CI para com uma mensagem
dizendo isso.

## Estrutura

```
src/
├── dominio/       regras puras: prazo, datas, nomes de estado
├── servicos/      sessão, cliente HTTP e serviço da regulação (Zod em toda resposta)
├── componentes/   Moldura (barra do console) e Protegida (exige sessão)
├── telas/         Entrar, Fila, Caso
└── estilos/       tokens (os mesmos do app de campo) e CSS global
e2e/               testes de interface e o backend simulado
```

Em produção (`vercel.json`), `/api` é repassado para o backend na mesma origem:
proxy, e não CORS, como no app.

## Produção

Publicado em **https://identificasus-web.vercel.app** (projeto
`identificasus-web` na Vercel, ligado a este repositório: push na `main`
publica sozinho). Não há variável de ambiente: o endereço do backend está no
`vercel.json`, e o console não guarda segredo nenhum.

O backend escolhe o banco pela finalidade, e a do console é ADJUDICACAO: sem
`DATABASE_URL_ADJUDICACAO` em Production no projeto do backend, toda rota do
console responde 500 (ver `PENDENCIAS.md` do backend).

As estações entram com o código cadastrado em `mob_dispositivo`. Enquanto a
SMS não manda a lista oficial, vale o de homologação: `APAR-HOM-0005`.

## Regras que o código precisa preservar

**Sessão em `sessionStorage`, nunca em `localStorage`.** A estação da central é
compartilhada por turno. Fechar a aba encerra o acesso no navegador, e quem
senta depois não herda a sessão de quem saiu sem clicar em "Sair". Um teste de
unidade e dois de interface falham se isso mudar.

**"Sair" tira o acesso desta tela já.** A sessão local é apagada antes de
avisar o servidor, e sai mesmo sem rede.

**Telas não falam com a rede direto.** Passam por `servicos/`, onde a resposta
é validada com Zod antes de virar dado de tela (regra `telas-sem-fetch-direto`).
O esquema descarta o que não conhece: um campo de escore que aparecesse na
resposta não chegaria à tela sem alguém mudar o contrato de propósito.

**O domínio é folha.** `dominio/` não importa tela, serviço nem componente
(regra `dominio-e-folha`).

**Redirecionamento só para caminho interno.** O "voltar para onde ia" depois
de entrar aceita só caminho que começa com uma barra e não com duas. Endereço
externo cai na fila.

**Horário da central.** Carimbos do servidor (captura, transição) são gravados
em UTC e exibidos em `America/Bahia`. A data e a hora da ocorrência são as do
registro e aparecem como vieram.
