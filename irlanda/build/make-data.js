#!/usr/bin/env node
/* Gera irlanda/data.js a partir de src/plano.json + src/conteudo-completo.json + src/enrich.json (opcional)
   Uso: node irlanda/build/make-data.js            (da raiz do repo)
   Não tem dependências. Saída: window.IRL = {...} */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const read = (f) => JSON.parse(fs.readFileSync(path.join(SRC, f), 'utf8'));

const plano = read('plano.json');
const full = read('conteudo-completo.json');
let enrich = null;
try { enrich = read('enrich.json'); } catch (e) { console.warn('aviso: src/enrich.json ausente — usando títulos automáticos'); }

const APP_VERSION = process.env.IRL_VERSION || fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();

/* ---------- helpers ---------- */
const strip = (html) => String(html || '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ').trim();

const cleanLabel = (h) => String(h || '').replace(/^[★⚠️⛔⚡✅⭐]+\s*/u, '').trim();

function autoTitle(e) {
  // título de emergência quando não há enriquecimento: primeiro <b> ou primeira frase
  const m = /<b>(.*?)<\/b>/.exec(e.b || '');
  let t = m ? strip(m[1]) : strip(e.b).split(/[.!?—]/)[0];
  t = t.replace(/[.:,;]+$/, '').trim();
  if (t.length > 48) t = t.slice(0, 46).replace(/\s+\S*$/, '') + '…';
  if (!t) t = cleanLabel(e.h) || 'item';
  return t;
}
function autoKind(e) {
  if (e.c === 'time' || e.c === 'eat') return 'do';
  if (e.c === 'gone' || e.c === 'warn') return 'info';
  const h = cleanLabel(e.h).toLowerCase();
  if (/^(por qu|rodap|o tempo|o problema|preço|nota|a regra|o que cabe|o que levar|e a final|a picanha|confirmar)/.test(h)) return 'info';
  if (/^(tarde|noite|manhã|dormir|beber|o dia|o achado|plano|se |o que salva)/.test(h)) return 'do';
  return e.c === 'star' ? 'do' : 'info';
}

/* ---------- dias + enriquecimento ---------- */
const enrichByDay = {};
if (enrich && Array.isArray(enrich.days)) for (const d of enrich.days) enrichByDay[d.d] = d;

let missingEnrich = 0;
const days = plano.days.map((d) => {
  const ed = enrichByDay[d.d];
  const evMap = {};
  if (ed) for (const x of ed.events || []) evMap[x.id] = x;
  const ev = d.ev.map((e) => {
    const x = evMap[e.id];
    if (!x) missingEnrich++;
    return {
      id: e.id, h: e.h, t: e.t, c: e.c, b: e.b,
      ti: (x && x.ti) ? x.ti.replace(/^[★⚠️⛔⚡]+\s*/u, '').trim() : autoTitle(e),
      kind: (x && x.kind) || autoKind(e),
      place: (x && x.place) || '',
      maps: (x && x.maps) || '',
      dur: (x && x.dur) || 0,
      alts: (x && Array.isArray(x.alts)) ? x.alts.filter(a => a && a.ti && a.b).map(a => ({ ti: a.ti, b: a.b, src: a.src || '', t: a.t || '' })) : [],
    };
  });
  return {
    d: d.d, wd: d.wd, dt: d.dt, ti: d.ti, base: d.base, rg: d.rg, tags: d.tags || [], note: d.note || '',
    lead: (ed && ed.daylead) || '',
    etq: (ed && Array.isArray(ed.etiquette)) ? ed.etiquette.filter(i => Number.isInteger(i) && i >= 0 && i < full.ETIQUETTE.length) : [],
    ev,
  };
});
if (missingEnrich) console.warn(`aviso: ${missingEnrich} eventos sem enriquecimento (títulos automáticos)`);

