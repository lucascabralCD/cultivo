# Irlanda + Porto 2026 — handoff para construir o app

Este pacote é a memória inteira de um planejamento de viagem feito em conversa com o Claude (Cowork) entre agosto e 24/09/2026. O objetivo agora é **construir um app** a partir dele. Tudo o que está aqui foi pesquisado em fonte oficial ou irlandesa e passou por várias rodadas de decisão do Lucas — trate o conteúdo como **decidido**, não como sugestão a rediscutir. As decisões têm o "por quê" registrado na seção 6; se algo parecer estranho, o motivo provavelmente está lá.

Leia nesta ordem: este arquivo inteiro → `plano.json` (os dados já normalizados) → `paginas/roteiro-app-artifact.html` (o app que já existe e funciona) → o resto conforme precisar.

---

## 1. Quem é o Lucas e as regras que ele deu

**Lucas Almeida Cabral**, 36, brasileiro, mora em Goiás, viaja **sozinho**, inglês fluente. Interesses declarados: natureza, tecnologia, história, cerveja e principalmente gastronomia. Em forma, topa esforço físico. Tem uma amiga irlandesa em Dublin, a **Priscila**, e o namorado dela, o **Richie**, irlandês, que revisaram o plano inteiro.

Estas frases dele são as regras do projeto. Qualquer app tem de respeitá-las:

- *"Se tem uma coisa que eu gosto é de cabaré e bagaceira, eu sou uma pessoa que gosta do simples, gosto duvidoso."* Banheiro de esgoto não incomoda. Bingo foi "sensacional". Quer **conhecer gente de verdade em lugares autênticos, estudando muito como respeitá-los**.
- **A regra do Cristo Redentor** (a correção mais importante, dada em ~17/09): *"não tenho alergia a turista, só que o que valha a pena, se algo for imperdível, mesmo sendo turístico eu tenho que ir, como o Cristo Redentor do Rio. A questão são lugares que não valem a pena e os turistas vão somente para tirar fotos, como a Fontana di Trevi, quando você chega é uma decepção. Um exemplo claro em Dublin é o Temple Bar."* O filtro é **entrega × só foto**, não "turístico × local". Por isso os Cliffs of Moher entraram e o Temple Bar nunca entra.
- **Música:** ele **nunca** elevou a música tradicional a atração. A frase *"jamais iria em um show de rock estando na Irlanda, e show só se fosse de música cultural regional"* era uma **condição**, não entusiasmo. Uma versão anterior do plano errou feio pondo um clube de canto à capela como motivo de ir a Cork, e ele reclamou: *"isso não é de longe o maior motivo, pode fazer parte."* Regra vigente: **música é pano de fundo de pub; no máximo uma ida sentada; nenhum show pago.** Cerveja, natureza e cultura antes de vida noturna.
- **Como trabalhar com ele:** *"Vamos construir esse plano juntos, sem criar tudo e ir me falando o que devo fazer, me faça perguntas quantas julgar necessárias"* · *"não quero tudo agora, vamos montando por parte, porque se você cria tudo agora fica tudo enviesado para o que você já criou"* · *"faça mais perguntas aqui diretamente no chat caso você tenha duas coisas que você ache interessantes mas são conflitantes"* · *"leve em consideração as observações anteriores, junto com essas novas, não isole só pelos pedidos recentes"* · *"Gaste o tempo e tokens que for necessário para essa pesquisa, e nada de preguiça! Pesquise preferencialmente em sites irlandeses, atualizados, e fontes oficiais."*
- **Contas:** *"se quiser usar a minha conta Firebase e Google Cloud você tem acesso a tudo, só faça tudo separado das minhas contas de trabalho, trate isso como algo pessoal."* Ou seja: se o app novo precisar de backend, Firebase é bem-vindo, num projeto pessoal, separado do trabalho.
- **Tom:** ele pediu para o texto dizer **"Claude"** e não "robô" (*"tenho afeto por você, não é só um robô"*). Nada de flerte em mensagens para a Priscila (ele pediu e depois retirou). Português do Brasil, direto, sem formalidade.
- **Postura de reservas (decisão de 17/09):** *"Sinceramente não quero reservar nada agora, vou esperar chegar na Irlanda para tomar decisões melhores, visto que lá consigo perguntar."* Isso está certo para quase tudo (entra quem chega, ou o ingresso só abre na semana). As exceções são estoque, não decisão — ver seção 10.

