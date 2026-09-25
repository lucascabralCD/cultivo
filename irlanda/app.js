/* Irlanda — roteiro. App offline-first; estado em localStorage; Claude direto da API. */
(function () {
  'use strict';
  const D = window.IRL;
  const DAYS = D.days, BOOK = D.book;
  const APP_VERSION = D.version;
  const RG = { dublin: '--dublin', west: '--west', cork: '--cork', tipp: '--tipp', porto: '--porto' };
  const RGN = { dublin: 'Dublin', west: 'Oeste', cork: 'Cork', tipp: 'Tipperary', porto: 'Porto' };
  const WD = { SEX: 'sex', SÁB: 'sáb', DOM: 'dom', SEG: 'seg', TER: 'ter', QUA: 'qua', QUI: 'qui' };
  const WDL = { SEX: 'sexta', SÁB: 'sábado', DOM: 'domingo', SEG: 'segunda', TER: 'terça', QUA: 'quarta', QUI: 'quinta' };
  const REASONS = ['fechado', 'esgotado', 'chuva', 'cansado', 'atrasei', 'mudei de ideia', 'sem carro', 'outro'];
  const ICON_CK = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_TEL = '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';
  const ICON_MAP = '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>';

  /* ---------- estado ---------- */
  const LS = 'irl.app.v1';
  const BLANK = { ov: {}, ex: [], ck: {}, chat: [], cfg: { model: 'claude-opus-5', effort: 'medium', search: true }, key: '', misc: {} };
  let S = load();
  function sane(v) { // aceita só o formato esperado (backup importado ou localStorage corrompido)
    if (!v || typeof v !== 'object') throw new Error('formato');
    const s = Object.assign({}, BLANK, v, { cfg: Object.assign({}, BLANK.cfg, (v.cfg && typeof v.cfg === 'object') ? v.cfg : {}), misc: (v.misc && typeof v.misc === 'object') ? v.misc : {} });
    if (!s.ov || typeof s.ov !== 'object' || Array.isArray(s.ov)) s.ov = {};
    if (!s.ck || typeof s.ck !== 'object' || Array.isArray(s.ck)) s.ck = {};
    s.ex = (Array.isArray(s.ex) ? s.ex : []).filter((x) => x && typeof x === 'object' && x.id && x.d).map((x) => Object.assign({ t: null, h: '', ti: '', b: '', c: 'note', kind: 'do', src: 'me', maps: '', place: '', dur: 0, alts: [] }, x));
    s.chat = (Array.isArray(s.chat) ? s.chat : []).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string');
    while (s.chat.length && s.chat[s.chat.length - 1].role === 'assistant' && !s.chat[s.chat.length - 1].text) s.chat.pop(); // app morreu no meio de um stream
    if (typeof s.key !== 'string') s.key = '';
    if (!ClaudeAPI.MODELS.some((m) => m.id === s.cfg.model)) s.cfg.model = BLANK.cfg.model;
    if (!['low', 'medium', 'high'].includes(s.cfg.effort)) s.cfg.effort = 'medium';
    return s;
  }
  function load() {
    try { const r = localStorage.getItem(LS); if (r) return sane(JSON.parse(r)); } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(BLANK));
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { toast('Não consegui salvar (memória cheia?)'); } }
  function ovf(id) { if (!S.ov[id]) S.ov[id] = {}; return S.ov[id]; }
  function prune() { Object.keys(S.ov).forEach((k) => { const v = S.ov[k]; if (!v.t && !v.d && !v.s && !v.n && !v.why) delete S.ov[k]; }); }

  /* ---------- tempo (hora da Irlanda) ---------- */
  function nowParts() {
    if (S.misc.sim && S.misc.sim.d) { const hm = S.misc.sim.hm || '09:00'; return { iso: S.misc.sim.d, hm, min: toMin(hm), sim: true }; }
    const d = new Date();
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: D.trip.tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    const p = {}; f.formatToParts(d).forEach((x) => { p[x.type] = x.value; });
    const h = (+p.hour) % 24;
    const hm = String(h).padStart(2, '0') + ':' + p.minute;
    return { iso: `${p.year}-${p.month}-${p.day}`, hm, min: h * 60 + (+p.minute), sim: false };
  }
  function toMin(hm) { if (!hm) return null; const p = hm.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function addMin(hm, m) { let n = (toMin(hm || '09:00') + m); n = ((n % 1440) + 1440) % 1440; return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }
  function fmtDelta(min) { const a = Math.abs(min); if (a < 60) return a + ' min'; const h = Math.floor(a / 60), m = a % 60; return h + 'h' + (m ? String(m).padStart(2, '0') : ''); }
  function dayIndex(iso) { for (let i = 0; i < DAYS.length; i++) if (DAYS[i].d === iso) return i; return -1; }
  function todayIndex() { const t = nowParts().iso; const i = dayIndex(t); if (i >= 0) return i; return t < DAYS[0].d ? 0 : DAYS.length - 1; }
  function tripPhase() { const t = nowParts().iso; if (t < DAYS[0].d) return 'antes'; if (t > DAYS[DAYS.length - 1].d) return 'depois'; return 'durante'; }
  function daysUntil(iso) { const t = nowParts().iso; return Math.round((new Date(iso + 'T00:00:00Z') - new Date(t + 'T00:00:00Z')) / 864e5); }

  /* ---------- helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  const cleanLabel = (h) => String(h || '').replace(/^[★⚠️⛔⚡✅⭐]+\s*/u, '').trim();
  function mapsUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  function telUrl(t) { return 'tel:' + String(t).replace(/[^\d+]/g, ''); }
  function linkify(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = []; let n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach((node) => {
      if (node.parentNode.closest('a')) return;
      const t = node.nodeValue;
      const re = /(\+353[\d\s]{7,14}\d|\b0\d{2,3}\s\d{5,7}\b|\b0\d{1,2}\s\d{3,4}\s\d{3,4}\b|\b0\d{3}\s\d{2}\s\d{3}\b)|\b((?:[a-z0-9-]+\.)+(?:ie|com|org|net|pt|eu)(?:\/[^\s,)]*)?)\b/gi;
      if (!re.test(t)) return; re.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m;
      while ((m = re.exec(t))) {
        if (m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
        const a = document.createElement('a');
        if (m[1]) { a.href = telUrl(m[1]); } else { a.href = 'https://' + m[2]; a.target = '_blank'; a.rel = 'noopener'; }
        a.textContent = m[0]; frag.appendChild(a); last = m.index + m[0].length;
      }
      if (last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }
  function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function toast(msg, ms) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), ms || 2200); }
  function closed(s) { return s === 'done' || s === 'skip' || s === 'miss' || s === 'later'; }
  function gcal(ti, d, t, dur, details) {
    const ds = d.replace(/-/g, ''), st = (t || '09:00').replace(':', '') + '00', en = addMin(t || '09:00', dur || 30).replace(':', '') + '00';
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(ti) + '&dates=' + ds + 'T' + st + '/' + ds + 'T' + en + '&ctz=Europe/Dublin&details=' + encodeURIComponent(details || '');
  }

  /* ---------- eventos efetivos de um dia ---------- */
  function baseEv(id) {
    for (const d of DAYS) for (const e of d.ev) if (e.id === id) return e;
    for (const x of S.ex) if (x.id === id) return x;
    return null;
  }
  function dayOfEvent(id) { for (const d of DAYS) for (const e of d.ev) if (e.id === id) return d; for (const x of S.ex) if (x.id === id) return DAYS[dayIndex(x.d)] || null; return null; }
  function effective(day) {
    const out = []; let carried = null;
    day.ev.forEach((e, i) => {
      const o = S.ov[e.id] || {};
      if (o.d && o.d !== day.d) return;
      const t = o.t || e.t; if (t) carried = t;
      out.push({ e, o, t, k: (o.t || e.t || carried || '00:00'), i, own: true });
    });
    DAYS.forEach((d2) => { if (d2.d === day.d) return; d2.ev.forEach((e, i) => { const o = S.ov[e.id] || {}; if (o.d === day.d) out.push({ e, o, t: o.t || e.t, k: o.t || e.t || '00:00', i: 900 + i, own: false, from: d2.dt }); }); });
    S.ex.forEach((x, i) => { const o = S.ov[x.id] || {}; if ((o.d || x.d) !== day.d) return; out.push({ e: x, o, t: o.t || x.t, k: o.t || x.t || '23:59', i: 800 + i, own: true, mine: true, from: (o.d && o.d !== x.d) ? (DAYS[dayIndex(x.d)] || {}).dt : null }); });
    return out.sort((a, b) => (a.k === b.k ? a.i - b.i : (a.k < b.k ? -1 : 1)));
  }
  function laterItems() { // "ficou para depois" sem dia
    const out = [];
    for (const d of DAYS) for (const e of d.ev) { const o = S.ov[e.id]; if (o && o.s === 'later') out.push({ e, o, from: d }); }
    for (const x of S.ex) { const o = S.ov[x.id]; if (o && o.s === 'later') out.push({ e: x, o, from: DAYS[dayIndex(x.d)] }); }
    return out;
  }

  /* ---------- navegação ---------- */
  let view = 'hoje', cur = todayIndex(), diasMode = 'tl', open = {}, panel = null;
  const V = ['hoje', 'dias', 'claude', 'pend', 'mais'];
  function go(v, opts) {
    view = v; opts = opts || {};
    V.forEach((k) => { document.getElementById('v-' + k).hidden = k !== v; document.getElementById('t-' + k).setAttribute('aria-selected', String(k === v)); });
    document.getElementById('rail').hidden = v !== 'dias';
    if (v !== 'mais') panel = null;
    render();
    if (!opts.keepScroll) window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function render() {
    const d = DAYS[view === 'dias' ? cur : todayIndex()];
    document.documentElement.style.setProperty('--acc', 'var(' + RG[d.rg] + ')');
    if (view === 'hoje') renderHoje(); else if (view === 'dias') renderDias(); else if (view === 'claude') renderClaude(); else if (view === 'pend') renderPend(); else renderMais();
    badge(); foot();
  }
  function badge() {
    const n = laterItems().length + Object.keys(S.ov).filter((k) => S.ov[k].s === 'miss' && !S.ov[k].res).length;
    const t = document.getElementById('t-pend'); let b = t.querySelector('.bdg');
    if (n) { if (!b) { b = document.createElement('span'); b.className = 'bdg'; t.appendChild(b); } b.textContent = n; } else if (b) b.remove();
  }
  function foot() {
    const f = document.getElementById('foot'); const ph = tripPhase(); const np = nowParts();
    let s = '';
    if (ph === 'antes') s = 'Faltam ' + daysUntil(DAYS[0].d) + ' dias. ';
    else if (ph === 'durante') s = 'Dia ' + (todayIndex() + 1) + ' de 21. ';
    else s = 'Viagem encerrada. ';
    s += 'Tudo fica salvo neste aparelho. ' + (np.sim ? '⚠️ Simulando ' + np.iso + ' ' + np.hm + '. ' : '') + 'v' + APP_VERSION;
    f.textContent = s;
  }
  V.forEach((k) => { document.getElementById('t-' + k).onclick = () => { if (k === 'dias' && view !== 'dias') cur = todayIndex(); go(k); }; });

  /* ---------- rail ---------- */
  function rail() {
    const r = document.getElementById('rail'); r.innerHTML = '';
    const today = nowParts().iso;
    DAYS.forEach((d, i) => {
      const list = effective(d); const doItems = list.filter((x) => x.e.kind !== 'info'); const done = doItems.filter((x) => x.o.s === 'done').length;
      const b = document.createElement('button');
      b.className = 'pill' + (d.d === today ? ' today' : '') + (doItems.length && done === doItems.length ? ' done' : '');
      b.style.setProperty('--rg', 'var(' + RG[d.rg] + ')');
      if (i === cur) b.setAttribute('aria-current', 'true');
      b.innerHTML = '<em>' + (WD[d.wd] || d.wd.toLowerCase()) + '</em><s>' + d.dt.slice(0, 2) + '</s><i></i>';
      b.setAttribute('aria-label', d.dt + ' — ' + d.ti);
      b.onclick = () => { cur = i; open = {}; go('dias'); };
      r.appendChild(b);
    });
    const act = r.querySelector('[aria-current="true"]'); if (act) act.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  /* ---------- item (card) ---------- */
  function itemHtml(x, opts) {
    opts = opts || {};
    const e = x.e, o = x.o, st = o.s || '';
    const info = e.kind === 'info';
    const cls = ['item', st, info ? 'info' : '', opts.cur ? 'cur' : ''].filter(Boolean).join(' ');
    const label = x.t ? '' : cleanLabel(e.h);
    const chips = [];
    if (st === 'done') chips.push('<span class="st d">feito</span>');
    if (st === 'miss') chips.push('<span class="st m">não deu' + (o.why ? ' · ' + esc(o.why) : '') + '</span>');
    if (st === 'later') chips.push('<span class="st l">para depois</span>');
    if (st === 'skip') chips.push('<span class="st s">pulado</span>');
    if (o.t && o.t !== e.t && st !== 'done') chips.push('<span class="st mv">adiado · era ' + esc(e.t || cleanLabel(e.h)) + '</span>');
    if (x.from) chips.push('<span class="st mv">de ' + esc(x.from) + '</span>');
    if (x.mine) chips.push('<span class="st x">' + (e.src === 'claude' ? 'do Claude' : e.src === 'alt' ? 'alternativa' : 'seu') + '</span>');
    const sub = [e.place && e.place !== e.ti ? esc(e.place) : '', e.dur ? '~' + fmtDelta(e.dur) : ''].filter(Boolean).join(' · ');
    const isOpen = !!open[e.id] || opts.full;
    const body = x.mine ? (e.b ? esc(e.b) : '') : e.b;
    return '<div class="' + cls + '" data-c="' + esc(e.c || 'note') + '" data-id="' + esc(e.id) + '">'
      + '<button class="ck" data-act="' + (info ? 'open' : 'done') + '" data-id="' + esc(e.id) + '" aria-label="' + (info ? 'abrir' : 'marcar feito') + '">' + (info ? '<span style="font-size:13px">i</span>' : (st === 'miss' || st === 'later' ? ICON_X : ICON_CK)) + '</button>'
      + '<div class="bd" data-act="open" data-id="' + esc(e.id) + '">'
      + '<div class="top">' + (x.t ? '<span class="hh">' + esc(x.t) + '</span>' : '') + (label ? '<span class="lb">' + esc(label) + '</span>' : '') + chips.join('') + '</div>'
      + '<h4>' + esc(e.ti || cleanLabel(e.h)) + '</h4>'
      + (sub && !isOpen ? '<div class="sub">' + sub + '</div>' : '')
      + (body ? '<div class="txt' + (isOpen ? '' : ' clamp') + '">' + body + '</div>' : '')
      + (o.n ? '<div class="mynote"><em>sua nota</em>' + esc(o.n) + '</div>' : '')
      + (isOpen ? acts(x) : '')
      + '</div></div>';
  }
  function acts(x) {
    const e = x.e, o = x.o, st = o.s || '', id = esc(e.id);
    const a = ['<div class="acts" data-stop="1">'];
    if (e.kind !== 'info') {
      a.push('<button class="act ' + (st === 'done' ? 'on' : 'ok') + '" data-act="done" data-id="' + id + '">' + (st === 'done' ? '✓ feito' : '✓ feito') + '</button>');
      a.push('<button class="act ' + (st === 'miss' || st === 'later' ? 'on' : 'no') + '" data-act="miss" data-id="' + id + '">✗ não consegui</button>');
    }
    if (e.maps) a.push('<a class="act" href="' + mapsUrl(e.maps) + '" target="_blank" rel="noopener">📍 mapa</a>');
    a.push('<button class="act cl" data-act="ask" data-id="' + id + '">✦ perguntar</button>');
    if (x.t || o.t) { a.push('<button class="act" data-act="push" data-m="30" data-id="' + id + '">+30</button>'); a.push('<button class="act" data-act="push" data-m="60" data-id="' + id + '">+1h</button>'); a.push('<button class="act" data-act="push" data-m="-30" data-id="' + id + '">−30</button>'); }
    a.push('<button class="act" data-act="hora" data-id="' + id + '">' + (x.t ? 'hora' : 'dar hora') + '</button>');
    a.push('<button class="act" data-act="move" data-id="' + id + '">mover</button>');
    a.push('<button class="act" data-act="note" data-id="' + id + '">' + (o.n ? 'editar nota' : 'nota') + '</button>');
    if (e.kind !== 'info' && st !== 'skip') a.push('<button class="act" data-act="skip" data-id="' + id + '">pular</button>');
    if (o.t || o.d || o.s || o.n || o.why) a.push('<button class="act" data-act="reset" data-id="' + id + '">restaurar</button>');
    if (x.mine) a.push('<button class="act warnb" data-act="del" data-id="' + id + '">excluir</button>');
    a.push('</div>');
    return a.join('');
  }

  /* ---------- HOJE ---------- */
  function nowNext(list, nowMin) {
    const cand = list.filter((x) => x.e.kind !== 'info' && !closed(x.o.s));
    let started = null; const upcoming = [];
    for (const x of cand) { if (!x.t) continue; const m = toMin(x.t); if (m <= nowMin) started = x; else upcoming.push(x); }
    if (started && started.e.dur && toMin(started.t) + started.e.dur + 45 < nowMin && upcoming.length) started = null; // já passou faz tempo: mostra o próximo
    const curX = started || upcoming[0] || cand[0] || null;
    const ref = curX && curX.t ? toMin(curX.t) : nowMin;
    const next = curX ? (cand.find((x) => x !== curX && x.t && toMin(x.t) > ref) || null) : null;
    return { cur: curX, next };
  }
  function renderHoje() {
    const ti = todayIndex(); const d = DAYS[ti]; const np = nowParts(); const ph = tripPhase();
    const list = effective(d);
    const doItems = list.filter((x) => x.e.kind !== 'info');
    const infos = list.filter((x) => x.e.kind === 'info').sort((a, b) => (rank(a.e.c) - rank(b.e.c)));
    const done = doItems.filter((x) => x.o.s === 'done').length;
    const h = [];
    h.push('<div class="hero"><div class="kick"><span class="acc">' + (ph === 'durante' ? 'hoje' : ph === 'antes' ? 'em ' + daysUntil(d.d) + ' dias' : 'último dia') + '</span><span>·</span><span>' + (WDL[d.wd] || d.wd) + ' ' + d.dt + '</span><span>·</span><span class="acc">' + RGN[d.rg] + '</span><span>·</span><span>' + esc(np.hm) + '</span></div>'
      + '<h1>' + esc(cleanLabel(d.ti)) + '</h1>'
      + (d.lead ? '<p class="lead">' + esc(d.lead) + '</p>' : '')
      + '<div class="chips"><span class="chip acc">dorme: ' + esc(d.base) + '</span>' + d.tags.map((t) => '<span class="chip">' + esc(t) + '</span>').join('') + '</div>'
      + (doItems.length ? '<div class="prog"><div class="bar"><i style="width:' + Math.round(100 * done / doItems.length) + '%"></i></div><span>' + done + ' de ' + doItems.length + ' feito' + (done === 1 ? '' : 's') + '</span></div>' : '')
      + (d.note ? '<div class="daynote">' + d.note + '</div>' : '')
      + '</div>');

    // agora / a seguir
    if (ph !== 'depois') {
      const { cur: cx, next } = nowNext(list, ph === 'durante' ? np.min : -1);
      if (cx) {
        const isNow = ph === 'durante' && cx.t && toMin(cx.t) <= np.min;
        const cd = ph !== 'durante' ? '' : (cx.t ? (isNow ? '<span class="cd live">agora</span>' : '<span class="cd">em ' + fmtDelta(toMin(cx.t) - np.min) + '</span>') : '<span class="cd">sem hora</span>');
        h.push('<div class="sec"><div class="sech"><h2>' + (isNow ? 'Agora' : 'A seguir') + '</h2>' + (next ? '<span class="k">depois: ' + esc(next.t) + ' ' + esc(next.e.ti) + '</span>' : '') + '</div>'
          + '<div class="now" data-id="' + esc(cx.e.id) + '"><span class="k">' + (cx.t ? esc(WDL[d.wd] || '') : esc(cleanLabel(cx.e.h))) + '</span>' + cd
          + (cx.t ? '<div class="t">' + esc(cx.t) + (cx.e.dur ? '<small>~' + fmtDelta(cx.e.dur) + '</small>' : '') + '</div>' : '')
          + '<h3>' + esc(cx.e.ti) + '</h3>' + (cx.e.place ? '<span class="k" style="display:block;margin-top:5px">' + esc(cx.e.place) + '</span>' : '')
          + '<p>' + esc(strip(cx.e.b)) + '</p>'
          + '<div class="btnrow"><button class="btn ok" data-act="done" data-id="' + esc(cx.e.id) + '">' + ICON_CK + ' Feito</button><button class="btn no" data-act="miss" data-id="' + esc(cx.e.id) + '">' + ICON_X + ' Não consegui</button>'
          + (cx.e.maps ? '<a class="btn icon" href="' + mapsUrl(cx.e.maps) + '" target="_blank" rel="noopener" aria-label="mapa">' + ICON_MAP + '</a>' : '') + '</div></div></div>');
      }
    }

    // lembretes de hoje (compactos)
    const rems = D.reminders.filter((r) => r.d === d.d || (r.repeatUntil && r.d <= d.d && d.d <= r.repeatUntil)).filter((r) => !S.ck[r.id + ':' + d.d] && !S.ck[r.id]).sort((a, b) => (a.t < b.t ? -1 : 1));
    if (rems.length) {
      h.push('<div class="sec"><div class="sech"><h2>Lembretes de hoje</h2><span class="k">' + rems.length + '</span></div><div class="list">');
      rems.forEach((r) => {
        const k = 'rem:' + r.id; const isOpen = !!open[k];
        h.push('<div class="item" data-c="warn"><button class="ck" data-act="remdone" data-id="' + esc(r.id + ':' + d.d) + '" aria-label="resolvido">' + ICON_CK + '</button><div class="bd" data-act="toggle" data-k="' + k + '"><div class="top"><span class="hh">' + esc(r.t) + '</span><span class="lb">lembrete</span></div><h4>' + esc(r.ti) + '</h4>' + (isOpen ? '<div class="txt">' + esc(r.b) + '</div><div class="acts" data-stop="1">' + (r.tel ? '<a class="act ok" href="' + telUrl(r.tel) + '">📞 ligar</a>' : '') + (r.url ? '<a class="act" href="' + esc(r.url) + '" target="_blank" rel="noopener">abrir</a>' : '') + '<a class="act" href="' + gcal(r.ti, d.d, r.t, r.dur, r.b) + '" target="_blank" rel="noopener">📅 agenda</a></div>' : '<div class="sub">' + esc(r.b.length > 90 ? r.b.slice(0, 88).replace(/\s+\S*$/, '') + '…' : r.b) + '</div>') + '</div></div>');
      });
      h.push('</div></div>');
    }

    // a lista do dia
    h.push('<div class="sec"><div class="sech"><h2>O plano de hoje</h2><button data-act="addev" data-d="' + esc(d.d) + '">+ acrescentar</button></div><div class="list">');
    if (!doItems.length) h.push('<div class="empty">Nada marcado para hoje.</div>');
    doItems.forEach((x) => h.push(itemHtml(x)));
    h.push('</div></div>');

    // pendentes (ficou para depois)
    const later = laterItems();
    if (later.length) {
      h.push('<div class="sec"><div class="sech"><h2>Ficou para depois</h2><span class="k">' + later.length + '</span></div><div class="list">');
      later.forEach((l) => h.push('<div class="item later" data-id="' + esc(l.e.id) + '"><button class="ck" data-act="miss" data-id="' + esc(l.e.id) + '">' + ICON_X + '</button><div class="bd" data-act="open" data-id="' + esc(l.e.id) + '"><div class="top"><span class="lb">era ' + esc(l.from ? l.from.dt : '') + '</span>' + (l.o.why ? '<span class="st l">' + esc(l.o.why) + '</span>' : '') + '</div><h4>' + esc(l.e.ti) + '</h4>' + (open[l.e.id] ? '<div class="txt">' + (l.e.b || '') + '</div><div class="acts" data-stop="1"><button class="act ok" data-act="todayat" data-id="' + esc(l.e.id) + '">hoje às…</button><button class="act" data-act="move" data-id="' + esc(l.e.id) + '">outro dia</button><button class="act cl" data-act="ask" data-id="' + esc(l.e.id) + '">✦ perguntar</button><button class="act" data-act="skip" data-id="' + esc(l.e.id) + '">desistir</button><button class="act" data-act="reset" data-id="' + esc(l.e.id) + '">restaurar</button></div>' : '') + '</div></div>'));
      h.push('</div></div>');
    }

    // avisos e contexto
    if (infos.length) {
      const k = 'ctx:' + d.d; const isOpen = !!open[k];
      h.push('<div class="sec"><div class="sech"><h2>Avisos e contexto</h2><button data-act="toggle" data-k="' + k + '">' + (isOpen ? 'recolher' : 'ver ' + infos.length) + '</button></div>');
      if (isOpen) { h.push('<div class="list">'); infos.forEach((x) => h.push(itemHtml(x, { full: true }))); h.push('</div>'); }
      else h.push('<div class="list">' + infos.slice(0, 2).map((x) => itemHtml(x)).join('') + '</div>');
      h.push('</div>');
    }

    // etiqueta
    const etq = (d.etq || []).map((i) => D.etiquette[i]).filter(Boolean);
    const pubs = D.etiquette.find((x) => /^Pubs/i.test(strip(x.titulo)));
    const etqList = etq.length ? etq : (pubs ? [pubs] : []);
    if (etqList.length) {
      h.push('<div class="sec"><div class="sech"><h2>Etiqueta de hoje</h2><button data-act="panel" data-p="etiqueta">todos</button></div>');
      etqList.forEach((c) => h.push('<div class="card"><h4>' + c.titulo + '</h4><ul>' + c.itens.slice(0, 3).map((i) => '<li>' + i + '</li>').join('') + '</ul></div>'));
      h.push('</div>');
    }

    // o que mais rola hoje
    const idx = dayIndex(d.d);
    const rola = [];
    D.bands.forEach((f) => f.itens.forEach((it) => { if (it.tipo !== 'fix' && it.de <= idx && idx <= it.ate) rola.push({ f: f.faixa, it }); }));
    if (rola.length) {
      h.push('<div class="sec"><div class="sech"><h2>O que mais rola hoje</h2><button data-act="panel" data-p="calendario">calendário</button></div>');
      rola.forEach((r) => h.push('<div class="card"><span class="k">' + strip(r.f) + '</span><h4 style="margin-top:4px">' + esc(strip(r.it.rotulo)) + '</h4><p>' + r.it.texto + '</p></div>'));
      h.push('</div>');
    }

    // claude atalho
    h.push('<div class="sec"><div class="card cl"><span class="k" style="color:var(--claude)">Claude</span><h4 style="margin-top:4px">Precisa mudar o dia?</h4><p>Ele conhece o plano inteiro, as regras e o que você já fez hoje.</p><div class="btnrow"><button class="btn cl" data-act="askq" data-q="O que faço agora? Considere a hora, onde estou e o que já fiz hoje.">O que faço agora?</button><button class="btn cl" data-act="askq" data-q="Replaneja o resto de hoje a partir de agora, mantendo o que ainda dá para fazer.">Replanejar o resto</button></div></div></div>');

    const el = document.getElementById('v-hoje'); el.innerHTML = h.join('');
    el.querySelectorAll('.txt, .card p, .card li, .daynote, .now p').forEach(linkify);
  }
  function rank(c) { return c === 'gone' ? 0 : c === 'warn' ? 1 : c === 'star' ? 2 : 3; }

  /* ---------- DIAS ---------- */
  function renderDias() {
    rail();
    const el = document.getElementById('v-dias');
    if (diasMode === 'list') { el.innerHTML = listHtml(); return; }
    const d = DAYS[cur]; const list = effective(d);
    const doItems = list.filter((x) => x.e.kind !== 'info'); const done = doItems.filter((x) => x.o.s === 'done').length;
    const today = nowParts().iso;
    const h = [];
    h.push('<div class="hero"><div class="kick"><span>' + (WDL[d.wd] || d.wd) + ' ' + d.dt + '</span><span>·</span><span class="acc">' + RGN[d.rg] + '</span>' + (d.d === today ? '<span>·</span><span class="acc">hoje</span>' : '') + '<button style="margin-left:auto" class="k acc" data-act="diasmode" data-m="list">os 21 dias ›</button></div>'
      + '<h1>' + esc(cleanLabel(d.ti)) + '</h1>' + (d.lead ? '<p class="lead">' + esc(d.lead) + '</p>' : '')
      + '<div class="chips"><span class="chip acc">dorme: ' + esc(d.base) + '</span>' + d.tags.map((t) => '<span class="chip">' + esc(t) + '</span>').join('') + (done ? '<span class="chip ok">' + done + ' de ' + doItems.length + ' feito</span>' : '') + '</div>'
      + (d.note ? '<div class="daynote">' + d.note + '</div>' : '') + '</div>');
    h.push('<div class="sec"><div class="sech"><h2>Linha do dia</h2><button data-act="addev" data-d="' + esc(d.d) + '">+ acrescentar</button></div><div class="list">');
    list.forEach((x) => h.push(itemHtml(x)));
    h.push('</div></div>');
    h.push('<div class="sec"><div class="btnrow">' + (cur > 0 ? '<button class="btn" data-act="day" data-i="' + (cur - 1) + '">‹ ' + esc(DAYS[cur - 1].dt) + '</button>' : '') + (cur < DAYS.length - 1 ? '<button class="btn" data-act="day" data-i="' + (cur + 1) + '">' + esc(DAYS[cur + 1].dt) + ' ›</button>' : '') + '</div></div>');
    el.innerHTML = h.join('');
    el.querySelectorAll('.txt, .daynote').forEach(linkify);
  }
  function listHtml() {
    const h = ['<div class="sec"><div class="sech"><h2>Os 21 dias</h2><button data-act="diasmode" data-m="tl">linha do dia ›</button></div><div class="list">']; let grp = '';
    const today = nowParts().iso;
    DAYS.forEach((d, i) => {
      if (d.rg !== grp) { grp = d.rg; h.push('<div class="lsep">' + RGN[d.rg] + '</div>'); }
      const list = effective(d).filter((x) => x.e.kind !== 'info'), done = list.filter((x) => x.o.s === 'done').length;
      h.push('<button class="lrow' + (i === cur ? ' is' : '') + '" data-act="day" data-i="' + i + '" style="--rg:var(' + RG[d.rg] + ')"><div class="ld">' + (WD[d.wd] || d.wd) + '<b>' + d.dt.slice(0, 2) + '</b></div><div class="lt">' + esc(cleanLabel(d.ti)) + '<span>' + esc(d.base) + (d.d === today ? ' · hoje' : '') + '</span></div><div class="lc">' + list.length + ' itens' + (done ? '<b>' + done + ' feito' + (done > 1 ? 's' : '') + '</b>' : '') + '</div></button>');
    });
    h.push('</div></div>');
    return h.join('');
  }

  /* ---------- PENDÊNCIAS ---------- */
  const PW = { '⛔ PERDIDO': 'r', '🔴 NÃO ESPERA': 'r', '🟠 ESTA SEMANA': 'o', '🟡 SE QUISER': 'y', '✅ DECIDE LÁ': 'g', '⚪ NA SEMANA': 'w' };
  function renderPend() {
    const el = document.getElementById('v-pend'); const h = [];
    const later = laterItems();
    const misses = [];
    for (const d of DAYS) for (const e of d.ev) { const o = S.ov[e.id]; if (o && o.s === 'miss' && !o.res) misses.push({ e, o, from: d }); }
    if (later.length || misses.length) {
      h.push('<div class="sec"><div class="sech"><h2>Do roteiro</h2><span class="k">' + (later.length + misses.length) + '</span></div><div class="list">');
      later.forEach((l) => h.push('<div class="item later" data-id="' + esc(l.e.id) + '"><button class="ck" data-act="miss" data-id="' + esc(l.e.id) + '">' + ICON_X + '</button><div class="bd" data-act="open" data-id="' + esc(l.e.id) + '"><div class="top"><span class="lb">para depois · era ' + esc(l.from ? l.from.dt : '') + '</span></div><h4>' + esc(l.e.ti) + '</h4>' + (open[l.e.id] ? '<div class="txt">' + (l.e.b || '') + '</div><div class="acts" data-stop="1"><button class="act ok" data-act="todayat" data-id="' + esc(l.e.id) + '">hoje às…</button><button class="act" data-act="move" data-id="' + esc(l.e.id) + '">outro dia</button><button class="act cl" data-act="ask" data-id="' + esc(l.e.id) + '">✦ perguntar</button><button class="act" data-act="skip" data-id="' + esc(l.e.id) + '">desistir</button></div>' : '') + '</div></div>'));
      misses.forEach((l) => h.push('<div class="item miss" data-id="' + esc(l.e.id) + '"><button class="ck" data-act="miss" data-id="' + esc(l.e.id) + '">' + ICON_X + '</button><div class="bd" data-act="miss" data-id="' + esc(l.e.id) + '"><div class="top"><span class="lb">não deu · ' + esc(l.from.dt) + '</span>' + (l.o.why ? '<span class="st m">' + esc(l.o.why) + '</span>' : '') + '</div><h4>' + esc(l.e.ti) + '</h4><div class="sub">toque para decidir o que fazer</div></div></div>'));
      h.push('</div></div>');
    }
    const n = BOOK.filter((b) => S.ck[b.id]).length;
    h.push('<div class="sec"><div class="sech"><h2>Reservas e pendências</h2><span class="k">' + n + ' de ' + BOOK.length + '</span></div>');
    h.push('<div class="pnote">Você decidiu <b>não reservar nada antes</b> e resolver na Irlanda — e para quase tudo isso está certo. As linhas em <b>vermelho</b> são estoque que desaparece, não decisão.</div><div class="list">');
    const order = ['🔴 NÃO ESPERA', '🟠 ESTA SEMANA', '🟡 SE QUISER', '⚪ NA SEMANA', '✅ DECIDE LÁ', '⛔ PERDIDO'];
    BOOK.slice().sort((a, b) => order.indexOf(a.w) - order.indexOf(b.w)).forEach((b) => {
      h.push('<button class="pi' + (S.ck[b.id] ? ' ck' : '') + '" data-act="ck" data-id="' + esc(b.id) + '"><div class="box">✓</div><div><span class="pw ' + (PW[b.w] || 'w') + '">' + esc(b.w) + '</span><div class="pt">' + esc(b.t) + '</div><div class="pb">' + b.b + '</div></div></button>');
    });
    h.push('</div></div>');
    // lembretes
    const today = nowParts().iso;
    h.push('<div class="sec"><div class="sech"><h2>Lembretes com hora</h2><span class="k">Irlanda = Brasília + 4h</span></div><div class="list">');
    D.reminders.slice().sort((a, b) => (a.d + a.t < b.d + b.t ? -1 : 1)).forEach((r) => {
      const di = DAYS[dayIndex(r.d)]; const past = r.d < today; const ck = !!S.ck[r.id];
      h.push('<div class="item ' + (ck ? 'done' : past ? 'skip' : '') + '" data-id="' + esc(r.id) + '"><button class="ck" data-act="remdone" data-id="' + esc(r.id) + '">' + ICON_CK + '</button><div class="bd"><div class="top"><span class="hh">' + esc(r.t) + '</span><span class="lb">' + (di ? (WD[di.wd] || '') + ' ' + di.dt : esc(r.d)) + '</span>' + (r.repeatUntil ? '<span class="st s">toda manhã até ' + esc(r.repeatUntil.slice(8, 10) + '/' + r.repeatUntil.slice(5, 7)) + '</span>' : '') + '</div><h4>' + esc(r.ti) + '</h4><div class="txt">' + esc(r.b) + '</div><div class="acts" data-stop="1">' + (r.tel ? '<a class="act ok" href="' + telUrl(r.tel) + '">📞 ligar</a>' : '') + (r.url ? '<a class="act" href="' + esc(r.url) + '" target="_blank" rel="noopener">abrir</a>' : '') + '<a class="act" href="' + gcal(r.ti, r.d, r.t, r.dur, r.b) + '" target="_blank" rel="noopener">📅 Google Agenda</a></div></div></div>');
    });
    h.push('</div></div>');
    el.innerHTML = h.join('');
    el.querySelectorAll('.pb, .txt').forEach(linkify);
  }

  /* ---------- MAIS ---------- */
  const PANELS = {
    ligar: { ic: '📞', t: 'Ligue e confirme', s: 'telefones, dúvidas abertas e links' },
    travado: { ic: '✈️', t: 'O que está travado', s: 'voos, base, estágio, carro' },
    carro: { ic: '🚗', t: 'O carro', s: 'desenho, custo, seguro, carteira' },
    ultima: { ic: '🌙', t: 'A última noite', s: 'de Inchicore ao portão, 15/10' },
    etiqueta: { ic: '🤝', t: 'Etiqueta', s: 'Travellers, câmera, pub, GAA' },
    calendario: { ic: '📆', t: 'O que rola no país', s: 'festivais, corridas, GAA, galgos' },
    richie: { ic: '🍺', t: 'O veredito do Richie', s: 'as respostas que moldaram o plano' },
    mapas: { ic: '🗺️', t: 'Mapas', s: 'Irlanda, Connemara, West Cork' },
    backup: { ic: '💾', t: 'Backup', s: 'exportar, importar, zerar' },
    sobre: { ic: '☘️', t: 'Sobre e instalar', s: 'versão ' + APP_VERSION },
  };
  function renderMais() {
    const el = document.getElementById('v-mais');
    if (panel && PANELS[panel]) { el.innerHTML = '<div class="sub-h"><button class="back" data-act="panel" data-p=""><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>Mais</button><h2>' + PANELS[panel].t + '</h2></div>' + panelHtml(panel); el.querySelectorAll('.card p, .card li, .pb').forEach(linkify); afterPanel(panel); return; }
    const h = ['<div class="sec"><div class="sech"><h2>Mais</h2></div><div class="tiles">'];
    h.push('<button class="tile wide" data-act="cfg"><span class="ic">⚙️</span><b>Configurações</b><span>' + (S.key ? 'Claude conectado · ' + ClaudeAPI.modelInfo(S.cfg.model).name : 'Coloque a chave da API para falar com o Claude') + '</span></button>');
    Object.keys(PANELS).forEach((k) => h.push('<button class="tile" data-act="panel" data-p="' + k + '"><span class="ic">' + PANELS[k].ic + '</span><b>' + PANELS[k].t + '</b><span>' + PANELS[k].s + '</span></button>'));
    h.push('</div></div>');
    el.innerHTML = h.join('');
  }
  function cardList(arr, mapper) { return arr.map(mapper).join(''); }
  function panelHtml(p) {
    if (p === 'ligar') {
      return '<div class="sec"><div class="sech"><h2>Telefones</h2><span class="k">hora local = Brasília + 4h</span></div><div class="list">' + D.phones.map((x) => '<div class="phone"><div><b>' + esc(x.n) + '</b><span>' + esc(x.obs) + '</span></div><a class="tel" href="' + (x.sms ? 'sms:' + x.tel.replace(/\s/g, '') : telUrl(x.tel)) + '">' + ICON_TEL + esc(x.tel) + '</a></div>').join('') + '</div></div>'
        + '<div class="sec"><div class="sech"><h2>Links que resolvem</h2></div><div class="list">' + D.links.map((x) => '<a class="phone" href="' + esc(x.url) + '" target="_blank" rel="noopener" style="border-bottom:1px solid var(--rule)"><div><b>' + esc(x.n) + '</b><span>' + esc(x.obs) + '</span></div><span class="k acc">abrir ›</span></a>').join('') + '</div></div>'
        + '<div class="sec"><div class="sech"><h2>O que não está confirmado</h2><span class="k">' + D.doubts.length + '</span></div>' + cardList(D.doubts, (x) => '<div class="card"><h4>' + x.titulo + '</h4><p>' + x.texto + '</p></div>') + '</div>';
    }
    if (p === 'travado') return '<div class="sec">' + cardList(D.confirmado, (c) => '<div class="card acc"><h4>' + c.titulo + '</h4><ul>' + c.itens.map((i) => '<li>' + i + '</li>').join('') + '</ul></div>') + '<div class="card"><h4>Base em Dublin</h4><p>' + esc(D.trip.home) + '</p><div class="btnrow"><a class="btn sm" href="' + mapsUrl(D.trip.home) + '" target="_blank" rel="noopener">📍 mapa</a></div></div></div>';
    if (p === 'carro') return '<div class="sec">' + cardList(D.carro, (c) => '<div class="card"><h4>' + c.titulo + '</h4><ul>' + c.itens.map((i) => '<li>' + i + '</li>').join('') + '</ul></div>') + '</div>';
    if (p === 'ultima') return '<div class="sec">' + cardList(D.ultima, (u) => '<div class="card ' + (u.classe === 'rec' ? 'g' : u.classe === 'neutro' ? '' : '') + '"><div style="display:flex;gap:10px;align-items:baseline"><h4 style="flex:1">' + u.titulo + '</h4><span class="k">' + esc(u.custo) + '</span></div><p>' + u.texto + '</p>' + (u.aviso ? '<p class="daynote" style="margin-top:8px">' + u.aviso + '</p>' : '') + '</div>') + '</div>';
    if (p === 'etiqueta') return '<div class="sec">' + cardList(D.etiquette, (c) => '<div class="card"><h4>' + c.titulo + '</h4><ul>' + c.itens.map((i) => '<li>' + i + '</li>').join('') + '</ul></div>') + '</div>';
    if (p === 'calendario') {
      const dOf = (i) => DAYS[i] ? DAYS[i].dt : '?';
      return '<div class="sec">' + D.bands.map((f) => '<div class="lsep">' + strip(f.faixa) + '</div>' + f.itens.map((it) => '<div class="card"><span class="k">' + dOf(it.de) + (it.ate !== it.de ? ' – ' + dOf(it.ate) : '') + '</span><h4 style="margin-top:4px">' + esc(strip(it.rotulo)) + '</h4><p>' + it.texto + '</p></div>').join('')).join('') + '</div>';
    }
    if (p === 'richie') return '<div class="sec">' + cardList(D.richie, (c) => '<div class="card"><h4>' + c.titulo + '</h4><p>' + c.texto + '</p></div>') + '</div>';
    if (p === 'mapas') return '<div class="sec"><div class="sech"><h2>Irlanda — as rotas</h2></div><div class="mapwrap map" id="map-nat"><div class="empty">carregando…</div></div><div class="mleg"><div><i style="background:var(--s3)"></i>carro</div><div><i style="background:var(--s2)"></i>ônibus / balsa</div><div><i style="background:var(--s4)"></i>trem</div><div><i style="background:var(--muted)"></i>opcional</div></div></div>'
      + '<div class="sec"><div class="sech"><h2>Connemara e Inishbofin</h2></div><div class="mapwrap map" id="map-con"></div></div><div class="sec"><div class="sech"><h2>West Cork e Beara</h2></div><div class="mapwrap map" id="map-wc"></div></div>';
    if (p === 'backup') return '<div class="sec"><div class="card"><h4>Exportar</h4><p>Baixa um arquivo JSON com tudo o que você marcou, adiou, anotou e conversou. A chave da API <b>não</b> vai junto.</p><div class="btnrow"><button class="btn p" data-act="export">Exportar backup</button></div></div>'
      + '<div class="card"><h4>Importar</h4><p>Restaura um backup exportado antes (substitui o estado atual).</p><div class="btnrow"><label class="btn">Escolher arquivo<input type="file" accept="application/json,.json" id="impfile" hidden></label></div></div>'
      + '<div class="card w"><h4>Zerar</h4><p>Apaga tudo o que foi marcado neste aparelho e volta ao plano original. A chave da API fica.</p><div class="btnrow"><button class="btn no" data-act="reset-all">Zerar o estado</button></div></div></div>';
    if (p === 'sobre') {
      const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      return '<div class="sec"><div class="card"><h4>Irlanda — roteiro · v' + esc(APP_VERSION) + '</h4><p>Dados de ' + esc(D.built) + '. ' + DAYS.length + ' dias, ' + DAYS.reduce((n, d) => n + d.ev.length, 0) + ' itens, ' + DAYS.reduce((n, d) => n + d.ev.reduce((m, e) => m + e.alts.length, 0), 0) + ' alternativas prontas. Funciona sem rede; o Claude precisa de internet.</p></div>'
        + '<div class="card ' + (standalone ? 'g' : 'acc') + '"><h4>' + (standalone ? 'Instalado como app ✓' : 'Instalar na tela inicial') + '</h4><p>' + (standalone ? 'Você está usando a versão instalada.' : 'No Chrome do Android: menu ⋮ → <b>Adicionar à tela inicial</b> (ou "Instalar app"). Abre em tela cheia, sem barra do navegador, e funciona offline.') + '</p>' + (!standalone ? '<div class="btnrow"><button class="btn p" data-act="install" id="btn-install" hidden>Instalar agora</button></div>' : '') + '</div>'
        + '<div class="card"><h4>Atualizações</h4><p>Quando uma versão nova é publicada, o app avisa e recarrega. Se quiser forçar: <button class="act" data-act="update">verificar agora</button></p></div>'
        + '<div class="card"><h4>Como funciona</h4><ul><li><b>Hoje</b> mostra o que fazer agora e a lista do dia. Toque no círculo para marcar feito; em <b>não consegui</b> você escolhe: fazer depois, outra sugestão do plano ou um pedido novo ao Claude.</li><li><b>Dias</b> tem os 21 dias com todos os detalhes, adiar, mover, notas e itens seus.</li><li><b>Claude</b> conhece o plano inteiro, as regras e o que você já fez. As sugestões dele viram itens do dia com um toque.</li><li>A chave da API fica só neste aparelho e vai direto para a Anthropic.</li></ul></div></div>';
    }
    return '';
  }
  function afterPanel(p) {
    if (p === 'mapas') { ['nat', 'con', 'wc'].forEach((k) => { fetch('maps/' + k + '.svg').then((r) => r.text()).then((svg) => { const el = document.getElementById('map-' + k); if (el) el.innerHTML = svg; }).catch(() => { const el = document.getElementById('map-' + k); if (el) el.innerHTML = '<div class="empty">mapa indisponível sem rede</div>'; }); }); }
    if (p === 'backup') { const f = document.getElementById('impfile'); if (f) f.onchange = () => { const file = f.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { try { const v = JSON.parse(rd.result); if (!v || typeof v !== 'object' || !v.ov) throw new Error('formato'); const key = S.key; S = sane(v); S.key = key; save(); toast('Backup restaurado'); render(); } catch (e) { toast('Arquivo inválido'); } }; rd.readAsText(file); }; }
    if (p === 'sobre' && deferredInstall) { const b = document.getElementById('btn-install'); if (b) b.hidden = false; }
  }

  /* ---------- sheet ---------- */
  const sheet = document.getElementById('sheet'), sheetPnl = document.getElementById('sheet-pnl');
  function openSheet(html, onOpen) { sheetPnl.innerHTML = '<div class="grab"></div>' + html; sheet.hidden = false; document.body.style.overflow = 'hidden'; if (onOpen) onOpen(sheetPnl); }
  function closeSheet() { sheet.hidden = true; sheetPnl.innerHTML = ''; document.body.style.overflow = ''; }
  document.getElementById('sheet-bd').onclick = closeSheet;

  function sheetMiss(id) {
    const e = baseEv(id); if (!e) return; const o = ovf(id); const d = dayOfEvent(id);
    const alts = e.alts || [];
    const why = o.why || '';
    openSheet('<h3>Não deu para: ' + esc(e.ti) + '</h3><div class="sub">' + esc([e.t || cleanLabel(e.h), e.place, d ? d.dt : ''].filter(Boolean).join(' · ')) + '</div>'
      + '<div class="k" style="margin-top:14px">por quê? (opcional)</div><div class="reasons">' + REASONS.map((r) => '<button class="act' + (why === r ? ' on' : '') + '" data-why="' + esc(r) + '">' + esc(r) + '</button>').join('') + '</div>'
      + '<div class="opts">'
      + '<button class="opt w" data-go="later"><span class="ic">⏰</span><div><b>Fazer depois</b><span>mais tarde hoje, amanhã ou outro dia</span></div><span class="chev">›</span></button>'
      + '<button class="opt g" data-go="alt"><span class="ic">💡</span><div><b>Outra sugestão</b><span>' + (alts.length ? alts.length + ' alternativa' + (alts.length > 1 ? 's' : '') + ' já pesquisada' + (alts.length > 1 ? 's' : '') + ' + o Claude' : 'pedir ao Claude uma ideia no lugar') + '</span></div><span class="chev">›</span></button>'
      + '<button class="opt cl" data-go="new"><span class="ic">✦</span><div><b>Novo pedido ao Claude</b><span>descreva o que quer e ele monta a partir do plano</span></div><span class="chev">›</span></button>'
      + '<button class="opt" data-go="skip"><span class="ic">—</span><div><b>Só pular</b><span>some da lista de hoje, sem substituto</span></div><span class="chev">›</span></button>'
      + '</div>', (p) => {
        let chosen = why;
        p.querySelectorAll('[data-why]').forEach((b) => { b.onclick = () => { chosen = chosen === b.dataset.why ? '' : b.dataset.why; p.querySelectorAll('[data-why]').forEach((x) => x.classList.toggle('on', x.dataset.why === chosen)); }; });
        p.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => { const g = b.dataset.go; o.why = chosen || null;
          if (g === 'later') sheetLater(id);
          else if (g === 'alt') sheetAlt(id);
          else if (g === 'new') { o.s = 'miss'; o.res = null; save(); closeSheet(); askAbout(id, 'new'); }
          else if (g === 'skip') { o.s = 'skip'; o.res = 'skip'; save(); closeSheet(); render(); toast('Pulado'); }
        }; });
      });
  }
  function sheetLater(id) {
    const e = baseEv(id); const o = ovf(id); const d = dayOfEvent(id); const ti = todayIndex();
    const curDay = (o.d && dayIndex(o.d) >= 0) ? DAYS[dayIndex(o.d)] : d;
    const di = curDay ? dayIndex(curDay.d) : ti;
    const tomorrow = DAYS[di + 1];
    openSheet('<h3>Fazer depois: ' + esc(e.ti) + '</h3><div class="sub">escolha quando</div><div class="opts">'
      + '<div class="btnrow" style="margin-top:0"><button class="btn" data-l="+60">+1h</button><button class="btn" data-l="+120">+2h</button><button class="btn" data-l="+180">+3h</button></div>'
      + '<div class="row"><input class="in hm" id="lt-hm" inputmode="numeric" maxlength="5" placeholder="18:30" aria-label="hora"><button class="btn p" data-l="at">hoje às</button></div>'
      + (tomorrow ? '<button class="opt b" data-l="tomorrow"><span class="ic">→</span><div><b>Amanhã, ' + esc((WD[tomorrow.wd] || '') + ' ' + tomorrow.dt) + '</b><span>' + esc(cleanLabel(tomorrow.ti)) + '</span></div><span class="chev">›</span></button>' : '')
      + '<div class="row"><select class="in" id="lt-day"><option value="">outro dia…</option>' + DAYS.map((x) => '<option value="' + x.d + '">' + x.dt + ' · ' + (WD[x.wd] || x.wd) + ' — ' + esc(x.base) + '</option>').join('') + '</select></div>'
      + '<button class="opt w" data-l="pend"><span class="ic">📌</span><div><b>Deixar pendente, sem dia</b><span>fica em "Ficou para depois" até você decidir</span></div><span class="chev">›</span></button>'
      + '</div>', (p) => {
        const done = (msg) => { o.s = null; o.res = null; save(); closeSheet(); render(); toast(msg); };
        p.querySelectorAll('[data-l]').forEach((b) => { b.onclick = () => { const l = b.dataset.l;
          if (l.startsWith('+')) { const np = nowParts(); let base = o.t || e.t || np.hm; if (dayIndex(np.iso) === di && toMin(base) < np.min) base = np.hm; o.t = addMin(base, +l.slice(1)); done('Adiado para ' + o.t); }
          else if (l === 'at') { const v = p.querySelector('#lt-hm').value.trim(); const m = /^(\d{1,2}):?(\d{2})$/.exec(v); if (!m) { p.querySelector('#lt-hm').focus(); return; } o.t = String(+m[1]).padStart(2, '0') + ':' + m[2]; done('Hoje às ' + o.t); }
          else if (l === 'tomorrow') { o.d = tomorrow.d; done('Movido para ' + tomorrow.dt); }
          else if (l === 'pend') { o.s = 'later'; o.res = null; save(); closeSheet(); render(); toast('Ficou para depois'); }
        }; });
        p.querySelector('#lt-day').onchange = (ev) => { if (!ev.target.value) return; o.d = ev.target.value; done('Movido para ' + ev.target.value.slice(8, 10) + '/' + ev.target.value.slice(5, 7)); };
      });
  }
  function sheetAlt(id) {
    const e = baseEv(id); const o = ovf(id); const alts = e.alts || [];
    openSheet('<h3>No lugar de: ' + esc(e.ti) + '</h3><div class="sub">' + (alts.length ? 'alternativas já pesquisadas no plano' : 'nada pré-pesquisado para este item') + '</div>'
      + alts.map((a, i) => '<div class="alt"><b>' + esc(a.ti) + '</b>' + (a.t ? '<span class="k acc" style="display:block;margin-top:4px">' + esc(a.t) + '</span>' : '') + '<p>' + a.b + '</p><div class="src">' + esc(a.src) + '</div><div class="btnrow"><button class="btn sm ok" data-alt="' + i + '">Usar esta</button>' + (/[A-Za-z]/.test(a.ti) ? '<a class="btn sm" href="' + mapsUrl(a.ti + ' ' + (dayOfEvent(id) || {}).base) + '" target="_blank" rel="noopener">📍</a>' : '') + '</div></div>').join('')
      + '<div class="opts"><button class="opt cl" data-go="claude"><span class="ic">✦</span><div><b>Pedir ao Claude ' + (alts.length ? 'mais ideias' : 'uma ideia') + '</b><span>ele considera a hora, o lugar, o clima e as suas regras</span></div><span class="chev">›</span></button></div>', (p) => {
        p.querySelectorAll('[data-alt]').forEach((b) => { b.onclick = () => { const a = alts[+b.dataset.alt]; const d = dayOfEvent(id); const dd = (o.d && dayIndex(o.d) >= 0) ? o.d : (d ? d.d : nowParts().iso);
          S.ex.push({ id: uid(), d: dd, t: a.t || o.t || e.t || null, h: a.t ? '' : 'no lugar', ti: a.ti, b: a.b, c: 'note', kind: 'do', src: 'alt', from: id, maps: '', place: '', dur: e.dur || 0, alts: [] });
          o.s = 'miss'; o.res = 'alt'; save(); closeSheet(); render(); toast('Trocado por: ' + a.ti); }; });
        p.querySelector('[data-go="claude"]').onclick = () => { o.s = 'miss'; o.res = null; save(); closeSheet(); askAbout(id, 'alt'); };
      });
  }
  function sheetMove(id) {
    const e = baseEv(id); const o = ovf(id);
    openSheet('<h3>Mover: ' + esc(e.ti) + '</h3><div class="sub">para qual dia?</div><div class="opts"><select class="in" id="mv-day"><option value="">escolha o dia…</option>' + DAYS.map((x) => '<option value="' + x.d + '">' + x.dt + ' · ' + (WD[x.wd] || x.wd) + ' — ' + esc(x.base) + '</option>').join('') + '</select></div>', (p) => {
      p.querySelector('#mv-day').onchange = (ev) => { if (!ev.target.value) return; o.d = ev.target.value; if (o.s === 'later') o.s = null; save(); closeSheet(); render(); toast('Movido para ' + ev.target.value.slice(8, 10) + '/' + ev.target.value.slice(5, 7)); };
    });
  }
  function sheetNote(id) {
    const e = baseEv(id); const o = ovf(id);
    openSheet('<h3>Nota: ' + esc(e.ti) + '</h3><textarea class="ta" id="nt-ta" placeholder="O que você quer lembrar deste item" style="margin-top:12px">' + esc(o.n || '') + '</textarea><div class="btnrow"><button class="btn p" id="nt-ok">Salvar</button>' + (o.n ? '<button class="btn" id="nt-del">Apagar nota</button>' : '') + '</div>', (p) => {
      const ta = p.querySelector('#nt-ta'); ta.focus();
      p.querySelector('#nt-ok').onclick = () => { o.n = ta.value.trim() || null; prune(); save(); closeSheet(); render(); };
      const del = p.querySelector('#nt-del'); if (del) del.onclick = () => { o.n = null; prune(); save(); closeSheet(); render(); };
    });
  }
  function sheetHora(id, forceToday) {
    const e = baseEv(id); const o = ovf(id);
    openSheet('<h3>' + (forceToday ? 'Hoje às…' : 'Hora de: ' + esc(e.ti)) + '</h3><div class="row" style="margin-top:12px"><input class="in hm" id="hr-hm" inputmode="numeric" maxlength="5" placeholder="14:30" value="' + esc(o.t || e.t || '') + '"><button class="btn p" id="hr-ok">Marcar</button>' + (o.t ? '<button class="btn" id="hr-clear">Tirar hora</button>' : '') + '</div>', (p) => {
      const inp = p.querySelector('#hr-hm'); inp.focus();
      p.querySelector('#hr-ok').onclick = () => { const m = /^(\d{1,2}):?(\d{2})$/.exec(inp.value.trim()); if (!m) { inp.style.borderColor = 'var(--gone)'; return; } o.t = String(+m[1]).padStart(2, '0') + ':' + m[2]; if (forceToday) { o.d = nowParts().iso; o.s = null; } save(); closeSheet(); render(); toast('Marcado ' + o.t); };
      const c = p.querySelector('#hr-clear'); if (c) c.onclick = () => { o.t = null; prune(); save(); closeSheet(); render(); };
    });
  }
  function sheetAdd(dISO) {
    const d = DAYS[dayIndex(dISO)] || DAYS[todayIndex()];
    openSheet('<h3>Acrescentar ao dia ' + esc(d.dt) + '</h3><div class="field"><label>hora (opcional)</label><input class="in hm" id="ad-hm" inputmode="numeric" maxlength="5" placeholder="09:30"></div><div class="field"><label>o que é</label><input class="in" id="ad-ti" placeholder="Ex.: pint no Slatt\'s com o Richie"></div><div class="field"><label>detalhe (opcional)</label><textarea class="ta" id="ad-b" placeholder="endereço, telefone, preço…"></textarea></div><div class="btnrow"><button class="btn p" id="ad-ok">Adicionar</button></div>', (p) => {
      p.querySelector('#ad-ti').focus();
      p.querySelector('#ad-ok').onclick = () => { const ti = p.querySelector('#ad-ti').value.trim(); if (!ti) { p.querySelector('#ad-ti').focus(); return; } const m = /^(\d{1,2}):?(\d{2})$/.exec(p.querySelector('#ad-hm').value.trim());
        S.ex.push({ id: uid(), d: d.d, t: m ? String(+m[1]).padStart(2, '0') + ':' + m[2] : null, h: m ? '' : 'seu', ti, b: p.querySelector('#ad-b').value.trim(), c: 'note', kind: 'do', src: 'me', maps: ti, place: '', dur: 0, alts: [] });
        save(); closeSheet(); render(); toast('Adicionado'); };
    });
  }

  /* ---------- CONFIG ---------- */
  function sheetCfg() {
    const m = S.cfg.model;
    openSheet('<h3>Configurações</h3><div class="sub">a chave fica só neste aparelho e vai direto para a Anthropic</div>'
      + '<div class="field"><label>chave da API da Anthropic</label><input class="in" id="cf-key" type="password" autocomplete="off" placeholder="sk-ant-…" value="' + esc(S.key || '') + '"><div class="hint">Crie em <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com → API keys</a>. Precisa ter créditos na conta (Billing).</div></div>'
      + '<div class="field"><label>modelo</label><div class="seg" id="cf-model">' + ClaudeAPI.MODELS.map((x) => '<button data-m="' + x.id + '" class="' + (x.id === m ? 'on' : '') + '">' + esc(x.name.replace('Claude ', '')) + '</button>').join('') + '</div><div class="hint" id="cf-model-sub">' + esc(ClaudeAPI.modelInfo(m).sub) + '</div></div>'
      + '<div class="field"><label>esforço (raciocínio)</label><div class="seg" id="cf-effort">' + ['low', 'medium', 'high'].map((x) => '<button data-e="' + x + '" class="' + (x === S.cfg.effort ? 'on' : '') + '">' + ({ low: 'rápido', medium: 'equilibrado', high: 'caprichado' }[x]) + '</button>').join('') + '</div></div>'
      + '<div class="field"><div class="toggle"><div><b>Pesquisar na web</b><span>o Claude confere horários e notícias em sites irlandeses (mais lento, mais certo)</span></div><button class="sw' + (S.cfg.search ? ' on' : '') + '" id="cf-search" aria-label="pesquisar na web"></button></div></div>'
      + '<div class="field"><label>simular data e hora (para testar ou ver outro dia)</label><div class="row" style="margin-top:0"><select class="in" id="cf-simd" style="flex:1"><option value="">agora (relógio real)</option>' + DAYS.map((x) => '<option value="' + x.d + '"' + (S.misc.sim && S.misc.sim.d === x.d ? ' selected' : '') + '>' + x.dt + ' · ' + (WD[x.wd] || x.wd) + '</option>').join('') + '</select><input class="in hm" id="cf-simh" placeholder="09:00" maxlength="5" value="' + esc(S.misc.sim ? S.misc.sim.hm || '' : '') + '"></div></div>'
      + '<div class="btnrow"><button class="btn p" id="cf-ok">Salvar</button><button class="btn" id="cf-cancel">Cancelar</button></div>', (p) => {
        let model = m, effort = S.cfg.effort, search = !!S.cfg.search;
        p.querySelectorAll('#cf-model button').forEach((b) => { b.onclick = () => { model = b.dataset.m; p.querySelectorAll('#cf-model button').forEach((x) => x.classList.toggle('on', x.dataset.m === model)); p.querySelector('#cf-model-sub').textContent = ClaudeAPI.modelInfo(model).sub; }; });
        p.querySelectorAll('#cf-effort button').forEach((b) => { b.onclick = () => { effort = b.dataset.e; p.querySelectorAll('#cf-effort button').forEach((x) => x.classList.toggle('on', x.dataset.e === effort)); }; });
        p.querySelector('#cf-search').onclick = (ev) => { search = !search; ev.currentTarget.classList.toggle('on', search); };
        p.querySelector('#cf-cancel').onclick = closeSheet;
        p.querySelector('#cf-ok').onclick = () => {
          S.key = p.querySelector('#cf-key').value.trim(); S.cfg.model = model; S.cfg.effort = effort; S.cfg.search = search;
          const sd = p.querySelector('#cf-simd').value; const sh = p.querySelector('#cf-simh').value.trim();
          if (sd) { const mm = /^(\d{1,2}):?(\d{2})$/.exec(sh); S.misc.sim = { d: sd, hm: mm ? String(+mm[1]).padStart(2, '0') + ':' + mm[2] : '09:00' }; } else S.misc.sim = null;
          save(); closeSheet(); cur = todayIndex(); render(); toast(S.key ? 'Salvo' : 'Salvo (sem chave: o Claude fica desligado)');
        };
      });
  }
  document.getElementById('btn-cfg').onclick = sheetCfg;

  /* ---------- CLAUDE ---------- */
  let chatCtx = null; // {id, mode:'alt'|'new'|'ask'} — o item sobre o qual o pedido é
  let streaming = null; // {abort, el}
  let stableSystem = null;
  function stableText() {
    if (stableSystem) return stableSystem;
    const c = D.claude;
    stableSystem = [
      'Você é o Claude, o assistente de viagem do Lucas, e está no celular dele durante a viagem. Ele te chama de Claude, com afeto. Responda SEMPRE em português do Brasil, direto, sem formalidade, no tom dos documentos abaixo. Você conhece o plano inteiro; o Lucas está na rua, no pub ou na estrada, lendo no celular: seja curto, concreto, com nome de lugar, endereço, horário e preço quando existirem. Nunca reabra decisões já tomadas (seção 6). Respeite as regras dele: turístico que entrega SIM (Cliffs), só-foto NÃO (Temple Bar NUNCA); música é pano de fundo de pub, nenhum show pago, nada de música como programa; cerveja, natureza, história, gastronomia e gente de verdade antes de vida noturna; ele gosta de "cabaré e bagaceira" e do simples. Se não souber, diga. Se usar pesquisa na web, prefira sites irlandeses e oficiais e cite a fonte numa linha curta.',
      '## Formato de resposta',
      '- Markdown leve: negrito para o que importa, listas curtas. Sem tabelas largas. Sem despedidas.',
      '- Quando você propuser atividades concretas que ele possa colocar no roteiro (uma alternativa, um restaurante, um passeio com hora), TERMINE a resposta com um bloco de código ```json contendo {"sugestoes":[{"d":"YYYY-MM-DD","t":"HH:MM" ou "","ti":"título curto ≤ 48 caracteres","b":"1 a 3 frases com endereço, horário, preço e por quê","maps":"texto de busca no Google Maps ou \\"\\""}]} — no máximo 4 sugestões, só o que realmente recomenda, sem repetir o que já está no plano do dia. Se a resposta não propõe atividade nenhuma, não inclua o bloco.',
      '- Telefones no formato irlandês (01 524 0383, 095 37228) para virarem link.',
      '## Quem é ele, o que está travado, as decisões (documento do projeto)', c.brief,
      '## O plano completo, dia a dia (ids entre colchetes; "do" = ação, "info" = contexto)', c.plan,
      '## Pendências e postura de reservas', c.book,
      '## O que NÃO está confirmado (com telefone que resolve)', c.doubts,
      '## Etiqueta', c.etiquette,
      '## O que mais acontece no país nessas datas', c.bands,
      '## O carro', c.carro,
      '## A última noite (15/10)', c.ultima,
    ].join('\n\n');
    return stableSystem;
  }
  function dynamicText() {
    const np = nowParts(); const ti = todayIndex(); const d = DAYS[ti]; const ph = tripPhase();
    const lines = ['## Agora', 'Data e hora na Irlanda: ' + (WDL[d.wd] || d.wd) + ' ' + d.dt + '/2026, ' + np.hm + (ph === 'antes' ? ' (a viagem ainda não começou; ele chega dia 25/09)' : ph === 'depois' ? ' (a viagem acabou)' : ' — dia ' + (ti + 1) + ' de 21') + '. Base de hoje: ' + d.base + '.'];
    const list = effective(d);
    const st = (x) => { const s = x.o.s; return s === 'done' ? 'FEITO' : s === 'miss' ? 'NÃO CONSEGUIU' + (x.o.why ? ' (' + x.o.why + ')' : '') + (x.o.res === 'alt' ? ' → trocado por alternativa' : '') : s === 'later' ? 'FICOU PARA DEPOIS' : s === 'skip' ? 'PULADO' : 'pendente'; };
    lines.push('## Estado de hoje (' + d.dt + ')');
    list.forEach((x) => { if (x.e.kind === 'info' && !x.mine) return; lines.push('- [' + x.e.id + '] ' + (x.t || cleanLabel(x.e.h)) + ' · ' + x.e.ti + ' — ' + st(x) + (x.o.t && x.o.t !== x.e.t ? ' (adiado de ' + (x.e.t || '?') + ' para ' + x.o.t + ')' : '') + (x.mine ? ' [item ' + (x.e.src === 'claude' ? 'que você sugeriu' : x.e.src === 'alt' ? 'alternativo escolhido' : 'que ele acrescentou') + ': ' + strip(x.e.b).slice(0, 200) + ']' : '') + (x.o.n ? ' · nota dele: "' + x.o.n + '"' : '')); });
    const later = laterItems(); if (later.length) lines.push('## Ficou para depois (sem dia)\n' + later.map((l) => '- ' + l.e.ti + ' (era ' + (l.from ? l.from.dt : '?') + ')' + (l.o.why ? ' · motivo: ' + l.o.why : '')).join('\n'));
    const moved = []; Object.keys(S.ov).forEach((k) => { const o = S.ov[k]; if (o.d) { const e = baseEv(k); const from = dayOfEvent(k); if (e) moved.push('- ' + e.ti + ': movido de ' + (from ? from.dt : '?') + ' para ' + o.d.slice(8, 10) + '/' + o.d.slice(5, 7)); } });
    if (moved.length) lines.push('## Itens movidos de dia\n' + moved.join('\n'));
    const ex = S.ex.filter((x) => x.d !== d.d); if (ex.length) lines.push('## Itens acrescentados em outros dias\n' + ex.map((x) => '- ' + x.d + ' ' + (x.t || '') + ' ' + x.ti).join('\n'));
    const ck = BOOK.filter((b) => S.ck[b.id]).map((b) => b.t); if (ck.length) lines.push('## Pendências já resolvidas\n' + ck.map((t) => '- ' + t).join('\n'));
    if (DAYS[ti + 1]) lines.push('## Amanhã: ' + DAYS[ti + 1].dt + ' — ' + cleanLabel(DAYS[ti + 1].ti) + ' · base ' + DAYS[ti + 1].base);
    if (chatCtx) { const e = baseEv(chatCtx.id); const o = S.ov[chatCtx.id] || {}; if (e) lines.push('## O pedido atual é sobre este item\n[' + e.id + '] ' + (e.t || cleanLabel(e.h)) + ' · ' + e.ti + (o.why ? ' · ele NÃO conseguiu fazer, motivo: ' + o.why : '') + '\nTexto do item: ' + strip(e.b) + (chatCtx.mode === 'alt' ? '\nEle quer ALTERNATIVAS para colocar no lugar, agora, considerando a hora e onde está. Dê 2 a 3, concretas, com o bloco json.' : chatCtx.mode === 'new' ? '\nEle vai descrever o que quer no lugar. Monte a partir do plano e das regras, com o bloco json quando propuser algo concreto.' : '')); }
    return lines.join('\n');
  }
  function systemBlocks() { return [{ type: 'text', text: stableText(), cache_control: { type: 'ephemeral' } }, { type: 'text', text: dynamicText() }]; }

  function renderClaude() {
    const el = document.getElementById('v-claude'); const h = [];
    if (!S.key) {
      h.push('<div class="sec"><div class="card cl"><span class="k" style="color:var(--claude)">Claude</span><h4 style="margin-top:4px">Conecte o Claude</h4><p>Cole a sua chave da API da Anthropic para conversar sobre o roteiro daqui do celular. A chave fica só neste aparelho e as chamadas vão direto para a Anthropic.</p><ol style="padding-left:18px;margin:8px 0 0;color:var(--ink2);font-size:13.4px;line-height:1.55"><li>Abra <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com → API keys</a> e crie uma chave.</li><li>Confira que a conta tem créditos (Billing).</li><li>Cole aqui em Configurações.</li></ol><div class="btnrow"><button class="btn p" data-act="cfg">Abrir configurações</button></div></div></div>');
    }
    h.push('<div class="chat" id="chatlog">');
    if (!S.chat.length) h.push('<div class="empty">Pergunte qualquer coisa sobre a viagem. Ele conhece os 21 dias, as regras, as pendências e o que você já fez hoje.</div>');
    S.chat.forEach((m, i) => h.push(msgHtml(m, i)));
    h.push('</div>');
    h.push('<div class="composer">'
      + (chatCtx ? '<div class="ctxbar">' + (chatCtx.mode === 'alt' ? '💡' : chatCtx.mode === 'new' ? '✦' : '❓') + ' <span>sobre: <b>' + esc((baseEv(chatCtx.id) || {}).ti || '') + '</b></span><button data-act="ctxclear">tirar</button></div>' : '')
      + '<div class="quick">' + quickChips().map((q) => '<button class="act" data-act="askq" data-q="' + esc(q.q) + '">' + esc(q.l) + '</button>').join('') + '</div>'
      + '<div class="cbox"><textarea id="cin" rows="1" placeholder="' + (chatCtx && chatCtx.mode === 'new' ? 'O que você quer fazer no lugar?' : 'Pergunte ao Claude…') + '"></textarea><button class="send" id="csend" aria-label="enviar"' + (streaming ? '' : '') + '>' + (streaming ? ICON_X : '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>') + '</button></div>'
      + '<div class="ctools"><button class="act' + (S.cfg.search ? ' on' : '') + '" data-act="togglesearch">🔎 web ' + (S.cfg.search ? 'ligada' : 'desligada') + '</button><span class="k">' + esc(ClaudeAPI.modelInfo(S.cfg.model).name.replace('Claude ', '')) + ' · ' + esc(S.cfg.effort) + '</span>' + (S.chat.length ? '<button class="act" data-act="newchat" style="margin-left:auto">nova conversa</button>' : '') + '</div>'
      + '</div>');
    el.innerHTML = h.join('');
    el.querySelectorAll('.msg.a').forEach(linkify);
    const ta = document.getElementById('cin');
    ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; };
    ta.onkeydown = (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); sendChat(); } };
    document.getElementById('csend').onclick = () => { if (streaming) { streaming.abort(); } else sendChat(); };
    if (chatCtx && chatCtx.mode === 'new') ta.focus();
    const log = document.getElementById('chatlog'); if (S.chat.length) setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }), 0);
  }
  function quickChips() {
    const np = nowParts(); const h = Math.floor(np.min / 60);
    const base = [
      { l: 'O que faço agora?', q: 'O que faço agora? Considere a hora, onde estou e o que já fiz hoje.' },
      { l: h >= 11 && h < 15 ? 'Onde almoço perto?' : h >= 17 ? 'Onde janto perto?' : 'Onde como perto?', q: 'Onde como agora, perto de onde estou no plano? Barato, autêntico, aberto neste horário. Dê 2 ou 3 opções com endereço.' },
      { l: 'Replanejar o resto do dia', q: 'Replaneja o resto de hoje a partir de agora, mantendo o que ainda dá para fazer e cortando o que não cabe.' },
      { l: 'Amanhã em 3 linhas', q: 'Resume amanhã em 3 linhas: o essencial, o horário que manda e o que preciso preparar hoje.' },
      { l: 'Um pub agora', q: 'Um pub perto, de verdade, sem turista, para uma pint agora. Um só, com endereço e por quê.' },
      { l: 'Como chego lá?', q: 'Como chego ao próximo item do plano a partir de onde estou? Transporte, tempo e custo.' },
    ];
    if (chatCtx && chatCtx.mode === 'alt') base.unshift({ l: '3 alternativas agora', q: 'Me dá 3 alternativas para colocar no lugar deste item, agora, perto de onde estou, respeitando as minhas regras.' });
    return base;
  }
  function msgHtml(m, i) {
    if (m.role === 'user') return '<div class="msg u">' + esc(m.text) + '</div>';
    const parsed = parseSug(m.text);
    return '<div class="msg a' + (m.err ? ' err' : '') + '" data-i="' + i + '"><div class="who">Claude' + (m.model ? '<i>' + esc(shortModel(m.model)) + '</i>' : '') + (m.search ? '<i>🔎</i>' : '') + '</div>' + md(parsed.text) + (parsed.sug.length ? sugHtml(parsed.sug, i) : '') + (m.tail ? '<div class="status" style="margin-top:8px">⚠️ ' + esc(m.tail) + '</div>' : '') + '</div>';
  }
  function shortModel(m) { return String(m).replace(/^claude-/, '').replace(/-\d{8}$/, ''); }
  function sugHtml(sug, mi) {
    return '<div class="sug">' + sug.map((s, j) => { const di = dayIndex(s.d || ''); const d = DAYS[di] || DAYS[todayIndex()]; const added = S.ex.some((x) => x.src === 'claude' && x.sid === mi + ':' + j);
      return '<div class="s"><span class="m">' + esc((WD[d.wd] || '') + ' ' + d.dt + (s.t ? ' · ' + s.t : '')) + '</span><b>' + esc(s.ti || '') + '</b><p>' + esc(s.b || '') + '</p><div class="row">' + (added ? '<span class="k" style="color:var(--done)">✓ no dia ' + d.dt + '</span>' : '<button class="btn sm ok" data-act="addsug" data-mi="' + mi + '" data-j="' + j + '">+ pôr no dia ' + esc(d.dt) + '</button>') + (s.maps ? '<a class="btn sm" href="' + mapsUrl(s.maps) + '" target="_blank" rel="noopener">📍</a>' : '') + '</div></div>'; }).join('') + '</div>';
  }
  function parseSug(text) {
    const re = /```(?:json)?\s*([\s\S]*?)```/g; let m, sug = [], out = text || '';
    while ((m = re.exec(text || ''))) { try { const j = JSON.parse(m[1]); const arr = Array.isArray(j) ? j : (j.sugestoes || j.suggestions || j.sugestões); if (Array.isArray(arr)) { sug = sug.concat(arr.filter((s) => s && s.ti)); out = out.replace(m[0], ''); } } catch (e) { /* bloco não é sugestão */ } }
    return { text: out.trim(), sug: sug.slice(0, 6) };
  }
  function md(src) {
    const lines = (src || '').split('\n'); const out = []; let inList = null, para = [], inCode = false, code = [];
    const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    const flushP = () => { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } };
    const flushL = () => { if (inList) { out.push('</' + inList + '>'); inList = null; } };
    for (const raw of lines) {
      const l = raw.replace(/\s+$/, '');
      if (/^```/.test(l)) { if (inCode) { out.push('<pre>' + esc(code.join('\n')) + '</pre>'); code = []; inCode = false; } else { flushP(); flushL(); inCode = true; } continue; }
      if (inCode) { code.push(l); continue; }
      if (!l.trim()) { flushP(); flushL(); continue; }
      let m;
      if ((m = /^(#{1,3})\s+(.*)/.exec(l))) { flushP(); flushL(); out.push('<h3>' + inline(m[2]) + '</h3>'); continue; }
      if (/^(-{3,}|\*{3,})$/.test(l.trim())) { flushP(); flushL(); out.push('<hr>'); continue; }
      if ((m = /^\s*[-*•]\s+(.*)/.exec(l))) { flushP(); if (inList !== 'ul') { flushL(); out.push('<ul>'); inList = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); continue; }
      if ((m = /^\s*\d+[.)]\s+(.*)/.exec(l))) { flushP(); if (inList !== 'ol') { flushL(); out.push('<ol>'); inList = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); continue; }
      if (/^\|/.test(l)) { flushP(); flushL(); const cells = l.split('|').slice(1, -1); if (cells.every((c) => /^\s*:?-+:?\s*$/.test(c))) continue; out.push('<table><tr>' + cells.map((c) => '<td>' + inline(c.trim()) + '</td>').join('') + '</tr></table>'); continue; }
      if (inList && /^\s{2,}/.test(raw)) { const last = out.length - 1; out[last] = out[last].replace(/<\/li>$/, '<br>' + inline(l.trim()) + '</li>'); continue; }
      flushL(); para.push(l);
    }
    flushP(); flushL(); if (inCode) out.push('<pre>' + esc(code.join('\n')) + '</pre>');
    return out.join('').replace(/<\/table><table>/g, '');
  }
  function askAbout(id, mode) { chatCtx = { id, mode }; go('claude'); if (mode === 'alt') sendChat('Não consegui fazer este item. Me dá 2 ou 3 alternativas para colocar no lugar, agora, perto de onde estou, respeitando as minhas regras.'); }
  async function sendChat(text) {
    if (streaming) return;
    const ta = document.getElementById('cin');
    const msg = (text || (ta ? ta.value : '') || '').trim(); if (!msg) return;
    if (!S.key) { toast('Coloque a chave da API em Configurações'); sheetCfg(); return; }
    if (!navigator.onLine) { toast('Sem rede agora'); }
    if (ta) { ta.value = ''; ta.style.height = 'auto'; }
    S.chat.push({ role: 'user', text: msg, ts: Date.now() });
    const a = { role: 'assistant', text: '', ts: Date.now(), model: null, search: !!S.cfg.search, ctx: chatCtx ? chatCtx.id : null };
    S.chat.push(a); save(); renderClaude();
    const log = document.getElementById('chatlog');
    const el = log.lastElementChild; // a mensagem do assistente vazia
    const status = document.createElement('div'); status.className = 'status'; status.innerHTML = '<span class="sp"></span><span>conectando…</span>'; log.appendChild(status);
    const ctrl = new AbortController(); streaming = { abort: () => ctrl.abort() };
    const sendBtn = document.getElementById('csend'); if (sendBtn) sendBtn.innerHTML = ICON_X;
    // histórico: só texto real (sem erros nem avisos de interface), as últimas 16 mensagens, começando por "user"
    const history = S.chat.slice(0, -1).filter((m) => m.text && !m.err).slice(-16).map((m) => ({ role: m.role, content: m.text }));
    while (history.length && history[0].role !== 'user') history.shift();
    const messages = []; history.forEach((m) => { if (messages.length && messages[messages.length - 1].role === m.role) messages[messages.length - 1].content += '\n\n' + m.content; else messages.push(m); });
    if (!messages.length || messages[messages.length - 1].role !== 'user') messages.push({ role: 'user', content: msg });
    let acc = '';
    const ai = S.chat.length - 1;
    const paint = () => { const node = document.querySelector('.msg.a[data-i="' + ai + '"]') || el; node.innerHTML = '<div class="who">Claude' + (a.model ? '<i>' + esc(shortModel(a.model)) + '</i>' : '') + (a.search ? '<i>🔎</i>' : '') + '</div>' + md(parseSug(acc).text); window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }); };
    try {
      const r = await ClaudeAPI.send({ key: S.key, model: S.cfg.model, effort: S.cfg.effort, search: !!S.cfg.search, system: systemBlocks(), messages, signal: ctrl.signal,
        onEvent: (ev) => {
          if (ev.type === 'text') { acc += ev.text; a.text = acc; if (status.isConnected) status.hidden = true; paint(); }
          else if (ev.type === 'status') { if (status.isConnected) { status.hidden = !ev.text; status.querySelector('span:last-child').textContent = ev.text; } }
          else if (ev.type === 'done') { a.model = ev.model; }
        } });
      if (r) {
        if (r.stopReason === 'refusal') a.tail = 'O pedido foi recusado pelo filtro de segurança. Reformule.';
        else if (r.stopReason === 'max_tokens') a.tail = 'Resposta cortada por tamanho.';
        else if (r.stopReason === 'pause_turn') a.tail = 'A pesquisa parou no meio. Mande "continue" para ele seguir.';
        else if (!r.complete) a.tail = 'A conexão caiu no meio da resposta. Pergunte de novo.';
      }
    } catch (err) {
      const f = ClaudeAPI.friendly(err); a.err = true; a.text = (acc ? acc + '\n\n' : '') + '⚠️ ' + f;
    }
    if (status.isConnected) status.remove(); streaming = null; if (!a.text) { a.text = '_(sem resposta)_'; a.err = true; }
    save(); renderClaude();
  }
  function addSug(mi, j) {
    const m = S.chat[mi]; if (!m) return; const s = parseSug(m.text).sug[j]; if (!s) return;
    const di = dayIndex(s.d || ''); const d = DAYS[di] || DAYS[todayIndex()];
    const t = /^\d{1,2}:\d{2}$/.test(s.t || '') ? s.t : null;
    S.ex.push({ id: uid(), d: d.d, t, h: t ? '' : 'sugestão', ti: String(s.ti).slice(0, 60), b: String(s.b || ''), c: 'note', kind: 'do', src: 'claude', sid: mi + ':' + j, from: chatCtx ? chatCtx.id : null, maps: s.maps || '', place: '', dur: 0, alts: [] });
    if (chatCtx) { const o = ovf(chatCtx.id); if (o.s === 'miss') o.res = 'claude'; }
    save(); renderClaude(); toast('No dia ' + d.dt + ': ' + s.ti);
  }

  /* ---------- ações delegadas ---------- */
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    if (ev.target.closest('a')) return;
    const act = b.dataset.act, id = b.dataset.id;
    const stop = ev.target.closest('[data-stop]');
    if (act === 'open') { if (stop) return; open[id] = !open[id]; render(); return; }
    if (act === 'toggle') { open[b.dataset.k] = !open[b.dataset.k]; render(); return; }
    if (act === 'done') { const o = ovf(id); o.s = o.s === 'done' ? null : 'done'; if (o.s === 'done') { o.res = null; } prune(); save(); render(); if (o.s === 'done') toast('Feito ✓'); return; }
    if (act === 'miss') { sheetMiss(id); return; }
    if (act === 'skip') { const o = ovf(id); o.s = o.s === 'skip' ? null : 'skip'; prune(); save(); render(); return; }
    if (act === 'push') { const o = ovf(id); const e = baseEv(id); o.t = addMin(o.t || (e && e.t) || nowParts().hm, +b.dataset.m); save(); render(); toast('→ ' + o.t); return; }
    if (act === 'hora') { sheetHora(id); return; }
    if (act === 'todayat') { sheetHora(id, true); return; }
    if (act === 'move') { sheetMove(id); return; }
    if (act === 'note') { sheetNote(id); return; }
    if (act === 'reset') { delete S.ov[id]; save(); render(); toast('Restaurado'); return; }
    if (act === 'del') { S.ex = S.ex.filter((x) => x.id !== id); delete S.ov[id]; save(); render(); return; }
    if (act === 'ask') { askAbout(id, 'ask'); return; }
    if (act === 'askq') { chatCtx = chatCtx && chatCtx.mode === 'alt' ? chatCtx : chatCtx; go('claude'); sendChat(b.dataset.q); return; }
    if (act === 'addev') { sheetAdd(b.dataset.d); return; }
    if (act === 'day') { cur = +b.dataset.i; diasMode = 'tl'; open = {}; go('dias'); return; }
    if (act === 'diasmode') { diasMode = b.dataset.m; go('dias'); return; }
    if (act === 'panel') { panel = b.dataset.p || null; go('mais'); return; }
    if (act === 'cfg') { sheetCfg(); return; }
    if (act === 'ck') { if (S.ck[id]) delete S.ck[id]; else S.ck[id] = true; save(); render(); return; }
    if (act === 'remdone') { if (S.ck[id]) delete S.ck[id]; else S.ck[id] = true; save(); render(); return; }
    if (act === 'remdone') { return; }
    if (act === 'addsug') { addSug(+b.dataset.mi, +b.dataset.j); return; }
    if (act === 'ctxclear') { chatCtx = null; renderClaude(); return; }
    if (act === 'togglesearch') { S.cfg.search = !S.cfg.search; save(); renderClaude(); return; }
    if (act === 'newchat') { S.chat = []; chatCtx = null; save(); renderClaude(); return; }
    if (act === 'export') { const data = Object.assign({}, S, { key: undefined }); const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'irlanda-backup-' + nowParts().iso + '.json'; document.body.appendChild(a); a.click(); a.remove(); return; }
    if (act === 'reset-all') { openSheet('<h3>Zerar tudo?</h3><div class="sub">apaga feitos, adiados, notas, itens seus e a conversa</div><div class="btnrow"><button class="btn no" id="rz-ok">Sim, zerar</button><button class="btn" id="rz-no">Cancelar</button></div>', (p) => { p.querySelector('#rz-no').onclick = closeSheet; p.querySelector('#rz-ok').onclick = () => { const key = S.key, cfg = S.cfg; S = JSON.parse(JSON.stringify(BLANK)); S.key = key; S.cfg = cfg; save(); closeSheet(); render(); toast('Zerado'); }; }); return; }
    if (act === 'install') { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } return; }
    if (act === 'update') { checkUpdate(true); return; }
  });

  /* ---------- rede / PWA ---------- */
  function net() { const on = navigator.onLine; document.getElementById('netdot').classList.toggle('off', !on); document.getElementById('nettxt').textContent = on ? (S.key ? 'claude ok' : 'online') : 'offline'; }
  window.addEventListener('online', net); window.addEventListener('offline', net); net();
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; const b = document.getElementById('btn-install'); if (b) b.hidden = false; });
  let swReg = null;
  function checkUpdate(manual) { if (!swReg) { if (manual) toast('Sem service worker (abra pelo https)'); return; } swReg.update().then(() => { if (manual && !swReg.waiting && !swReg.installing) toast('Já está na versão mais nova'); }).catch(() => { if (manual) toast('Não consegui verificar'); }); }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      swReg = reg;
      const onWaiting = () => { const f = document.getElementById('foot'); if (!document.getElementById('upd')) { const b = document.createElement('div'); b.className = 'banner'; b.id = 'upd'; b.innerHTML = 'Versão nova pronta.<button id="upd-go">recarregar</button>'; f.parentNode.insertBefore(b, f); document.getElementById('upd-go').onclick = () => { if (reg.waiting) reg.waiting.postMessage('skipWaiting'); }; } };
      if (reg.waiting) onWaiting();
      reg.addEventListener('updatefound', () => { const nw = reg.installing; if (!nw) return; nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) onWaiting(); }); });
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
    let refreshing = false; const hadController = !!navigator.serviceWorker.controller;
    // na primeira instalação o SW assume a página sem precisar recarregar; só recarrega quando uma versão NOVA assume
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (refreshing || !hadController) return; refreshing = true; location.reload(); });
  }

  /* ---------- relógio ---------- */
  setInterval(() => { if (view === 'hoje' && sheet.hidden && !streaming) renderHoje(); }, 60000);

  /* ---------- boot ---------- */
  go('hoje');
  if (!S.key && !S.misc.seenCfg) { S.misc.seenCfg = true; save(); setTimeout(() => toast('Para falar com o Claude, coloque a chave da API em ⚙️', 4000), 800); }
})();