/* ---------- telefones que mais importam (handoff §9) ---------- */
const phones = [
  { n: 'Balsa de Inishbofin', tel: '095 37228', obs: 'seg–sex 10:00–18:00 · SMS 087 180 0586 · inishbofinferry.ie', tag: 'west' },
  { n: 'Balsa de Inishbofin (SMS)', tel: '087 180 0586', obs: 'mensagem de texto', tag: 'west', sms: true },
  { n: "Day's Bar B&B (The Beach), Inishbofin", tel: '+353 95 45829', obs: '4 quartos · info@thebeach.ie', tag: 'west' },
  { n: 'Lapwing House B&B, Inishbofin', tel: '+353 95 45996', obs: 'aberto o ano todo', tag: 'west' },
  { n: 'Inishbofin Island Hostel', tel: '+353 95 45855', obs: 'privado €70 · dormitório €25', tag: 'west' },
  { n: 'Galway Greyhound Stadium', tel: '061 448080', obs: 'galgos sexta 02/10, portões 18:30', tag: 'west' },
  { n: 'GBC — Galway Bakery Company', tel: '091 563 087', obs: '7 Williamsgate St · seg–sáb 08:00–16:30', tag: 'west' },
  { n: "Gibbons' Pillar House, Ballinasloe", tel: '090 964 3939', obs: '8 Society St · comida 09:00–21:00', tag: 'west' },
  { n: "Gullane's Hotel, Ballinasloe", tel: '090 964 2220', obs: 'carvery 12:00–16:30', tag: 'west' },
  { n: "Gus O'Connor's, Doolin", tel: '065 707 4168', obs: 'Fisher St', tag: 'west' },
  { n: "McGann's, Doolin", tel: '065 707 4133', obs: 'Roadford', tag: 'west' },
  { n: 'Goldie, Cork', tel: '021 239 8720', obs: '128 Oliver Plunkett St · qua–sáb · 28 lugares', tag: 'cork' },
  { n: 'Farmgate Café (English Market)', tel: '021 427 8134', obs: 'ter–sex 09:00–15:30', tag: 'cork' },
  { n: "Breen's Lobster Bar, Castletownbere", tel: '027 70031', obs: 'The Square · sex 12–17 e 17:30–21:30', tag: 'cork' },
  { n: "MacCarthy's Bar, Castletownbere", tel: '027 70014', obs: 'The Square · seg–sáb 09:30–23:30', tag: 'cork' },
  { n: 'Hayes Hotel, Thurles', tel: '0504 22122', obs: 'Liberty Square · só se a final cair no sábado 10', tag: 'cork' },
  { n: '14 Henrietta Street', tel: '01 524 0383', obs: '€12 · qua–dom, de hora em hora 10–16 · 14henriettastreet.ticketsolve.com', tag: 'dublin' },
  { n: 'Richmond Barracks', tel: '01 524 2532', obs: 'entrada livre seg–sáb 10–17 · café "The Mess"?', tag: 'dublin' },
  { n: 'Phoenix Park / Magazine Fort (OPW)', tel: '01 677 0095', obs: 'perguntar duração da visita e vagas', tag: 'dublin' },
  { n: "The Patriot's Inn", tel: '01 679 9595', obs: '760 South Circular Rd · coddle no cardápio?', tag: 'dublin' },
  { n: 'Loaf Café, Kilmainham Square', tel: '01 516 8294', obs: 'todo dia 08:00–16:00', tag: 'dublin' },
  { n: 'Phoenix Park Tea Rooms', tel: '01 671 9376', obs: 'Chesterfield Ave · abre 09:30', tag: 'dublin' },
  { n: 'Phoenix Park Café (Ashtown)', tel: '01 255 4445', obs: 'abre 09:30', tag: 'dublin' },
];

const links = [
  { n: 'Kilmainham Gaol — devoluções', url: 'https://kilmainhamgaol.admit-one.eu', obs: 'todo dia 09:15–09:30, hora irlandesa' },
  { n: 'Ingresso da final de hurling', url: 'https://embed.futureticketing.ie/c/tipperary-gaa', obs: 'só na semana do jogo' },
  { n: 'Data da final — Tipperary GAA', url: 'https://tipperary.gaa.ie', obs: 'sai depois das semifinais 26–27/09' },
  { n: 'Balsa de Inishbofin', url: 'https://inishbofinferry.ie', obs: 'as saídas de outubro das 11:30 e 09:00 não estão online' },
  { n: 'Cliffs of Moher — ingresso', url: 'https://bookings.cliffsofmoher.ie', obs: '€8 antes das 11:00' },
  { n: '14 Henrietta Street — reserva', url: 'https://14henriettastreet.ticketsolve.com', obs: '€12' },
  { n: 'Dublin Festival of History', url: 'https://dublinfestivalofhistory.ie/events', obs: 'grátis, exige reserva' },
  { n: 'Magazine Fort — Eventbrite', url: 'https://www.eventbrite.ie', obs: '"Magazine Fort Guided Tours" — olhar manual' },
  { n: 'TFI Live (ônibus e Luas)', url: 'https://www.transportforireland.ie', obs: 'horários em tempo real' },
  { n: 'Dublin Express 782', url: 'https://www.dublinexpress.ie', obs: 'Heuston → T1 · conferir na véspera de 15/10' },
  { n: 'Galway Races', url: 'https://www.galwayraces.com', obs: 'ter 06/10, 1º páreo 14:20' },
  { n: 'Ballinasloe October Fair', url: 'https://ballinasloeoctoberfair.ie', obs: 'dom 04/10' },
  { n: 'Cork Folk Festival', url: 'https://corkfolkfestival.com', obs: '08–11/10' },
  { n: 'Met Éireann (tempo)', url: 'https://www.met.ie', obs: 'previsão oficial' },
  { n: 'FC Porto — ingressos', url: 'https://bilhetes.fcporto.pt', obs: 'Champions 13–14/10' },
];

/* ---------- lembretes com hora (handoff §11 e §13) ---------- */
const reminders = read('lembretes.json');