## 2. Estado em 24/09/2026

Hoje ele **embarca**: GYN 11:20 → GRU → CDG (AF0453), pousa em Dublin amanhã, 25/09, 11:15 (EI0521). Nada foi reservado além dos voos (última confirmação dele). O app publicado como artifact está no ar e é o que ele vai usar na estrada até existir outro.

## 3. O que está comprado e travado

| Item | Detalhe |
|---|---|
| **Air France, reserva Y4WCIU** | Ida: AF0453 GRU 14:40 → CDG (24/09), EI0521 CDG 10:20 → **DUB 11:15 (sex 25/09)**. Volta: **AF1617 DUB 09:15 (qui 15/10)** → CDG → Rio → Goiânia. ⚠️ **Check-in fecha 08:35** — é a trava que organiza os últimos três dias. |
| **Ryanair, reserva D2T4SZ** | **FR7072 seg 12/10 DUB 19:35 → OPO 22:00** · **FR7079 qua 14/10 OPO 17:55 → DUB 20:20**. €136,34 pagos (Mastercard final 5548). Portão fecha 30 min antes; check-in no balcão custa €55. |
| **Base em Dublin** | **38–41 Tyrconnell Road, Inchicore, D08 TXV4** (casa da Priscila). Luas vermelha: Goldenbridge ou Suir Road. Ônibus G1/G2 24 h em Inchicore Village. Leap Card €2/90 min, teto €6/dia. Vale 25/09–01/10, **10–11/10** e a noite de 14→15/10 — ⚠️ as três noites avulsas ainda precisam de confirmação com quem hospeda. |
| **Estágio num restaurante** | 29/09, 30/09 e 01/10, **tarde e noite**. Sobram só as manhãs, até ~12:15. |
| **Porto** | O irmão dele mora lá. 12→14/10, duas noites. |
| **Carro alugado (decidido, não reservado)** | Sex 2/10 ~09:00 Dublin → seg 12/10 ~15:30 Dublin Airport (Eastlands). Retirado com a Priscila e o Richie (eles não têm carro), os três vão a Galway, eles voltam de trem no domingo 4, o carro fica com o Lucas. Manual, ~1.500 km. Referência: Ford Focus 11 dias €250 (carhire.ie, franquia €1.800). Detalhes e o problema do seguro na seção 6. |

## 4. Os 21 dias — o esqueleto

Base = onde dorme. `rg` é a região usada para cor no app. O conteúdo completo de cada dia (com horários, endereços, telefones, "onde comer") está em `plano.json`.

