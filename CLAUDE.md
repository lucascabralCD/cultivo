# Cultivo — Diário & Adubação (contexto do projeto)

App web de página única (offline-first) para gestão de fertirrigação e diário de regas de cultivo.
Este arquivo serve de handoff/contexto: coloque-o na raiz do repositório para o Claude Code (ou outro editor) entender o projeto.

## Links e arquivos
- Repositório: https://github.com/lucascabralCD/cultivo
- Página ao vivo (GitHub Pages): https://lucascabralcd.github.io/cultivo/cultivo.html
- Arquivos no repo:
  - `cultivo.html` — o app inteiro (HTML+CSS+JS num só arquivo, sem dependências externas).
  - `version.json` — manifesto de versão para o "verificar atualizações".
  - `qr_cultivo.png` — QR que aponta para a página ao vivo (opcional no repo).

## Arquitetura
- **Single-file**: todo CSS e JS embutidos em `cultivo.html`. Sem build, sem libs externas (funciona offline).
- **Persistência**: `localStorage`, chave `cultivo_v1`, objeto `mem = {pots:[], entries:[], cal:1}`.
  - `pots`: lista de vasos, cada um um objeto `{name, strain, origin:'semente'|'clone', type:'foto'|'auto', substrate, volume, start}` (`start` = data de início ISO `YYYY-MM-DD`). A identidade do vaso é o `name` (os `entries` referenciam pelo nome; renomear no Jardim propaga aos registros). `migratePots()` converte vasos antigos (que eram só strings) para objetos automaticamente no load/import.
  - `entries`: registros de rega (ver estrutura abaixo).
  - `cal`: fator de calibração da tabela de dosagem (1 = original).
- **UI em abas** (nav inferior): Adubar, Registrar, Painel, Jardim, Histórico, Mais.
  - **Jardim**: cadastro completo de vaso (nome, estirpe/genética, semente ou clone, fotoperíodo ou automática, substrato, volume, data de início) + lista dos vasos com a idade calculada até hoje. `ageOf(startISO)` devolve `{months, weeks, days, totalDays, totalWeeks}`; `ageLabel()` formata "X meses, Y semanas e Z dias · N dias no total". Suporta editar/remover. Substituiu o antigo card "Vasos" da aba Mais.
- **Idioma**: PT-BR. **EC sempre em µS/cm** (não mS/cm).

## Domínio / agronomia (regras que o app implementa)

### Kit de fertilizantes do usuário (4 produtos sólidos)
Composição usada nos cálculos (% do elemento no produto):
- **Plant Prod 7-11-27**: N 7 · P(elem) 4,80 · K(elem) 22,41 · Mg 3,75 · S 5,6 (+ micros)
- **Nitrato de Cálcio (~15,5-0-0)**: N 15 · Ca 19
- **MKP (fosfato monopotássico)**: P(elem) 22,48 · K(elem) 28,22
- **Sulfato de Magnésio (escamas)**: Mg 9 · S 12
- Conversões: P = P2O5 × 0,4364 ; K = K2O × 0,8301.

### Ordem de mistura (crítico)
1) Plant Prod → 2) MKP → 3) Sulfato de Magnésio → 4) **Nitrato de Cálcio diluído à parte e adicionado por último** (nunca misturar nitrato de cálcio concentrado direto com fosfatos/sulfatos — precipita). Ajustar o pH por último.

### Tabela de dosagem base (gramas por 10 L) e EC-alvo (µS/cm)
| Fase (key) | PP | NitCa | MKP | MgSO4 | EC-alvo µS/cm |
|---|---|---|---|---|---|
| muda | 2,9 | 1,9 | 0 | 0 | 600–900 |
| inicio | 5,2 | 3,5 | 0 | 0 | 1000–1200 |
| vegpleno | 7,5 | 5,0 | 0 | 0 | 1400–1600 |
| transicao | 7,5 | 4,5 | 1,5 | 1,5 | 1500–1700 |
| floinicio | 7,5 | 3,5 | 2,0 | 2,0 | 1600–2000 |
| flopico | 7,0 | 3,0 | 2,5 | 2,0 | 1700–2000 |
| flofinal | 6,0 | 2,0 | 2,5 | 1,5 | 1300–1600 |
| flush | 0 | 0 | 0 | 0 | só água |

Gramas para volume V = base × V/10 × `mem.cal`. pH-alvo sempre 6,0–6,5 (uso 6,3).