/* ---------- texto do plano para o Claude (compacto) ---------- */
const WDN = { SEX: 'sex', SÁB: 'sáb', DOM: 'dom', SEG: 'seg', TER: 'ter', QUA: 'qua', QUI: 'qui' };
const planText = days.map((d) => {
  const head = `### ${WDN[d.wd] || d.wd} ${d.dt} (${d.d}) — ${strip(d.ti)} · base: ${d.base} · região: ${d.rg}${d.tags.length ? ' · ' + d.tags.join(', ') : ''}`;
  const note = d.note ? `Nota do dia: ${strip(d.note)}` : '';
  const evs = d.ev.map((e) => `- [${e.id}] ${e.t || cleanLabel(e.h)} · ${e.ti} (${e.kind}) — ${strip(e.b)}`).join('\n');
  return [head, note, evs].filter(Boolean).join('\n');
}).join('\n\n');

const doubtsText = full.DOUBTS.map((x, i) => `${i + 1}. ${strip(x.titulo)} — ${strip(x.texto)}`).join('\n');
const etqText = full.ETIQUETTE.map((x) => `- ${strip(x.titulo)}: ${x.itens.map(strip).join(' · ')}`).join('\n');
const bookText = plano.book.map((b) => `- ${b.w} ${strip(b.t)}: ${strip(b.b)}`).join('\n');
const D0 = new Date('2026-09-25T00:00:00Z');
const dOf = (i) => { const x = new Date(D0.getTime() + i * 864e5); return String(x.getUTCDate()).padStart(2, '0') + '/' + String(x.getUTCMonth() + 1).padStart(2, '0'); };
const bandsText = full.BANDS.map((f) => `${strip(f.faixa)}: ` + f.itens.map((it) => `${dOf(it.de)}${it.ate !== it.de ? '–' + dOf(it.ate) : ''} ${strip(it.rotulo)} — ${strip(it.texto)}`).join(' | ')).join('\n');
const ultimaText = full.ULTIMA.map((u) => `- ${strip(u.titulo)} (${u.custo}): ${strip(u.texto)} ${u.aviso ? strip(u.aviso) : ''}`).join('\n');
const carroText = full.CARRO.map((c) => `${strip(c.titulo)}: ${c.itens.map(strip).join(' · ')}`).join('\n');

/* ---------- brief (handoff.md sem as seções técnicas) ---------- */
const handoff = fs.readFileSync(path.join(SRC, 'handoff.md'), 'utf8');
const secs = handoff.split(/^## /m);
const keep = new Set(['1.', '3.', '4.', '5.', '6.', '9.', '10.']);
const brief = secs.filter((s) => keep.has(s.slice(0, 3)) || keep.has(s.slice(0, 2))).map((s) => '## ' + s.trim()).join('\n\n')
  .replace(/\n{3,}/g, '\n\n');
const mudancas = fs.existsSync(path.join(SRC, 'mudancas.md')) ? fs.readFileSync(path.join(SRC, 'mudancas.md'), 'utf8').trim() : '';
const dontText = (/Não faça:.*$/m.exec(handoff) || [''])[0];

const out = {
  version: APP_VERSION,
  built: new Date().toISOString().slice(0, 10),
  trip: { start: '2026-09-25', end: '2026-10-15', tz: 'Europe/Dublin', home: '38–41 Tyrconnell Road, Inchicore, Dublin D08 TXV4' },
  days,
  book: plano.book,
  doubts: full.DOUBTS,
  etiquette: full.ETIQUETTE,
  bands: full.BANDS,
  confirmado: full.CONFIRMADO,
  carro: full.CARRO,
  ultima: full.ULTIMA,
  richie: full.RICHIE,
  eat: full.EAT,
  phones, links, reminders,
  claude: {
    brief: (mudancas ? mudancas + '\n\n' : '') + brief + '\n\n' + dontText,
    plan: planText,
    doubts: doubtsText,
    etiquette: etqText,
    book: bookText,
    bands: bandsText,
    ultima: ultimaText,
    carro: carroText,
  },
};

const js = '/* gerado por build/make-data.js — não edite à mão */\nwindow.IRL = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(ROOT, 'data.js'), js);
// carimba a versão no service worker (troca o cache e força a atualização nos aparelhos)
const swPath = path.join(ROOT, 'sw.js');
const sw = fs.readFileSync(swPath, 'utf8').replace(/^const VERSION = '[^']*';/m, `const VERSION = '${APP_VERSION}';`);
fs.writeFileSync(swPath, sw);
const kb = (js.length / 1024).toFixed(0);
console.log(`data.js: ${kb} KB · ${days.length} dias · ${days.reduce((n, d) => n + d.ev.length, 0)} eventos · ${days.reduce((n, d) => n + d.ev.reduce((m, e) => m + e.alts.length, 0), 0)} alternativas · versão ${APP_VERSION}`);
console.log(`texto para o Claude: brief ${(out.claude.brief.length / 1024).toFixed(0)} KB · plano ${(planText.length / 1024).toFixed(0)} KB`);