| Data | rg | Base | O dia |
|---|---|---|---|
| sex 25/09 | dublin | Dublin | Chegada 11:15 — Leap Card, o bairro (Inchicore), primeiro pub: **Slatt's**, Tyrconnell Park |
| sáb 26/09 | dublin | Dublin | Dublin Festival of History no Richmond Barracks (grátis, prédio de entrada livre) · 15:00 **Bohemians × Bohemians Praha**, Dalymount (€20) |
| dom 27/09 | dublin | Dublin · montanha | ★ Travessia das montanhas de Dublin: Marlay Park → Fairy Castle → Three Rock → Tibradden → Cruagh → Hell Fire Club, ~25 km / 900 m (ideia do Richie) |
| seg 28/09 | dublin | Dublin | Único dia inteiro livre. Kilmainham Gaol **esgotada** (devoluções 09:15–09:30) → Jardins do Memorial de Guerra 08:00, tour grátis do Royal Hospital 11:00, Collins Barracks 13:00, **Guinness Open Gate** 16:00 (única chance), Cobblestone 19:15 |
| ter 29/09 | dublin | manhã | Estágio. Manhã: jardins de Lutyens 08:00 + Bully's Acre + Collins Barracks 10:00 |
| qua 30/09 | dublin | manhã | Estágio. Manhã: ★ **14 Henrietta Street** às 10:00 (€12, reservar) + Moore Street Market |
| qui 01/10 | dublin | manhã | Estágio. Magazine Fort **esgotado** → Richmond Barracks 10:00 (entrada livre) |
| sex 02/10 | west | Galway | Retira o carro ~09:00, Dublin → Galway pela M4/M6 com a Priscila e o Richie. Galgos 19:50 (Galway Greyhound Stadium) se toparem |
| sáb 03/10 | west | Galway | Galway Market 09:30, Salthill, o que eles quiserem mostrar; Áras na nGael 21:00 |
| dom 04/10 | west | Galway → Ballinasloe | ★ **Feira de Ballinasloe**, sozinho, de dia (eles voltam a Dublin e não recomendam — ele foi mesmo assim). Citylink 763 10:00, volta 16:25. **"Don't say travellers!"** |
| seg 05/10 | west | Inishbofin | ★ Carro até o cais de Cleggan (89 km), balsa 11:30, Westquarter Loop, noite no **Day's Bar B&B**. "My favourite place in the country" (Richie) |
| ter 06/10 | west | Galway | Balsa 09:00 → Galway ~12:00 → **Galway Races em Ballybrit**, 1º páreo 14:20 (~€15). "Ballybrit on a Tuesday" (Richie) |
| qua 07/10 | west | Galway | ★ Estrada do Burren de carro: Kinvara → Ballyvaughan → Doolin → **Cliffs of Moher** (antes das 11:00, €8 online) → volta. Ônibus 350 é o plano sem carro |
| qui 08/10 | cork | Cork | Galway → Cork pela M18/M20 (~2h45). English Market (Farmgate), ⭐ **Goldie** 19:30 (021 239 8720), Sin É, Welcome Inn |
| sex 09/10 | cork | Cork | ★ Beara de carro: Cork → Glengarriff → **Castletownbere** (caranguejo — Breen's, MacCarthy's) → Healy Pass → Kenmare → Cork, ~280 km. Galgos em Curraheen 19:35 |
| sáb 10/10 | cork | Cork → Dublin | Cork → Dublin pela M8 (~2h45, sai 07:30). O dia com eles no carro: Howth ou Wicklow. ⚡ Se a final de hurling cair hoje, Thurles entra como parada (+11 min). **Comprar a carne do churrasco hoje** |
| dom 11/10 | dublin | Dublin | ★ **Churrasco na casa dos pais do Richie** — o ponto alto. Sem trem, sem horário. Oferecer-se para assar |
| seg 12/10 | porto | Dublin → Porto | Manhã livre em Inchicore (Open Gate 13:00 como repescagem), **devolução do carro 15:30** no aeroporto, FR7072 19:35, pousa 22:00, jantar de madrugada no Cufra |
| ter 13/10 | porto | Porto | Bolhão 09:00, Matosinhos 11:00, almoço na Rua Heróis de França, Casa da Guitarra 16:00, ★ FC Porto no Dragão se jogar (Champions 13–14/10) |
| qua 14/10 | porto | Porto → Dublin | Café com cheirinho 08:30, Afurada 11:00, bifana no Conga, metrô 15:30, FR7079 17:55 → Dublin 20:20, 782 + Luas até Inchicore ~22:15 |
| qui 15/10 | dublin | Dublin → casa | Sai a pé 04:50 → Heuston → **Dublin Express 782 05:35 → T1 06:21** (€10). Check-in AF fecha 08:35. AF1617 09:15 |

## 5. As pessoas

**Priscila** — amiga, mora em Dublin, hospeda o Lucas. Em 13/09 mandou o plano deles: Galway juntos sexta e sábado (voltam domingo); Ballinasloe é "unusual", não recomendam; day tour aos Cliffs ("lindíssimo"); Inishbofin com pernoite ("uma grande fazenda em forma de ilha, sem iluminação na rua, ou gosta ou odeia" — a família do Richie vai há 14 anos); último fim de semana em Dublin com eles (Howth, Bray, Guinness Lake); Kilmainham com o Richie. Ela recebeu a página em inglês (`paginas/ireland-itinerary-en.html`).

