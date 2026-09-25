# Irlanda — roteiro (app)

App de celular (PWA, offline-first, tema escuro) com o roteiro dos 21 dias na Irlanda e no Porto, 25/09–15/10/2026, e o Claude embutido para replanejar na estrada.

**Endereço ao vivo (GitHub Pages):** https://lucascabralcd.github.io/cultivo/irlanda/ (publica quando esta pasta chegar à branch `main`)

**Versão claude.ai, sem instalar nada:** https://claude.ai/artifact/85xFYoSAqyxFnc5Ce6ZXFk — a mesma página, logado na sua conta; o Claude responde pela própria conta (sem chave da API, sem pesquisa na web, precisa de rede). O estado (feitos, notas) fica no navegador e não passa para a versão instalada.

## Instalar no Android (2 minutos)

1. Abra o endereço acima no **Chrome** do celular.
2. Menu **⋮ → Adicionar à tela inicial** (ou o aviso "Instalar app" que aparece embaixo).
3. Abra pelo ícone ☘️. Fica em tela cheia e funciona **sem rede** (o plano inteiro está no aparelho).

## Ligar o Claude

1. Em https://console.anthropic.com/settings/keys crie uma chave (`sk-ant-…`). A conta precisa ter créditos em *Billing*.
2. No app: **⚙️ → chave da API → Salvar**.
3. A chave fica só no celular e as chamadas vão direto para a Anthropic (não passa por servidor nenhum).

Modelos: Opus 5 (padrão), Sonnet 5 (mais rápido), Haiku 4.5 (mais barato). "Pesquisar na web" deixa o Claude conferir horários e notícias em sites irlandeses.

## O que o app faz

- **Hoje** — o que fazer agora (com contagem para o próximo), a lista do dia com ✓ feito, lembretes com hora, o que ficou para depois, avisos, etiqueta do dia e o que mais rola no país.
- **Não consegui** em qualquer item → *fazer depois* (+1h, hoje às…, amanhã, outro dia, pendente), *outra sugestão* (alternativas já pesquisadas no plano + o Claude) ou *novo pedido ao Claude* (ele responde com sugestões que viram itens do dia num toque).
- **Dias** — os 21 dias completos: adiar, mover, dar hora, notas, itens seus.
- **Claude** — conversa com o plano inteiro, as regras, as pendências e o estado de hoje no contexto.
- **Pendências** — reservas por urgência e lembretes com link para o Google Agenda.
- **Mais** — telefones (toque para ligar), dúvidas abertas, o que está travado, o carro, a última noite, etiqueta, calendário do país, mapas, backup, configurações.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | casca do app: HTML + CSS |
| `app.js` | toda a lógica (estado, telas, fluxos, prompt do Claude) |
| `claude.js` | cliente da API da Anthropic (stream, web search, erros) |
| `data.js` | **gerado** — plano + enriquecimento + textos para o Claude |
| `sw.js` | service worker (cache versionado, offline) |
| `manifest.webmanifest`, `icons/` | PWA |
| `maps/` | SVGs das rotas (Irlanda, Connemara, West Cork) |
| `src/plano.json` | os 21 dias e 125 eventos (fonte) |
| `src/conteudo-completo.json` | tudo o mais: pendências, dúvidas, etiqueta, calendário… |
| `src/enrich.json` | títulos curtos, tipo (ação/contexto), lugar, alternativas por evento |
| `src/handoff.md` | o documento do projeto (vira o briefing do Claude) |
| `build/make-data.js` | gera `data.js` e carimba a versão em `sw.js` |
| `VERSION` | versão do app (muda → o service worker atualiza os aparelhos) |

## Atualizar o app

1. Edite `src/plano.json` (ou qualquer fonte em `src/`).
2. Suba o número em `VERSION` (ex.: `1.0.1`).
3. Rode `node irlanda/build/make-data.js` na raiz do repositório.
4. Faça commit de `data.js`, `sw.js` e do que mudou. Nos aparelhos, o app avisa "versão nova pronta" e recarrega.

## Estado no aparelho

`localStorage['irl.app.v1']` = `{ov, ex, ck, chat, cfg, key, misc}`. `ov[id]` guarda `{s: done|skip|miss|later, t: 'HH:MM', d: 'YYYY-MM-DD', n: nota, why, res}`; `ex` são itens acrescentados (seus, alternativos ou do Claude). **Backup** em Mais exporta tudo (sem a chave).