### ppm — cuidado
Não usar ppm da calda para dosar: a conversão EC→ppm depende do fator do medidor (500 NaCl / 640 KCl / 700 EC×700), então o mesmo líquido "muda" de ppm. Dose por EC (µS/cm). O medidor do usuário parece usar fator ~500 (calda deu 2110 µS/cm ≈ 1100 ppm). O ppm SÓ é usado no teste químico de N/P/K (o kit dá valor em ppm) — esses campos no Diário são numéricos em ppm.

### Calibração da tabela (auto-ajuste)
A partir da EC medida da calda de uma fase, fator = (midpoint EC-alvo da fase) / (EC medida). `mem.cal` novo = `mem.cal` atual × fator (cumulativo, converge). Aplica a todas as fases. **Só altera após confirmação do usuário** (mostra prévia antes→depois). Reset volta cal=1.

### Correção de calda pronta
- **Água p/ baixar EC**: volume final = V × EC_atual / EC_alvo; água a adicionar = final − V (diluição linear, aproximada).
- **Subir pH** (< 6,0): Hidróxido de Potássio (KOH) em **gramas** (escamas). Dose inicial ≈ Vf × (6,3 − pH) × 0,02. Dissolver à parte, ir aos poucos, medir. Cáustico.
- **Baixar pH** (> 6,5): Ácido fosfórico em **mL**. Dose inicial ≈ Vf × (pH − 6,3) × 0,1 (para pH Down diluído; se ácido 85%, começar com gotas).
- Todas são doses INICIAIS + iterar/medir (a calda tem tampão de fosfato).

### Lógica de recomendação/alerta (aba Registrar / Painel)
Limiares (µS/cm e pH), função `evaluate(e)`:
- CRÍTICO: EC saída ≥ 3500, ou pH ≤ 5,0 ou ≥ 7,5 → flush pesado.
- FLUSH: (EC saída − EC entrada) ≥ 1000, ou EC saída ≥ 2500 → 1–2 regas só água.
- ATENÇÃO: (saída − entrada) ≥ 500, ou pH < 6,0/> 6,5 → próxima rega só água / ajustar pH.
- OK: dentro das faixas → seguir programa. Se (saída − entrada) ≤ −300 → "pode subir dose ~10%".
- Sem dados de saída (pH/EC) → sem alerta.
- N/P/K em ppm são registrados mas NÃO disparam alertas automáticos (faltam faixas de referência do kit — TODO).

### Estrutura de um registro (`entries[]`)
`{id, date, pot, phase, phIn, ecIn, phOut, ecOut, nOut, pOut, kOut, runoff, obs, alert, rec}`
- Painel mostra o último registro por vaso via a função `lastByPot`.

## Versionamento e atualização
- `const APP_VERSION='1.0001'` e `const APP_DATE` no topo do `<script>`.
- Mostrado no cabeçalho (v1.0001) e em Mais → Atualizações.
- `checkUpdate()` faz `fetch('version.json?t='+Date.now())`, compara `parseFloat(version)` e, se maior, mostra `changes[]` e botão que chama `doUpdate()` (recarrega com cache-buster).
- **Ao publicar nova versão, subir SEMPRE os dois**: `cultivo.html` (com APP_VERSION maior) e `version.json` (mesma versão + lista de mudanças).

## Deploy
GitHub Pages (branch main, /root). Publicar = GitHub → repo → Add file → Upload files → arrastar `cultivo.html` e `version.json` → Commit. QR não muda (mesma URL).

## Limitações / TODO (ideias para continuar)
- N/P/K: definir faixas de referência do kit (baixo/adequado/alto em ppm) para reativar alertas automáticos de nutriente.
- Sem service worker (PWA "de verdade") — a persistência depende do localStorage do navegador; há Exportar/Importar JSON para backup.
- Estimativa de EC da receita é por coeficiente (aproximada) — a calibração corrige na prática.
- Possível: ícone/manifest PWA, gráfico de histórico de EC/pH por vaso, multi-idioma.

## Como continuar no Claude Code
1. Clonar o repo: `git clone https://github.com/lucascabralCD/cultivo`
2. Colocar este `CLAUDE.md` na raiz (se ainda não estiver) e commitar.
3. Na pasta do repo, rodar `claude` — ele lê o `CLAUDE.md` e já entende o projeto, com acesso a git/GitHub para commitar e publicar direto.