**Richie** — namorado dela, irlandês, sem carro. Respondeu 17 de 18 perguntas de um questionário em 12/09 (íntegra em `docs/richie-veredito-e-decisoes-12-09.md`). O essencial: *"Go Galway, down to Cleggan and get the ferry out to Inishbofin. My favourite place in the country."* · Ballinasloe: *"Grand"* — *"Don't say travellers!"* — *"Nobody will bother him."* · Dia a proteger: Sunday · Cork: An Spailpín Fánach, Goldie, e do festival só o Céilí Mór (€10) · Levar um amigo de fora: *"THE DOGS"* e *"BALLYBRIT ON A TUESDAY"* · Mart de gado: *"No. Leave the men to it."* · Carro: Connemara · Montanha: *"Dublin mountains is good."* · West Cork: Castletownbere, *"some of the best crab/shellfish in the country"* · *"He'll buy a round out of turn. He'll survive."* Pints devidos: 5. **Os pais dele são os anfitriões do churrasco de domingo 11 — onde eles moram ainda não foi confirmado** (o dia foi montado supondo Dublin ou arredores).

## 6. Decisões tomadas e por quê (cronológico)

Esta é a parte que evita refazer discussão já vencida.

1. **Belfast × Cork (agosto):** avaliação completa em `docs/belfast-vs-cork-avaliacao.md`. Cork venceu — Belfast exigiria ETA do Reino Unido e quebraria a lógica de Galway → sul. Não reabrir.
2. **Galway antes de Cork, Ballinasloe no meio:** a feira de cavalos de Ballinasloe (a mais antiga da Europa, 80 mil pessoas numa vila de 6.600, negócio em dinheiro com aperto de mão) é a materialização do "bagaceira" que ele pediu. A Priscila e o Richie não recomendam; ele decidiu **ir mesmo assim, sozinho, no domingo 4, de dia, e voltar cedo**. Regra de segurança e etiqueta em `conteudo-completo.json → ETIQUETTE`.
3. **Inishbofin de segunda para terça (não quarta):** para não perder Ballybrit na terça (Richie). A balsa é uma operadora só; as saídas de outubro das 11:30 (seg) e 09:00 (ter) **não estavam online** — reserva por telefone 095 37228.
4. **Cliffs of Moher entraram** depois da regra do Cristo Redentor: é o turístico que entrega. Antes das 11:00, €8, falésia vazia.
5. **Música rebaixada (17/09):** todos os shows pagos cortados; o Cork Singers' Club foi rebaixado e depois cortado de vez. Só pub de fundo. Ver seção 1.
6. **Carro alugado de sexta 2 a segunda 12 (14/09):** porque o Richie não tem carro e o fim de semana deles (Wicklow) não existe sem carro. Substituiu dois GoCar, ônibus 51 e o trem de sábado. **O problema do seguro, verificado:** o Mastercard Black do Brasil cobre a Irlanda (guia set/2025, "em qualquer lugar do mundo", 60 dias; a Visa exclui, a Mastercard não), **mas** Europcar/Irish Car Rentals/carhire.ie só aceitam dispensa de CDW com cartão americano ou canadense; Avis e Sixt aceitam com carta do emissor em inglês citando "Republic of Ireland" + caução de €5.000 + taxa €30–40; Hertz não pede carta (bloqueia só a franquia €2.000–3.500). Pergunta aberta para a Mastercard: *"cobre a franquia quando o CDW básico vem embutido na tarifa e não pode ser recusado?"* CNH vale sozinha por lei (S.I. 384/1992), mas Avis e Europcar exigem PID no balcão. Custo realista €440 (com o cartão) a €800 (com seguro da locadora).
7. **Museus (17/09):** Kilmainham Gaol `daySoldOut` em **todas** as datas liberadas (17/09–15/10), sem venda no portão, sem revenda; só devoluções online 09:15–09:30. Magazine Fort: bloco de outubro publicado e esgotado (12 lugares/dia; truque para checar data a data sem abrir o site: `https://www.eventbrite.ie/api/v3/destination/series/1997018994571/events/?time_filter=current_future&page_size=50&expand=ticket_availability`). Dias 28/09 e 01/10 reescritos com substitutos grátis e sem reserva.
8. **Não reservar nada agora (17/09):** decisão dele, e está certa para quase tudo. Exceções listadas na seção 10.
9. **O último fim de semana (18/09) — a decisão mais recente:** a ida e volta de domingo a Thurles para a final de hurling ficou puxada, e surgiu o convite para um **churrasco na casa dos pais do Richie**. Decidido: **o churrasco é fixo no domingo 11; a final de hurling virou bônus e só acontece se cair no sábado 10**, quando Thurles fica em cima da M8 (Cork → Thurles pela saída 6 Horse and Jockey + N62: 114 km, 81 min; Thurles → Dublin pela saída 5 Twomileborris: 149 km, 112 min; direto 255 km, 182 min — **desvio de +8,5 km, +11 min, €0 de pedágio a mais**). Fatos: as seis últimas finais sênior de Tipperary (2020–2025) foram todas no domingo; três de seis foram para replay ~2 semanas depois (quando ele já estará em casa); a data sai em tipperary.gaa.ie depois das semifinais de 26–27/09. O Hayes Hotel, Liberty Square, Thurles, é o prédio onde a GAA foi fundada em 1/11/1884. Guia completo do churrasco (picanha = "rump cap"/"top sirloin cap", comprar no sábado, sal grosso e farinha do Brasil, carne e laticínio não entram na UE) em `docs/churrasco-11-10-e-final-hurling-18-09.md`.

Coisas que **saíram** e não voltam: Belfast; segunda-feira na feira de Ballinasloe; mart de Skibbereen (só plano de chuva); GoCar; clube de canto; Temple Bar; qualquer show pago; Storehouse da Guinness (é o Open Gate que vale); Ryan's Daughter em Thurles (fechou 05/2026); Boavista FC (insolvente); "Slattery's de Rialto" (não existe — o certo é o Slatt's).

## 7. O app que já existe — e o que aprendemos com ele

**`paginas/roteiro-app-artifact.html`** (~85 KB, arquivo único, sem framework), publicado como artifact do Claude em `https://claude.ai/artifact/Kt8LKjTbzezRaGnMDag3v6`, título "Irlanda 21 dias", versão 3 (18/09). Ele funciona e é a referência de comportamento esperado. Observações:

- **É um artifact, não uma página normal:** não tem `<!DOCTYPE>`, `<html>`, `<head>`, `<body>` — o publicador injeta o esqueleto. Para rodar fora do claude.ai, envolva num documento HTML completo. O CSS, o JS e os dados estão inline.
- **Dados:** a linha `var PLANO = {...};` (linha ~223) é `plano.json` inteiro, injetado. `DAYS = PLANO.days`, `BOOK = PLANO.book`.
- **Três abas:** *Dia* (timeline do dia, com trilho de 21 pílulas no topo), *Os 21 dias* (lista agrupada por região) e *Pendências* (checklist).
- **Por evento:** expandir o texto (clamp de 2 linhas), **adiar** +15/+30/+1h/−30, **dar hora** a blocos sem horário, **mover para outro dia**, **marcar feito**, **pular**, **nota** livre, **restaurar**. Pode **acrescentar** eventos próprios e excluí-los. Telefones viram `tel:` e domínios `.ie/.com` viram link (TreeWalker sobre text nodes, não sobre o HTML — importante, o texto tem `<b>`).
- **Ordenação:** por hora; eventos sem hora herdam a hora do evento anterior no array (`carried`), então a ordem do array é significativa. Adiar reordena — foi a alternativa ao drag-and-drop, que é ruim em celular.
- **Estado:** `{ov:{[evId]:{s:'done'|'skip'|null, t:'HH:MM'|null, d:'YYYY-MM-DD'|null, n:'nota'|null}}, ex:[eventos próprios], ck:{[bookId]:true}}`. Salvo no `db` do artifact (documento único `plano/estado`, `onSnapshot`) com fallback em `localStorage` (`irl.plano.v1`).
- **Cor por região:** `--dublin #3C72B4`, `--west #7B1E3C`, `--cork #BE0F28`, `--tipp #16357A`, `--porto #1A4E8A` (claro) e variantes para escuro. O `--acc` da interface troca com o dia. Tipografia: Archivo (UI) + IBM Plex Mono (horas).
- **Lições:** `prompt()`/`confirm()` são bloqueados no iframe do artifact (num app próprio não são, mas editores inline ficaram melhores mesmo assim); `<select>` precisa de `onchange`, não `onclick`; ao mover um evento, o dia de destino precisa filtrar por `o.d` para não duplicar; safe-area no header sticky (`top: env(safe-area-inset-top)`); página tem de funcionar sem rede e sem o `db`.
- **Limitação que motivou o app novo:** o artifact com `db` é interno à conta, precisa de rede para abrir, e não tem notificação, mapa nem offline de verdade.

## 8. Os dados

### `plano.json` — normalizado para o app (fonte imediata)
```
{ "days": [ { "d":"2026-10-11", "wd":"DOM", "dt":"11/10",
              "ti":"★ Churrasco na casa dos pais do Richie",
              "base":"Dublin", "rg":"dublin", "tags":["★ o ponto alto"],
              "note":"texto de rodapé do dia (pode ser vazio)",
              "ev":[ { "id":"2026-10-11.0.o-dia", "h":"★ o dia", "t":null,
                       "c":"star", "b":"<b>HTML leve</b> …" }, … ] }, … ],
  "book": [ { "id":"b02", "w":"🔴 NÃO ESPERA", "t":"Camas em Galway…", "b":"…" }, … ] }
```
- 21 dias, **125 eventos**, 14 pendências.
- `ev[].id` = `{data ISO}.{índice}.{slug do rótulo}`. É a chave do estado salvo — **não renumere** sem migrar o estado. (Os IDs do Porto em 12/10 foram preservados de propósito quando a manhã de Dublin foi inserida antes deles, com índices 10–13.)
- `ev[].h` = rótulo original (pode ser hora `"07:30"`, ou texto `"onde comer"`, `"★ o dia"`, `"⚠️ confirmar"`, `"⚡ se a final cair hoje"`). `t` = hora `HH:MM` só quando `h` é hora. `c` = categoria: `time` · `note` · `eat` (onde comer) · `star` (★) · `warn` (⚠️ ou ⚡) · `gone` (⛔, coisa que esgotou). Os prefixos ★ ⚠️ ⛔ ⚡ devem ser removidos do rótulo na exibição.
- `b` contém HTML leve: `<b>`, `<i>`, `&amp;`, `⭐`, `⚠️`. Renderize como HTML confiável (é conteúdo nosso), mas escape o que vier do usuário.
- `rg` ∈ `dublin | west | cork | tipp | porto` (`tipp` não é mais usado por nenhum dia, ficou do desenho antigo).
- `book[].w` ∈ `⛔ PERDIDO · ✅ DECIDE LÁ · 🔴 NÃO ESPERA · 🟠 ESTA SEMANA · 🟡 SE QUISER · ⚪ NA SEMANA`.

### `conteudo-completo.json` — tudo o que existe (fonte de verdade)
Dump integral de `fontes/data.py` + `fontes/data_op.py`, com o que o `plano.json` não carrega: `BANDS` (faixas do calendário: festivais, corridas, marts, GAA, galgos — bom para um "o que mais está acontecendo hoje"), `CONFIRMADO` (5 cartões do que está comprado), `CARRO` (4 cartões: desenho, custo, seguro, carteira), `RICHIE` (10 cartões), `ULTIMA` (5 opções para a madrugada de 15/10 com preço e risco), `DOUBTS` (22 itens do que **não** está confirmado, cada um com o telefone que resolve — ótimo para uma tela "ligue e confirme"), `ETIQUETTE` (8 cartões: Travellers, câmera, segurança na feira, clube de canto, bingo, mart, jogo do GAA, pubs), `EAT` (onde comer por data, já fundido em `plano.json`).

### `fontes/` — o gerador
`data.py` + `data_op.py` (conteúdo) → `build3.py` (relatório completo em português, `paginas/roteiro.html`, 11 seções: travado · calendário · mapa · Dublin · roteiro · carro · Porto · última noite · etiqueta · agenda · honestidade) e `build_en.py` (página em inglês para a Priscila). `css.py` é o tema. `maps.py` gera os SVGs de `mapas/` a partir da costa GSHHS (`pip install basemap basemap-data-hires`, projeção Transverse Mercator, simplificação Ramer–Douglas–Peucker, rotas suavizadas Catmull-Rom → Bézier; ~7 s por mapa). Os SVGs prontos (`nat`, `con`, `wc` em pt/en) usam variáveis CSS `--water --land --coast --s1..--s4` e podem ir direto para o app novo.

## 9. Telefones e endereços que mais importam
Balsa de Inishbofin **095 37228** (seg–sex 10–18) / SMS 087 180 0586 · Day's Bar B&B **+353 95 45829** · Lapwing House +353 95 45996 · hostel da ilha +353 95 45855 · Goldie **021 239 8720** · Hayes Hotel, Thurles **0504 22122** · Breen's, Castletownbere 027 70031 · MacCarthy's 027 70014 · 14 Henrietta Street 01 524 0383 · Richmond Barracks 01 524 2532 · Phoenix Park (Magazine Fort) 01 677 0095 · Patriot's Inn 01 679 9595 · Galway Greyhound Stadium 061 448080 · Kilmainham devoluções: kilmainhamgaol.admit-one.eu 09:15–09:30 · Ingresso do hurling: embed.futureticketing.ie/c/tipperary-gaa · Balsa: inishbofinferry.ie · Cliffs: bookings.cliffsofmoher.ie.

## 10. Pendências abertas (em 24/09)

Nada reservado. O que **não espera** (estoque): camas em Galway 2–4 e 6–7/10 (semana da feira, região esvazia; Athlone é plano B); cama em Inishbofin 5/10; **a balsa por telefone** (as duas saídas de outubro); camas em Cork 8–9/10 com estacionamento; confirmação das noites de Inchicore 10, 11 e 14/10. O que só existe no Brasil: **carta da Mastercard** e a **PID** (Detran-GO, ~R$207, presencial) — se não fez até hoje, a alternativa é Hertz (sem carta) e torcer no balcão. O carro em si: reservar com pagamento na retirada e cancelamento grátis. Pergunta de gente: **onde moram os pais do Richie** (muda o desenho de 10–11/10 se for na estrada Cork–Dublin). Se quiser: 14 Henrietta Street 30/09 10:00, Goldie 8/10, comprar a carne no sábado 10.

## 11. Lembretes automáticos que já existem (scheduled tasks na conta dele)
- `trig_014FmEKki66p1sR425a391U7` — disparou 19/09 11:00 UTC, as seis coisas que não esperam + a pergunta dos pais do Richie.
- `trig_014JDGBcJLU168TQnzWpwStP` — **30/09 07:30 UTC**, "Final de hurling — sábado 10 ou nada": verifica tipperary.gaa.ie e manda push + e-mail com o veredito.
- `trig_01EHJ9E5quRseCEq29ppCpbn` — 11/10 19:00 UTC, check-in FR7072 (corrigido para o carro).
- `trig_01CMqBS1P91GsdM7T868PEeZ` — 13/10 17:30 UTC, check-in FR7079.
Um app novo poderia absorver isso com notificações locais (ver seção 13).

## 12. Fontes usadas (para citar e para atualizar)
ballinasloeoctoberfair.ie · misleor.ie · galwayraces.com · citylink.ie · inishbofinferry.ie · inishbofin.com · buseireann.ie · transportforireland.ie (feeds GTFS: 350, S8, 15B, 16, 409) · irishrail.ie · dublinexpress.ie · corkfolkfestival.com · corkmarts.com · gaacork.ie · tipperary.gaa.ie · futureticketing.ie · dublinfestivalofhistory.ie · 14henriettastreet.ie · kilmainhamgaolmuseum.ie / admit-one.eu · phoenixpark.ie · eventbrite.ie (OPW) · cobblestonepub.ie · dublinmountains.ie · paveepoint.ie (factsheets sobre Travellers) · cliffsofmoher.ie · wicklow.ie (Bray–Greystones fechada, 02/09/2026) · AA Ireland (combustível) · guia de benefícios Mastercard Black set/2025 · termos de Europcar, Irish Car Rentals, Avis, Sixt, Hertz, Enterprise · S.I. 384/1992 · met.ie. Verificações datadas: 12/09, 14/09, 15/09, 17/09, 18/09.

## 13. O que ele pediu do app, e o que faria diferença na estrada

O pedido literal (17/09): *"quero fazer também um aplicativo que me permita ver o meu roteiro dia a dia, com a opção de ver mais detalhes, ou alterar, modificar, jogar um evento para mais tarde."* O artifact cobre isso. Um app de verdade, construído no Code, pode ir além — sugestões, em ordem do que mais ajuda um viajante sozinho, de carro, com rede ruim no oeste:

1. **Offline de verdade** (PWA com service worker ou app nativo): Inishbofin e Beara não têm sinal confiável. Os dados cabem inteiros no aparelho.
2. **"Agora"**: ao abrir, o evento corrente do dia corrente, com o próximo e o tempo até ele. É o que ele vai olhar no pub.
3. **Ligar e navegar num toque:** todo telefone é `tel:`; todo endereço abre no Maps/Waze com a rota. Os endereços estão no texto dos eventos (`b`), não estruturados — vale extrair para um campo `addr`/`geo` ao migrar.
4. **Notificações locais** para os travados: check-in Ryanair (11/10 19:00 e 13/10 17:30 UTC), o despertador de 15/10 às 04:30, "compre a carne" no sábado 10, "ligue para a balsa" na segunda 28.
5. **Mapa com a rota do dia** (os SVGs de `mapas/` ou um mapa real) e os pedágios do trecho.
6. **A etiqueta como cartão rápido do dia:** no domingo 4, "Don't say travellers"; no jogo, "sem camisa de condado"; no pub, "a rodada tem vez". Está em `ETIQUETTE`.
7. **DOUBTS como lista de "ligue e confirme"** com o telefone e o horário de atendimento (Irlanda = Brasília + 4 h em outubro… atenção: +4 h até 25/10, quando a Irlanda sai do horário de verão).
8. **Diário/fotos** por evento — ele vai querer contar a viagem depois.
9. **Sincronia opcional** (Firebase, projeto pessoal, separado do trabalho) só para não perder o estado entre celular e computador; localStorage/IndexedDB primeiro.
10. **Compartilhar um dia** com a Priscila em inglês — o `build_en.py` mostra o formato que ela recebeu.

Não faça: obrigar reserva/login para abrir; pôr o Temple Bar; transformar música em programa; gamificação; pedir para ele decidir de novo o que está na seção 6.

## 14. Inventário do pacote

```
CLAUDE.md                       este arquivo
plano.json                      21 dias · 125 eventos · 14 pendências (normalizado)
conteudo-completo.json          dump integral de data.py + data_op.py (13 estruturas)
fontes/  data.py data_op.py     o conteúdo, em Python
         build3.py css.py       gerador do relatório em português
         build_en.py            gerador da página em inglês
         maps.py                cartografia offline (GSHHS → SVG)
mapas/   nat_pt.svg nat_en.svg  Irlanda inteira com as rotas
         con_pt.svg con_en.svg  Connemara + Inishbofin
         wc_pt.svg  wc_en.svg   West Cork / Beara
paginas/ roteiro.html           relatório completo (11 seções, ~206 KB) — a versão "papel"
         roteiro-app-artifact.html  o app atual (sem esqueleto HTML — é artifact)
         ireland-itinerary-en.html  página enviada à Priscila
docs/    11 documentos do projeto "Irlanda" no claude.ai, na íntegra:
         dossie-pesquisa-irlanda-porto.md      a pesquisa inicial (46 KB)
         belfast-vs-cork-avaliacao.md          por que Cork
         onde-comer-cork-galway.md             gastronomia verificada
         adendo-noite-rotas-cenicas-carro.md   noite, rotas cênicas, PID × CNH
         adendo-dublin-porto-ultima-noite.md   manhãs de estágio, madrugada de 15/10, Porto
         revisao-regioes-v7-bagaceira.md       a revisão pela lente "bagaceira + gente"
         richie-veredito-e-decisoes-12-09.md   as 18 respostas e o carro
         pendencias-reservas-15-09.md          checklist + Eventbrite API do Magazine Fort
         app-roteiro-e-postura-reservas.md     o app e a postura de reservas
         churrasco-11-10-e-final-hurling-18-09.md  a decisão mais recente
         roteiro-fontes-build.md               snapshot dos fontes em 17/09 (fontes/ é mais novo)
```

Datas no texto são dd/mm. Moeda €. Hora local da Irlanda (IST = UTC+1 até 25/10). O nome dele nos arquivos aparece como Lucas; a amiga como Priscila (ele escreve "Priscila", ela assina "Priscilla").
