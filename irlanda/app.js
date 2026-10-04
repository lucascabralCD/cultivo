/* Irlanda — roteiro. App offline-first; estado em localStorage; Claude direto da API (ou pela conta do claude.ai). */
(function () {
  'use strict';
  const D = window.IRL;
  const I = window.I18N;
  const DAYS = D.days, BOOK = D.book;
  const APP_VERSION = D.version;
  const RG = { dublin: '--dublin', west: '--west', cork: '--cork', tipp: '--tipp', porto: '--porto' };
  const ICON_CK = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_TEL = '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>';
  const ICON_MAP = '<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>';
  const FLAG = { pt: '🇧🇷', en: '🇬🇧', ga: '☘️' };
  const HTML_LANG = { pt: 'pt-BR', en: 'en', ga: 'ga' };

  /* ---------- estado ---------- */
  const LS = 'irl.app.v1';
  const BLANK = { ov: {}, ex: [], ck: {}, chat: [], cfg: { model: 'claude-opus-5', effort: 'medium', search: true, lang: 'pt' }, key: '', misc: {}, tr: {} };
  let S = load();
  function sane(v) { // aceita só o formato esperado (backup importado ou localStorage corrompido)
    if (!v || typeof v !== 'object') throw new Error('formato');
    const s = Object.assign({}, BLANK, v, { cfg: Object.assign({}, BLANK.cfg, (v.cfg && typeof v.cfg === 'object') ? v.cfg : {}), misc: (v.misc && typeof v.misc === 'object') ? v.misc : {} });
    if (!s.ov || typeof s.ov !== 'object' || Array.isArray(s.ov)) s.ov = {};
    if (!s.ck || typeof s.ck !== 'object' || Array.isArray(s.ck)) s.ck = {};
    if (!s.tr || typeof s.tr !== 'object' || Array.isArray(s.tr)) s.tr = {};
    s.ex = (Array.isArray(s.ex) ? s.ex : []).filter((x) => x && typeof x === 'object' && x.id && x.d).map((x) => Object.assign({ t: null, h: '', ti: '', b: '', c: 'note', kind: 'do', src: 'me', maps: '', place: '', dur: 0, alts: [] }, x));
    s.chat = (Array.isArray(s.chat) ? s.chat : []).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string');
    while (s.chat.length && s.chat[s.chat.length - 1].role === 'assistant' && !s.chat[s.chat.length - 1].text) s.chat.pop(); // app morreu no meio de um stream
    if (typeof s.key !== 'string') s.key = '';
    if (!ClaudeAPI.MODELS.some((m) => m.id === s.cfg.model)) s.cfg.model = BLANK.cfg.model;
    if (!['low', 'medium', 'high'].includes(s.cfg.effort)) s.cfg.effort = 'medium';
    if (!I[s.cfg.lang] || !I.langs.some((l) => l.id === s.cfg.lang)) s.cfg.lang = 'pt';
    return s;
  }
  function load() {
    try { const r = localStorage.getItem(LS); if (r) return sane(JSON.parse(r)); } catch (e) { /* ignore */ }
    return JSON.parse(JSON.stringify(BLANK));
  }
  function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { toast(t('save_fail')); } }
  function ovf(id) { if (!S.ov[id]) S.ov[id] = {}; return S.ov[id]; }
  function prune() { Object.keys(S.ov).forEach((k) => { const v = S.ov[k]; if (!v.t && !v.d && !v.s && !v.n && !v.why) delete S.ov[k]; }); }

  /* ---------- língua ---------- */
  let lang = S.cfg.lang || 'pt';
  const L = () => I[lang] || I.pt;
  function t(k, v) {
    let s = L()[k]; if (s == null) s = I.pt[k]; if (s == null) s = k;
    if (typeof s !== 'string') return s;
    if (v) for (const kk in v) s = s.split('{' + kk + '}').join(v[kk]);
    return s;
  }
  const langInfo = () => I.langs.find((x) => x.id === lang) || I.langs[0];
  const wdS = (d) => (L().wd[d.wd] || I.pt.wd[d.wd] || d.wd);
  const wdL = (d) => (L().wdl[d.wd] || I.pt.wdl[d.wd] || d.wd);
  const rgn = (rg) => (L().rg[rg] || rg);
  const reasons = () => L().reasons || I.pt.reasons;
  function applyStatic() {
    document.documentElement.lang = HTML_LANG[lang] || 'pt-BR';
    document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
    const lb = document.getElementById('btn-lang'); if (lb) { lb.textContent = langInfo().short; lb.setAttribute('aria-label', t('lang_aria')); }
    const cb = document.getElementById('btn-cfg'); if (cb) cb.setAttribute('aria-label', t('cfg_aria'));
  }
  function setLang(id) { if (!I[id]) return; lang = id; S.cfg.lang = id; stableSystem = null; save(); applyStatic(); net(); render(); }

  /* ---------- tradução do conteúdo (pelo Claude, guardada no aparelho) ---------- */
  const trBusy = {};
  function TR(sec) { const tr = S.tr && S.tr[lang]; return (tr && tr[sec]) || null; }
  function X(sec, key, orig) { if (lang === 'pt') return orig; const m = TR(sec); const v = m && m[key]; return (typeof v === 'string' && v) ? v : orig; }
  const dsec = (d) => 'd:' + d.d;
  const dTi = (d) => X(dsec(d), 'ti', d.ti), dLead = (d) => X(dsec(d), 'lead', d.lead), dNote = (d) => X(dsec(d), 'note', d.note), dTag = (d, i) => X(dsec(d), 'tag.' + i, d.tags[i]);
  const eTi = (e, d) => (d ? X(dsec(d), 'e.' + e.id + '.ti', e.ti) : e.ti);
  const eH = (e, d) => (d ? X(dsec(d), 'e.' + e.id + '.h', cleanLabel(e.h)) : cleanLabel(e.h));
  const eB = (e, d) => (d ? X(dsec(d), 'e.' + e.id + '.b', e.b) : e.b);
  const aTi = (e, j, d) => (d ? X(dsec(d), 'e.' + e.id + '.a' + j + '.ti', e.alts[j].ti) : e.alts[j].ti);
  const aB = (e, j, d) => (d ? X(dsec(d), 'e.' + e.id + '.a' + j + '.b', e.alts[j].b) : e.alts[j].b);
  function dayMap(d) {
    const m = {}; const put = (k, v) => { if (typeof v === 'string' && v.trim()) m[k] = v; };
    put('ti', d.ti); put('lead', d.lead); put('note', d.note); d.tags.forEach((tg, i) => put('tag.' + i, tg));
    d.ev.forEach((e) => { put('e.' + e.id + '.ti', e.ti); if (!e.t) put('e.' + e.id + '.h', cleanLabel(e.h)); put('e.' + e.id + '.b', e.b); (e.alts || []).forEach((a, j) => { put('e.' + e.id + '.a' + j + '.ti', a.ti); put('e.' + e.id + '.a' + j + '.b', a.b); }); });
    return m;
  }
  const SECS = {
    book: () => { const m = {}; BOOK.forEach((b) => { m[b.id + '.t'] = b.t; m[b.id + '.b'] = b.b; }); return m; },
    doubts: () => { const m = {}; D.doubts.forEach((x, i) => { m[i + '.ti'] = x.titulo; m[i + '.tx'] = x.texto; }); return m; },
    etq: () => { const m = {}; D.etiquette.forEach((c, i) => { m[i + '.ti'] = c.titulo; c.itens.forEach((it, j) => { m[i + '.' + j] = it; }); }); return m; },
    bands: () => { const m = {}; D.bands.forEach((f, i) => { m['f' + i] = f.faixa; f.itens.forEach((it, j) => { m[i + '.' + j + '.ro'] = it.rotulo; m[i + '.' + j + '.tx'] = it.texto; }); }); return m; },
    confirmado: () => { const m = {}; D.confirmado.forEach((c, i) => { m[i + '.ti'] = c.titulo; c.itens.forEach((it, j) => { m[i + '.' + j] = it; }); }); return m; },
    carro: () => { const m = {}; D.carro.forEach((c, i) => { m[i + '.ti'] = c.titulo; c.itens.forEach((it, j) => { m[i + '.' + j] = it; }); }); return m; },
    ultima: () => { const m = {}; D.ultima.forEach((u, i) => { m[i + '.ti'] = u.titulo; m[i + '.tx'] = u.texto; if (u.aviso) m[i + '.av'] = u.aviso; }); return m; },
    richie: () => { const m = {}; D.richie.forEach((c, i) => { m[i + '.ti'] = c.titulo; m[i + '.tx'] = c.texto; }); return m; },
    reminders: () => { const m = {}; D.reminders.forEach((r) => { m[r.id + '.ti'] = r.ti; m[r.id + '.b'] = r.b; }); return m; },
    ligar: () => { const m = {}; D.phones.forEach((p, i) => { m['p' + i] = p.obs; }); D.links.forEach((l, i) => { m['l' + i] = l.obs; m['ln' + i] = l.n; }); return m; },
  };
  function secMap(sec) { if (sec.startsWith('d:')) { const d = DAYS[dayIndex(sec.slice(2))]; return d ? dayMap(d) : {}; } return SECS[sec] ? SECS[sec]() : {}; }
  function trBtn(sec, label) {
    if (lang === 'pt' || TR(sec)) return '';
    if (trBusy[sec]) return '<div class="status" style="margin:4px 0 10px"><span class="sp"></span><span>' + esc(t('tr_loading')) + '</span></div>';
    return '<div class="btnrow" style="margin:0 0 10px"><button class="btn sm cl" data-act="tr" data-sec="' + esc(sec) + '">🌐 ' + esc(label || t('tr_section')) + '</button><span class="k" style="align-self:center">' + esc(t('tr_hint')) + '</span></div>';
  }
  const trDayBtn = (d) => trBtn(dsec(d), t('tr_day', { lang: langInfo().name }));
  async function askClaudeRaw(sys, user) {
    let acc = '';
    const onEvent = (ev) => { if (ev.type === 'text') acc = ev.whole ? ev.text : acc + ev.text; };
    if (SAMPLE) await ClaudeAPI.sendSample({ sample: SAMPLE, turns: [{ role: 'user', content: sys + '\n\n' + user }], onEvent, tier: 'default' });
    else await ClaudeAPI.send({ key: S.key, model: S.cfg.model, effort: 'low', search: false, system: [{ type: 'text', text: sys }], messages: [{ role: 'user', content: user }], onEvent, maxTokens: 16000 });
    return acc;
  }
  function parseJsonObject(text) {
    const s = String(text || '').replace(/```(?:json)?/gi, ''); const i = s.indexOf('{'), j = s.lastIndexOf('}');
    if (i < 0 || j <= i) throw new Error('JSON');
    return JSON.parse(s.slice(i, j + 1));
  }
  async function translateSection(sec) {
    if (lang === 'pt' || trBusy[sec]) return;
    if (!hasClaude()) { toast(t('tr_need')); if (!IN_ARTIFACT) sheetCfg(); return; }
    const map = secMap(sec); const keys = Object.keys(map).filter((k) => !(TR(sec) && TR(sec)[k]));
    if (!keys.length) return;
    trBusy[sec] = true; render();
    const target = { en: 'English', ga: 'Irish (Gaeilge)' }[lang] || lang;
    const sys = 'You translate the content of a Brazilian traveller\'s itinerary app (Ireland and Porto, October 2026). Translate the VALUES of the JSON object the user sends from Brazilian Portuguese into ' + target + '. Rules: keep every key exactly as it is and return every key; keep the light HTML tags (<b>, <i>, <a …>) and emoji in place; never translate or alter proper names, place names, addresses, phone numbers, prices, times, dates, bus or road numbers and URLs; keep the direct, informal, second-person tone; keep the meaning, add nothing. Reply with ONLY the JSON object, no code fence and no commentary.';
    try {
      const chunks = []; let curC = {}, size = 0;
      for (const k of keys) { const len = map[k].length + k.length + 8; if (size + len > 9000 && Object.keys(curC).length) { chunks.push(curC); curC = {}; size = 0; } curC[k] = map[k]; size += len; }
      if (Object.keys(curC).length) chunks.push(curC);
      for (const c of chunks) {
        const out = parseJsonObject(await askClaudeRaw(sys, JSON.stringify(c)));
        S.tr[lang] = S.tr[lang] || {}; S.tr[lang][sec] = S.tr[lang][sec] || {};
        Object.keys(c).forEach((k) => { if (typeof out[k] === 'string' && out[k].trim()) S.tr[lang][sec][k] = out[k]; });
        save();
      }
      toast(t('tr_done'));
    } catch (err) {
      toast(t('tr_fail', { e: SAMPLE ? ClaudeAPI.sampleFriendly(err) : ClaudeAPI.friendly(err) }), 4000);
    }
    trBusy[sec] = false; render();
  }

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
  function todayIndex() { const t0 = nowParts().iso; const i = dayIndex(t0); if (i >= 0) return i; return t0 < DAYS[0].d ? 0 : DAYS.length - 1; }
  function tripPhase() { const t0 = nowParts().iso; if (t0 < DAYS[0].d) return 'antes'; if (t0 > DAYS[DAYS.length - 1].d) return 'depois'; return 'durante'; }
  function daysUntil(iso) { const t0 = nowParts().iso; return Math.round((new Date(iso + 'T00:00:00Z') - new Date(t0 + 'T00:00:00Z')) / 864e5); }
  const ddmm = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);

  /* ---------- helpers ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  const cleanLabel = (h) => String(h || '').replace(/^[★⚠️⛔⚡✅⭐]+\s*/u, '').trim();
  function mapsUrl(q) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q); }
  function telUrl(x) { return 'tel:' + String(x).replace(/[^\d+]/g, ''); }
  function linkify(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = []; let n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach((node) => {
      if (node.parentNode.closest('a')) return;
      const tx = node.nodeValue;
      const re = /(\+353[\d\s]{7,14}\d|\b0\d{2,3}\s\d{5,7}\b|\b0\d{1,2}\s\d{3,4}\s\d{3,4}\b|\b0\d{3}\s\d{2}\s\d{3}\b)|\b((?:[a-z0-9-]+\.)+(?:ie|com|org|net|pt|eu)(?:\/[^\s,)]*)?)\b/gi;
      if (!re.test(tx)) return; re.lastIndex = 0;
      const frag = document.createDocumentFragment(); let last = 0, m;
      while ((m = re.exec(tx))) {
        if (m.index > last) frag.appendChild(document.createTextNode(tx.slice(last, m.index)));
        const a = document.createElement('a');
        if (m[1]) { a.href = telUrl(m[1]); } else { a.href = 'https://' + m[2]; a.target = '_blank'; a.rel = 'noopener'; }
        a.textContent = m[0]; frag.appendChild(a); last = m.index + m[0].length;
      }
      if (last < tx.length) frag.appendChild(document.createTextNode(tx.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }
  function uid() { return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function toast(msg, ms) { const el = document.getElementById('toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('on'), ms || 2200); }
  function closed(s) { return s === 'done' || s === 'skip' || s === 'miss' || s === 'later'; }
  function gcal(ti, d, tm, dur, details) {
    const ds = d.replace(/-/g, ''), st = (tm || '09:00').replace(':', '') + '00', en = addMin(tm || '09:00', dur || 30).replace(':', '') + '00';
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(ti) + '&dates=' + ds + 'T' + st + '/' + ds + 'T' + en + '&ctz=Europe/Dublin&details=' + encodeURIComponent(details || '');
  }
  const plural = (n, one, many, v) => t(n === 1 ? one : many, v);

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
      const tm = o.t || e.t; if (tm) carried = tm;
      out.push({ e, o, t: tm, k: (o.t || e.t || carried || '00:00'), i, own: true, d: day });
    });
    DAYS.forEach((d2) => { if (d2.d === day.d) return; d2.ev.forEach((e, i) => { const o = S.ov[e.id] || {}; if (o.d === day.d) out.push({ e, o, t: o.t || e.t, k: o.t || e.t || '00:00', i: 900 + i, own: false, from: d2.dt, d: d2 }); }); });
    S.ex.forEach((x, i) => { const o = S.ov[x.id] || {}; if ((o.d || x.d) !== day.d) return; out.push({ e: x, o, t: o.t || x.t, k: o.t || x.t || '23:59', i: 800 + i, own: true, mine: true, d: null, from: (o.d && o.d !== x.d) ? (DAYS[dayIndex(x.d)] || {}).dt : null }); });
    return out.sort((a, b) => (a.k === b.k ? a.i - b.i : (a.k < b.k ? -1 : 1)));
  }
  function laterItems() { // "ficou para depois" sem dia
    const out = [];
    for (const d of DAYS) for (const e of d.ev) { const o = S.ov[e.id]; if (o && o.s === 'later') out.push({ e, o, from: d, d }); }
    for (const x of S.ex) { const o = S.ov[x.id]; if (o && o.s === 'later') out.push({ e: x, o, from: DAYS[dayIndex(x.d)], d: null, mine: true }); }
    return out;
  }
  const evTi = (x) => (x.mine ? x.e.ti : eTi(x.e, x.d));
  const evB = (x) => (x.mine ? (x.e.b ? esc(x.e.b) : '') : eB(x.e, x.d));
  const evH = (x) => (x.mine ? cleanLabel(x.e.h) : eH(x.e, x.d));

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
    const tab = document.getElementById('t-pend'); let b = tab.querySelector('.bdg');
    if (n) { if (!b) { b = document.createElement('span'); b.className = 'bdg'; tab.appendChild(b); } b.textContent = n; } else if (b) b.remove();
  }
  function foot() {
    const f = document.getElementById('foot'); const ph = tripPhase(); const np = nowParts();
    let s = '';
    if (ph === 'antes') s = t('days_left', { n: daysUntil(DAYS[0].d) }) + ' ';
    else if (ph === 'durante') s = t('day_of', { n: todayIndex() + 1 }) + ' ';
    else s = t('trip_over') + ' ';
    s += (IN_ARTIFACT ? t('art_foot') + ' ' : t('saved_device') + ' ') + (np.sim ? t('simulating', { d: np.iso, t: np.hm }) + ' ' : '') + 'v' + APP_VERSION;
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
      b.innerHTML = '<em>' + esc(wdS(d)) + '</em><s>' + d.dt.slice(0, 2) + '</s><i></i>';
      b.setAttribute('aria-label', d.dt + ' — ' + strip(dTi(d)));
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
    const label = x.t ? '' : evH(x);
    const chips = [];
    if (st === 'done') chips.push('<span class="st d">' + esc(t('st_done')) + '</span>');
    if (st === 'miss') chips.push('<span class="st m">' + esc(t('st_miss')) + (o.why ? ' · ' + esc(o.why) : '') + '</span>');
    if (st === 'later') chips.push('<span class="st l">' + esc(t('st_later')) + '</span>');
    if (st === 'skip') chips.push('<span class="st s">' + esc(t('st_skip')) + '</span>');
    if (o.t && o.t !== e.t && st !== 'done') chips.push('<span class="st mv">' + esc(t('st_moved', { t: e.t || evH(x) })) + '</span>');
    if (x.from) chips.push('<span class="st mv">' + esc(t('st_from', { dt: x.from })) + '</span>');
    if (x.mine) chips.push('<span class="st x">' + esc(t(e.src === 'claude' ? 'src_claude' : e.src === 'alt' ? 'src_alt' : 'src_me')) + '</span>');
    const ti = evTi(x);
    const sub = [e.place && e.place !== ti ? esc(e.place) : '', e.dur ? '~' + fmtDelta(e.dur) : ''].filter(Boolean).join(' · ');
    const isOpen = !!open[e.id] || opts.full;
    const body = evB(x);
    return '<div class="' + cls + '" data-c="' + esc(e.c || 'note') + '" data-id="' + esc(e.id) + '">'
      + '<button class="ck" data-act="' + (info ? 'open' : 'done') + '" data-id="' + esc(e.id) + '" aria-label="' + esc(t(info ? 'aria_open' : 'aria_done')) + '">' + (info ? '<span style="font-size:13px">i</span>' : (st === 'miss' || st === 'later' ? ICON_X : ICON_CK)) + '</button>'
      + '<div class="bd" data-act="open" data-id="' + esc(e.id) + '">'
      + '<div class="top">' + (x.t ? '<span class="hh">' + esc(x.t) + '</span>' : '') + (label ? '<span class="lb">' + esc(label) + '</span>' : '') + chips.join('') + '</div>'
      + '<h4>' + esc(ti || evH(x)) + '</h4>'
      + (sub && !isOpen ? '<div class="sub">' + sub + '</div>' : '')
      + (body ? '<div class="txt' + (isOpen ? '' : ' clamp') + '">' + body + '</div>' : '')
      + (o.n ? '<div class="mynote"><em>' + esc(t('my_note')) + '</em>' + esc(o.n) + '</div>' : '')
      + (isOpen ? acts(x) : '')
      + '</div></div>';
  }
  function acts(x) {
    const e = x.e, o = x.o, st = o.s || '', id = esc(e.id);
    const a = ['<div class="acts" data-stop="1">'];
    if (e.kind !== 'info') {
      a.push('<button class="act ' + (st === 'done' ? 'on' : 'ok') + '" data-act="done" data-id="' + id + '">' + esc(t('act_done')) + '</button>');
      a.push('<button class="act ' + (st === 'miss' || st === 'later' ? 'on' : 'no') + '" data-act="miss" data-id="' + id + '">' + esc(t('act_miss')) + '</button>');
    }
    if (e.maps) a.push('<a class="act" href="' + mapsUrl(e.maps) + '" target="_blank" rel="noopener">' + esc(t('act_map')) + '</a>');
    a.push('<button class="act cl" data-act="ask" data-id="' + id + '">' + esc(t('ask')) + '</button>');
    if (x.t || o.t) { a.push('<button class="act" data-act="push" data-m="30" data-id="' + id + '">+30</button>'); a.push('<button class="act" data-act="push" data-m="60" data-id="' + id + '">+1h</button>'); a.push('<button class="act" data-act="push" data-m="-30" data-id="' + id + '">−30</button>'); }
    a.push('<button class="act" data-act="hora" data-id="' + id + '">' + esc(t(x.t ? 'act_time' : 'act_settime')) + '</button>');
    a.push('<button class="act" data-act="move" data-id="' + id + '">' + esc(t('act_move')) + '</button>');
    a.push('<button class="act" data-act="note" data-id="' + id + '">' + esc(t(o.n ? 'act_editnote' : 'act_note')) + '</button>');
    if (e.kind !== 'info' && st !== 'skip') a.push('<button class="act" data-act="skip" data-id="' + id + '">' + esc(t('act_skip')) + '</button>');
    if (o.t || o.d || o.s || o.n || o.why) a.push('<button class="act" data-act="reset" data-id="' + id + '">' + esc(t('restore')) + '</button>');
    if (x.mine) a.push('<button class="act warnb" data-act="del" data-id="' + id + '">' + esc(t('act_del')) + '</button>');
    a.push('</div>');
    return a.join('');
  }
  function laterRow(l, withRestore) {
    const id = esc(l.e.id); const ti = l.mine ? l.e.ti : eTi(l.e, l.d); const b = l.mine ? esc(l.e.b || '') : eB(l.e, l.d);
    return '<div class="item later" data-id="' + id + '"><button class="ck" data-act="miss" data-id="' + id + '">' + ICON_X + '</button><div class="bd" data-act="open" data-id="' + id + '"><div class="top"><span class="lb">' + esc(t('later_was', { dt: l.from ? l.from.dt : '' })) + '</span>' + (l.o.why ? '<span class="st l">' + esc(l.o.why) + '</span>' : '') + '</div><h4>' + esc(ti) + '</h4>'
      + (open[l.e.id] ? '<div class="txt">' + b + '</div><div class="acts" data-stop="1"><button class="act ok" data-act="todayat" data-id="' + id + '">' + esc(t('today_at')) + '</button><button class="act" data-act="move" data-id="' + id + '">' + esc(t('other_day')) + '</button><button class="act cl" data-act="ask" data-id="' + id + '">' + esc(t('ask')) + '</button><button class="act" data-act="skip" data-id="' + id + '">' + esc(t('give_up')) + '</button>' + (withRestore ? '<button class="act" data-act="reset" data-id="' + id + '">' + esc(t('restore')) + '</button>' : '') + '</div>' : '') + '</div></div>';
  }
  function heroChips(d, done, total) {
    return '<div class="chips"><span class="chip acc">' + esc(t('sleeps', { base: d.base })) + '</span>' + d.tags.map((tg, i) => '<span class="chip">' + esc(dTag(d, i)) + '</span>').join('') + (done ? '<span class="chip ok">' + esc(plural(done, 'done_of', 'done_of_pl', { done, total })) + '</span>' : '') + '</div>';
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
    h.push('<div class="hero"><div class="kick"><span class="acc">' + esc(ph === 'durante' ? t('today') : ph === 'antes' ? t('in_days', { n: daysUntil(d.d) }) : t('last_day')) + '</span><span>·</span><span>' + esc(wdL(d) + ' ' + d.dt) + '</span><span>·</span><span class="acc">' + esc(rgn(d.rg)) + '</span><span>·</span><span>' + esc(np.hm) + '</span></div>'
      + '<h1>' + esc(cleanLabel(dTi(d))) + '</h1>'
      + (d.lead ? '<p class="lead">' + esc(dLead(d)) + '</p>' : '')
      + heroChips(d, 0, doItems.length)
      + (doItems.length ? '<div class="prog"><div class="bar"><i style="width:' + Math.round(100 * done / doItems.length) + '%"></i></div><span>' + esc(plural(done, 'done_of', 'done_of_pl', { done, total: doItems.length })) + '</span></div>' : '')
      + (d.note ? '<div class="daynote">' + dNote(d) + '</div>' : '')
      + '</div>');
    const trb = trDayBtn(d); if (trb) h.push('<div class="sec" style="padding-bottom:0">' + trb + '</div>');

    // agora / a seguir
    if (ph !== 'depois') {
      const { cur: cx, next } = nowNext(list, ph === 'durante' ? np.min : -1);
      if (cx) {
        const isNow = ph === 'durante' && cx.t && toMin(cx.t) <= np.min;
        const cd = ph !== 'durante' ? '' : (cx.t ? (isNow ? '<span class="cd live">' + esc(t('live')) + '</span>' : '<span class="cd">' + esc(t('in_', { t: fmtDelta(toMin(cx.t) - np.min) })) + '</span>') : '<span class="cd">' + esc(t('no_time')) + '</span>');
        h.push('<div class="sec"><div class="sech"><h2>' + esc(t(isNow ? 'now' : 'next')) + '</h2>' + (next ? '<span class="k">' + esc(t('after') + next.t + ' ' + evTi(next)) + '</span>' : '') + '</div>'
          + '<div class="now" data-id="' + esc(cx.e.id) + '"><span class="k">' + esc(cx.t ? wdL(d) : evH(cx)) + '</span>' + cd
          + (cx.t ? '<div class="t">' + esc(cx.t) + (cx.e.dur ? '<small>~' + fmtDelta(cx.e.dur) + '</small>' : '') + '</div>' : '')
          + '<h3>' + esc(evTi(cx)) + '</h3>' + (cx.e.place ? '<span class="k" style="display:block;margin-top:5px">' + esc(cx.e.place) + '</span>' : '')
          + '<p>' + esc(strip(evB(cx))) + '</p>'
          + '<div class="btnrow"><button class="btn ok" data-act="done" data-id="' + esc(cx.e.id) + '">' + ICON_CK + ' ' + esc(t('btn_done')) + '</button><button class="btn no" data-act="miss" data-id="' + esc(cx.e.id) + '">' + ICON_X + ' ' + esc(t('btn_miss')) + '</button>'
          + (cx.e.maps ? '<a class="btn icon" href="' + mapsUrl(cx.e.maps) + '" target="_blank" rel="noopener" aria-label="' + esc(t('act_map')) + '">' + ICON_MAP + '</a>' : '') + '</div></div></div>');
      }
    }

    // lembretes de hoje (compactos)
    const rems = D.reminders.filter((r) => r.d === d.d || (r.repeatUntil && r.d <= d.d && d.d <= r.repeatUntil)).filter((r) => !S.ck[r.id + ':' + d.d] && !S.ck[r.id]).sort((a, b) => (a.t < b.t ? -1 : 1));
    if (rems.length) {
      h.push('<div class="sec"><div class="sech"><h2>' + esc(t('reminders_today')) + '</h2><span class="k">' + rems.length + '</span></div>' + trBtn('reminders') + '<div class="list">');
      rems.forEach((r) => {
        const k = 'rem:' + r.id; const isOpen = !!open[k]; const rti = X('reminders', r.id + '.ti', r.ti), rb = X('reminders', r.id + '.b', r.b);
        h.push('<div class="item" data-c="warn"><button class="ck" data-act="remdone" data-id="' + esc(r.id + ':' + d.d) + '" aria-label="' + esc(t('aria_done')) + '">' + ICON_CK + '</button><div class="bd" data-act="toggle" data-k="' + k + '"><div class="top"><span class="hh">' + esc(r.t) + '</span><span class="lb">' + esc(t('reminder')) + '</span></div><h4>' + esc(rti) + '</h4>' + (isOpen ? '<div class="txt">' + esc(rb) + '</div><div class="acts" data-stop="1">' + (r.tel ? '<a class="act ok" href="' + telUrl(r.tel) + '">' + esc(t('call')) + '</a>' : '') + (r.url ? '<a class="act" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(t('open')) + '</a>' : '') + '<a class="act" href="' + gcal(rti, d.d, r.t, r.dur, rb) + '" target="_blank" rel="noopener">' + esc(t('agenda')) + '</a></div>' : '<div class="sub">' + esc(rb.length > 90 ? rb.slice(0, 88).replace(/\s+\S*$/, '') + '…' : rb) + '</div>') + '</div></div>');
      });
      h.push('</div></div>');
    }

    // a lista do dia
    h.push('<div class="sec"><div class="sech"><h2>' + esc(t('plan_today')) + '</h2><button data-act="addev" data-d="' + esc(d.d) + '">' + esc(t('add')) + '</button></div><div class="list">');
    if (!doItems.length) h.push('<div class="empty">' + esc(t('nothing_today')) + '</div>');
    doItems.forEach((x) => h.push(itemHtml(x)));
    h.push('</div></div>');

    // pendentes (ficou para depois)
    const later = laterItems();
    if (later.length) {
      h.push('<div class="sec"><div class="sech"><h2>' + esc(t('later_title')) + '</h2><span class="k">' + later.length + '</span></div><div class="list">');
      later.forEach((l) => h.push(laterRow(l, true)));
      h.push('</div></div>');
    }

    // avisos e contexto
    if (infos.length) {
      const k = 'ctx:' + d.d; const isOpen = !!open[k];
      h.push('<div class="sec"><div class="sech"><h2>' + esc(t('ctx_title')) + '</h2><button data-act="toggle" data-k="' + k + '">' + esc(isOpen ? t('collapse') : t('see_n', { n: infos.length })) + '</button></div>');
      if (isOpen) { h.push('<div class="list">'); infos.forEach((x) => h.push(itemHtml(x, { full: true }))); h.push('</div>'); }
      else h.push('<div class="list">' + infos.slice(0, 2).map((x) => itemHtml(x)).join('') + '</div>');
      h.push('</div>');
    }

    // etiqueta
    const etqIdx = (d.etq || []).filter((i) => D.etiquette[i]);
    const pubsIdx = D.etiquette.findIndex((x) => /^Pubs/i.test(strip(x.titulo)));
    const etqList = etqIdx.length ? etqIdx : (pubsIdx >= 0 ? [pubsIdx] : []);
    if (etqList.length) {
      h.push('<div class="sec"><div class="sech"><h2>' + esc(t('etq_today')) + '</h2><button data-act="panel" data-p="etiqueta">' + esc(t('all')) + '</button></div>' + trBtn('etq'));
      etqList.forEach((i) => { const c = D.etiquette[i]; h.push('<div class="card"><h4>' + X('etq', i + '.ti', c.titulo) + '</h4><ul>' + c.itens.slice(0, 3).map((it, j) => '<li>' + X('etq', i + '.' + j, it) + '</li>').join('') + '</ul></div>'); });
      h.push('</div>');
    }

    // o que mais rola hoje
    const idx = dayIndex(d.d);
    const rola = [];
    D.bands.forEach((f, i) => f.itens.forEach((it, j) => { if (it.tipo !== 'fix' && it.de <= idx && idx <= it.ate) rola.push({ f, i, it, j }); }));
    if (rola.length) {
      h.push('<div class="sec"><div class="sech"><h2>' + esc(t('rola_title')) + '</h2><button data-act="panel" data-p="calendario">' + esc(t('calendar')) + '</button></div>' + trBtn('bands'));
      rola.forEach((r) => h.push('<div class="card"><span class="k">' + esc(strip(X('bands', 'f' + r.i, r.f.faixa))) + '</span><h4 style="margin-top:4px">' + esc(strip(X('bands', r.i + '.' + r.j + '.ro', r.it.rotulo))) + '</h4><p>' + X('bands', r.i + '.' + r.j + '.tx', r.it.texto) + '</p></div>'));
      h.push('</div>');
    }

    // claude atalho
    h.push('<div class="sec"><div class="card cl"><span class="k" style="color:var(--claude)">Claude</span><h4 style="margin-top:4px">' + esc(t('claude_card_t')) + '</h4><p>' + esc(t('claude_card_p')) + '</p><div class="btnrow"><button class="btn cl" data-act="askq" data-q="' + esc(t('q_now')) + '">' + esc(t('q_now_l')) + '</button><button class="btn cl" data-act="askq" data-q="' + esc(t('q_replan')) + '">' + esc(t('q_replan_short')) + '</button></div></div></div>');

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
    h.push('<div class="hero"><div class="kick"><span>' + esc(wdL(d) + ' ' + d.dt) + '</span><span>·</span><span class="acc">' + esc(rgn(d.rg)) + '</span>' + (d.d === today ? '<span>·</span><span class="acc">' + esc(t('today')) + '</span>' : '') + '<button style="margin-left:auto" class="k acc" data-act="diasmode" data-m="list">' + esc(t('the_21')) + '</button></div>'
      + '<h1>' + esc(cleanLabel(dTi(d))) + '</h1>' + (d.lead ? '<p class="lead">' + esc(dLead(d)) + '</p>' : '')
      + heroChips(d, done, doItems.length)
      + (d.note ? '<div class="daynote">' + dNote(d) + '</div>' : '') + '</div>');
    const trb = trDayBtn(d); if (trb) h.push('<div class="sec" style="padding-bottom:0">' + trb + '</div>');
    h.push('<div class="sec"><div class="sech"><h2>' + esc(t('timeline')) + '</h2><button data-act="addev" data-d="' + esc(d.d) + '">' + esc(t('add')) + '</button></div><div class="list">');
    list.forEach((x) => h.push(itemHtml(x)));
    h.push('</div></div>');
    h.push('<div class="sec"><div class="btnrow">' + (cur > 0 ? '<button class="btn" data-act="day" data-i="' + (cur - 1) + '">‹ ' + esc(DAYS[cur - 1].dt) + '</button>' : '') + (cur < DAYS.length - 1 ? '<button class="btn" data-act="day" data-i="' + (cur + 1) + '">' + esc(DAYS[cur + 1].dt) + ' ›</button>' : '') + '</div></div>');
    el.innerHTML = h.join('');
    el.querySelectorAll('.txt, .daynote').forEach(linkify);
  }
  function listHtml() {
    const h = ['<div class="sec"><div class="sech"><h2>' + esc(t('days_list')) + '</h2><button data-act="diasmode" data-m="tl">' + esc(t('timeline_link')) + '</button></div><div class="list">']; let grp = '';
    const today = nowParts().iso;
    DAYS.forEach((d, i) => {
      if (d.rg !== grp) { grp = d.rg; h.push('<div class="lsep">' + esc(rgn(d.rg)) + '</div>'); }
      const list = effective(d).filter((x) => x.e.kind !== 'info'), done = list.filter((x) => x.o.s === 'done').length;
      h.push('<button class="lrow' + (i === cur ? ' is' : '') + '" data-act="day" data-i="' + i + '" style="--rg:var(' + RG[d.rg] + ')"><div class="ld">' + esc(wdS(d)) + '<b>' + d.dt.slice(0, 2) + '</b></div><div class="lt">' + esc(cleanLabel(dTi(d))) + '<span>' + esc(d.base) + (d.d === today ? ' · ' + esc(t('today')) : '') + '</span></div><div class="lc">' + esc(t('items', { n: list.length })) + (done ? '<b>' + esc(plural(done, 'n_done', 'n_done_pl', { n: done })) + '</b>' : '') + '</div></button>');
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
    for (const d of DAYS) for (const e of d.ev) { const o = S.ov[e.id]; if (o && o.s === 'miss' && !o.res) misses.push({ e, o, from: d, d }); }
    if (later.length || misses.length) {
      h.push('<div class="sec"><div class="sech"><h2>' + esc(t('from_plan')) + '</h2><span class="k">' + (later.length + misses.length) + '</span></div><div class="list">');
      later.forEach((l) => h.push(laterRow(l, false)));
      misses.forEach((l) => h.push('<div class="item miss" data-id="' + esc(l.e.id) + '"><button class="ck" data-act="miss" data-id="' + esc(l.e.id) + '">' + ICON_X + '</button><div class="bd" data-act="miss" data-id="' + esc(l.e.id) + '"><div class="top"><span class="lb">' + esc(t('miss_was', { dt: l.from.dt })) + '</span>' + (l.o.why ? '<span class="st m">' + esc(l.o.why) + '</span>' : '') + '</div><h4>' + esc(eTi(l.e, l.d)) + '</h4><div class="sub">' + esc(t('tap_decide')) + '</div></div></div>'));
      h.push('</div></div>');
    }
    const n = BOOK.filter((b) => S.ck[b.id]).length;
    h.push('<div class="sec"><div class="sech"><h2>' + esc(t('book_title')) + '</h2><span class="k">' + n + ' / ' + BOOK.length + '</span></div>' + trBtn('book'));
    h.push('<div class="pnote">' + t('book_note') + '</div><div class="list">');
    const order = ['🔴 NÃO ESPERA', '🟠 ESTA SEMANA', '🟡 SE QUISER', '⚪ NA SEMANA', '✅ DECIDE LÁ', '⛔ PERDIDO'];
    BOOK.slice().sort((a, b) => order.indexOf(a.w) - order.indexOf(b.w)).forEach((b) => {
      h.push('<button class="pi' + (S.ck[b.id] ? ' ck' : '') + '" data-act="ck" data-id="' + esc(b.id) + '"><div class="box">✓</div><div><span class="pw ' + (PW[b.w] || 'w') + '">' + esc(L().w[b.w] || b.w) + '</span><div class="pt">' + esc(X('book', b.id + '.t', b.t)) + '</div><div class="pb">' + X('book', b.id + '.b', b.b) + '</div></div></button>');
    });
    h.push('</div></div>');
    // lembretes
    const today = nowParts().iso;
    h.push('<div class="sec"><div class="sech"><h2>' + esc(t('reminders_title')) + '</h2><span class="k">' + esc(t('tz_note')) + '</span></div>' + trBtn('reminders') + '<div class="list">');
    D.reminders.slice().sort((a, b) => (a.d + a.t < b.d + b.t ? -1 : 1)).forEach((r) => {
      const di = DAYS[dayIndex(r.d)]; const past = r.d < today; const ck = !!S.ck[r.id]; const rti = X('reminders', r.id + '.ti', r.ti), rb = X('reminders', r.id + '.b', r.b);
      h.push('<div class="item ' + (ck ? 'done' : past ? 'skip' : '') + '" data-id="' + esc(r.id) + '"><button class="ck" data-act="remdone" data-id="' + esc(r.id) + '">' + ICON_CK + '</button><div class="bd"><div class="top"><span class="hh">' + esc(r.t) + '</span><span class="lb">' + (di ? esc(wdS(di) + ' ' + di.dt) : esc(r.d)) + '</span>' + (r.repeatUntil ? '<span class="st s">' + esc(t('every_morning', { d: ddmm(r.repeatUntil) })) + '</span>' : '') + '</div><h4>' + esc(rti) + '</h4><div class="txt">' + esc(rb) + '</div><div class="acts" data-stop="1">' + (r.tel ? '<a class="act ok" href="' + telUrl(r.tel) + '">' + esc(t('call')) + '</a>' : '') + (r.url ? '<a class="act" href="' + esc(r.url) + '" target="_blank" rel="noopener">' + esc(t('open')) + '</a>' : '') + '<a class="act" href="' + gcal(rti, r.d, r.t, r.dur, rb) + '" target="_blank" rel="noopener">' + esc(t('gcal')) + '</a></div></div></div>');
    });
    h.push('</div></div>');
    el.innerHTML = h.join('');
    el.querySelectorAll('.pb, .txt').forEach(linkify);
  }

  /* ---------- MAIS ---------- */
  const PANEL_IDS = ['ligar', 'travado', 'carro', 'ultima', 'etiqueta', 'calendario', 'richie', 'mapas', 'backup', 'sobre'];
  const PANEL_IC = { ligar: '📞', travado: '✈️', carro: '🚗', ultima: '🌙', etiqueta: '🤝', calendario: '📆', richie: '🍺', mapas: '🗺️', backup: '💾', sobre: '☘️' };
  const pTitle = (p) => t('p_' + p), pSub = (p) => (p === 'sobre' ? t('p_sobre_s', { v: APP_VERSION }) : t('p_' + p + '_s'));
  function renderMais() {
    const el = document.getElementById('v-mais');
    if (panel && PANEL_IC[panel]) { el.innerHTML = '<div class="sub-h"><button class="back" data-act="panel" data-p=""><svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>' + esc(t('back')) + '</button><h2>' + esc(pTitle(panel)) + '</h2></div>' + panelHtml(panel); el.querySelectorAll('.card p, .card li, .pb').forEach(linkify); afterPanel(panel); return; }
    const h = ['<div class="sec"><div class="sech"><h2>' + esc(t('tab_mais')) + '</h2></div><div class="tiles">'];
    h.push('<button class="tile wide" data-act="cfg"><span class="ic">⚙️</span><b>' + esc(t('cfg')) + '</b><span>' + esc(SAMPLE ? t('cfg_art') : S.key ? t('cfg_connected', { m: ClaudeAPI.modelInfo(S.cfg.model).name }) : t('cfg_nokey')) + ' · ' + esc(langInfo().name) + '</span></button>');
    PANEL_IDS.forEach((k) => h.push('<button class="tile" data-act="panel" data-p="' + k + '"><span class="ic">' + PANEL_IC[k] + '</span><b>' + esc(pTitle(k)) + '</b><span>' + esc(pSub(k)) + '</span></button>'));
    h.push('</div></div>');
    el.innerHTML = h.join('');
  }
  function cardList(arr, mapper) { return arr.map(mapper).join(''); }
  function panelHtml(p) {
    if (p === 'ligar') {
      return '<div class="sec">' + trBtn('ligar') + '<div class="sech"><h2>' + esc(t('phones')) + '</h2><span class="k">' + esc(t('local_time')) + '</span></div><div class="list">' + D.phones.map((x, i) => '<div class="phone"><div><b>' + esc(x.n) + '</b><span>' + esc(X('ligar', 'p' + i, x.obs)) + '</span></div><a class="tel" href="' + (x.sms ? 'sms:' + x.tel.replace(/\s/g, '') : telUrl(x.tel)) + '">' + ICON_TEL + esc(x.tel) + '</a></div>').join('') + '</div></div>'
        + '<div class="sec"><div class="sech"><h2>' + esc(t('links')) + '</h2></div><div class="list">' + D.links.map((x, i) => '<a class="phone" href="' + esc(x.url) + '" target="_blank" rel="noopener" style="border-bottom:1px solid var(--rule)"><div><b>' + esc(X('ligar', 'ln' + i, x.n)) + '</b><span>' + esc(X('ligar', 'l' + i, x.obs)) + '</span></div><span class="k acc">' + esc(t('open_link')) + '</span></a>').join('') + '</div></div>'
        + '<div class="sec"><div class="sech"><h2>' + esc(t('doubts')) + '</h2><span class="k">' + D.doubts.length + '</span></div>' + trBtn('doubts') + cardList(D.doubts, (x, i) => '<div class="card"><h4>' + X('doubts', i + '.ti', x.titulo) + '</h4><p>' + X('doubts', i + '.tx', x.texto) + '</p></div>') + '</div>';
    }
    if (p === 'travado') return '<div class="sec">' + trBtn('confirmado') + cardList(D.confirmado, (c, i) => '<div class="card acc"><h4>' + X('confirmado', i + '.ti', c.titulo) + '</h4><ul>' + c.itens.map((it, j) => '<li>' + X('confirmado', i + '.' + j, it) + '</li>').join('') + '</ul></div>') + '<div class="card"><h4>' + esc(t('base_dublin')) + '</h4><p>' + esc(D.trip.home) + '</p><div class="btnrow"><a class="btn sm" href="' + mapsUrl(D.trip.home) + '" target="_blank" rel="noopener">' + esc(t('act_map')) + '</a></div></div></div>';
    if (p === 'carro') return '<div class="sec">' + trBtn('carro') + cardList(D.carro, (c, i) => '<div class="card"><h4>' + X('carro', i + '.ti', c.titulo) + '</h4><ul>' + c.itens.map((it, j) => '<li>' + X('carro', i + '.' + j, it) + '</li>').join('') + '</ul></div>') + '</div>';
    if (p === 'ultima') return '<div class="sec">' + trBtn('ultima') + cardList(D.ultima, (u, i) => '<div class="card ' + (u.classe === 'rec' ? 'g' : '') + '"><div style="display:flex;gap:10px;align-items:baseline"><h4 style="flex:1">' + X('ultima', i + '.ti', u.titulo) + '</h4><span class="k">' + esc(u.custo) + '</span></div><p>' + X('ultima', i + '.tx', u.texto) + '</p>' + (u.aviso ? '<p class="daynote" style="margin-top:8px">' + X('ultima', i + '.av', u.aviso) + '</p>' : '') + '</div>') + '</div>';
    if (p === 'etiqueta') return '<div class="sec">' + trBtn('etq') + cardList(D.etiquette, (c, i) => '<div class="card"><h4>' + X('etq', i + '.ti', c.titulo) + '</h4><ul>' + c.itens.map((it, j) => '<li>' + X('etq', i + '.' + j, it) + '</li>').join('') + '</ul></div>') + '</div>';
    if (p === 'calendario') {
      const dOf = (i) => DAYS[i] ? DAYS[i].dt : '?';
      return '<div class="sec">' + trBtn('bands') + D.bands.map((f, i) => '<div class="lsep">' + esc(strip(X('bands', 'f' + i, f.faixa))) + '</div>' + f.itens.map((it, j) => '<div class="card"><span class="k">' + dOf(it.de) + (it.ate !== it.de ? ' – ' + dOf(it.ate) : '') + '</span><h4 style="margin-top:4px">' + esc(strip(X('bands', i + '.' + j + '.ro', it.rotulo))) + '</h4><p>' + X('bands', i + '.' + j + '.tx', it.texto) + '</p></div>').join('')).join('') + '</div>';
    }
    if (p === 'richie') return '<div class="sec">' + trBtn('richie') + cardList(D.richie, (c, i) => '<div class="card"><h4>' + X('richie', i + '.ti', c.titulo) + '</h4><p>' + X('richie', i + '.tx', c.texto) + '</p></div>') + '</div>';
    if (p === 'mapas') return '<div class="sec"><div class="sech"><h2>' + esc(t('maps_nat')) + '</h2></div><div class="mapwrap map" id="map-nat"><div class="empty">' + esc(t('loading')) + '</div></div><div class="mleg"><div><i style="background:var(--s3)"></i>' + esc(t('lg_car')) + '</div><div><i style="background:var(--s2)"></i>' + esc(t('lg_bus')) + '</div><div><i style="background:var(--s4)"></i>' + esc(t('lg_train')) + '</div><div><i style="background:var(--muted)"></i>' + esc(t('lg_opt')) + '</div></div></div>'
      + '<div class="sec"><div class="sech"><h2>' + esc(t('maps_con')) + '</h2></div><div class="mapwrap map" id="map-con"></div></div><div class="sec"><div class="sech"><h2>' + esc(t('maps_wc')) + '</h2></div><div class="mapwrap map" id="map-wc"></div></div>';
    if (p === 'backup') return '<div class="sec"><div class="card"><h4>' + esc(t('bk_export')) + '</h4><p>' + t('bk_export_p') + '</p><div class="btnrow"><button class="btn p" data-act="export">' + esc(t('bk_export_b')) + '</button></div></div>'
      + '<div class="card"><h4>' + esc(t('bk_import')) + '</h4><p>' + esc(t('bk_import_p')) + '</p><div class="btnrow"><label class="btn">' + esc(t('bk_choose')) + '<input type="file" accept="application/json,.json" id="impfile" hidden></label></div></div>'
      + '<div class="card w"><h4>' + esc(t('bk_reset')) + '</h4><p>' + esc(t('bk_reset_p')) + '</p><div class="btnrow"><button class="btn no" data-act="reset-all">' + esc(t('bk_reset_b')) + '</button></div></div></div>';
    if (p === 'sobre') {
      const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      return '<div class="sec"><div class="card"><h4>' + esc(t('ab_title', { v: APP_VERSION })) + '</h4><p>' + esc(t('ab_p', { d: D.built, n: DAYS.length, m: DAYS.reduce((n, d) => n + d.ev.length, 0), k: DAYS.reduce((n, d) => n + d.ev.reduce((m, e) => m + e.alts.length, 0), 0) })) + '</p></div>'
        + '<div class="card ' + (standalone ? 'g' : 'acc') + '"><h4>' + esc(t(standalone ? 'ab_installed' : 'ab_install')) + '</h4><p>' + (standalone ? esc(t('ab_installed_p')) : t('ab_install_p')) + '</p>' + (!standalone ? '<div class="btnrow"><button class="btn p" data-act="install" id="btn-install" hidden>' + esc(t('ab_install_b')) + '</button></div>' : '') + '</div>'
        + '<div class="card"><h4>' + esc(t('ab_upd')) + '</h4><p>' + esc(t('ab_upd_p')) + '<button class="act" data-act="update">' + esc(t('ab_check')) + '</button></p></div>'
        + '<div class="card"><h4>' + esc(t('ab_how')) + '</h4><ul><li>' + t('ab_how_1') + '</li><li>' + t('ab_how_2') + '</li><li>' + t('ab_how_3') + '</li><li>' + t('ab_how_4') + '</li></ul></div></div>';
    }
    return '';
  }
  function afterPanel(p) {
    if (p === 'mapas') { ['nat', 'con', 'wc'].forEach((k) => { const put = (svg) => { const el = document.getElementById('map-' + k); if (el) el.innerHTML = svg; }; if (window.IRL_MAPS && window.IRL_MAPS[k]) { put(window.IRL_MAPS[k]); return; } fetch('maps/' + k + '.svg').then((r) => r.text()).then(put).catch(() => put('<div class="empty">' + esc(t('map_offline')) + '</div>')); }); }
    if (p === 'backup') { const f = document.getElementById('impfile'); if (f) f.onchange = () => { const file = f.files[0]; if (!file) return; const rd = new FileReader(); rd.onload = () => { try { const v = JSON.parse(rd.result); if (!v || typeof v !== 'object' || !v.ov) throw new Error('formato'); const key = S.key; S = sane(v); S.key = key; setLang(S.cfg.lang); toast(t('bk_restored')); } catch (e) { toast(t('invalid_file')); } }; rd.readAsText(file); }; }
    if (p === 'sobre' && deferredInstall) { const b = document.getElementById('btn-install'); if (b) b.hidden = false; }
  }

  /* ---------- sheet ---------- */
  const sheet = document.getElementById('sheet'), sheetPnl = document.getElementById('sheet-pnl');
  function openSheet(html, onOpen) { sheetPnl.innerHTML = '<div class="grab"></div><button class="shx" id="sheet-x" aria-label="' + esc(t('cancel')) + '">' + ICON_X + '</button>' + html; sheet.hidden = false; document.body.style.overflow = 'hidden'; document.getElementById('sheet-x').onclick = closeSheet; if (onOpen) onOpen(sheetPnl); }
  function closeSheet() { sheet.hidden = true; sheetPnl.innerHTML = ''; document.body.style.overflow = ''; }
  document.getElementById('sheet-bd').onclick = closeSheet;
  const dayOptions = () => DAYS.map((x) => '<option value="' + x.d + '">' + x.dt + ' · ' + esc(wdS(x)) + ' — ' + esc(x.base) + '</option>').join('');

  function sheetMiss(id) {
    const e = baseEv(id); if (!e) return; const o = ovf(id); const d = dayOfEvent(id); const mine = S.ex.some((x) => x.id === id); const dd = mine ? null : d;
    const alts = e.alts || [];
    const why = o.why || '';
    openSheet('<h3>' + esc(t('miss_title', { ti: mine ? e.ti : eTi(e, dd) })) + '</h3><div class="sub">' + esc([e.t || (mine ? cleanLabel(e.h) : eH(e, dd)), e.place, d ? d.dt : ''].filter(Boolean).join(' · ')) + '</div>'
      + '<div class="k" style="margin-top:14px">' + esc(t('why')) + '</div><div class="reasons">' + reasons().map((r) => '<button class="act' + (why === r ? ' on' : '') + '" data-why="' + esc(r) + '">' + esc(r) + '</button>').join('') + '</div>'
      + '<div class="opts">'
      + '<button class="opt w" data-go="later"><span class="ic">⏰</span><div><b>' + esc(t('opt_later')) + '</b><span>' + esc(t('opt_later_s')) + '</span></div><span class="chev">›</span></button>'
      + '<button class="opt g" data-go="alt"><span class="ic">💡</span><div><b>' + esc(t('opt_alt')) + '</b><span>' + esc(alts.length ? plural(alts.length, 'opt_alt_some', 'opt_alt_some_pl', { n: alts.length }) : t('opt_alt_none')) + '</span></div><span class="chev">›</span></button>'
      + '<button class="opt cl" data-go="new"><span class="ic">✦</span><div><b>' + esc(t('opt_new')) + '</b><span>' + esc(t('opt_new_s')) + '</span></div><span class="chev">›</span></button>'
      + '<button class="opt" data-go="skip"><span class="ic">—</span><div><b>' + esc(t('opt_skip')) + '</b><span>' + esc(t('opt_skip_s')) + '</span></div><span class="chev">›</span></button>'
      + '</div>', (p) => {
        let chosen = why;
        p.querySelectorAll('[data-why]').forEach((b) => { b.onclick = () => { chosen = chosen === b.dataset.why ? '' : b.dataset.why; p.querySelectorAll('[data-why]').forEach((x) => x.classList.toggle('on', x.dataset.why === chosen)); }; });
        p.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => { const g = b.dataset.go; o.why = chosen || null;
          if (g === 'later') sheetLater(id);
          else if (g === 'alt') sheetAlt(id);
          else if (g === 'new') { o.s = 'miss'; o.res = null; save(); closeSheet(); askAbout(id, 'new'); }
          else if (g === 'skip') { o.s = 'skip'; o.res = 'skip'; save(); closeSheet(); render(); toast(t('skipped')); }
        }; });
      });
  }
  function sheetLater(id) {
    const e = baseEv(id); const o = ovf(id); const d = dayOfEvent(id); const ti = todayIndex(); const mine = S.ex.some((x) => x.id === id);
    const curDay = (o.d && dayIndex(o.d) >= 0) ? DAYS[dayIndex(o.d)] : d;
    const di = curDay ? dayIndex(curDay.d) : ti;
    const tomorrow = DAYS[di + 1];
    openSheet('<h3>' + esc(t('later_sheet', { ti: mine ? e.ti : eTi(e, d) })) + '</h3><div class="sub">' + esc(t('choose_when')) + '</div><div class="opts">'
      + '<div class="btnrow" style="margin-top:0"><button class="btn" data-l="+60">+1h</button><button class="btn" data-l="+120">+2h</button><button class="btn" data-l="+180">+3h</button></div>'
      + '<div class="row"><input class="in hm" id="lt-hm" inputmode="numeric" maxlength="5" placeholder="18:30" aria-label="' + esc(t('act_time')) + '"><button class="btn p" data-l="at">' + esc(t('today_at_btn')) + '</button></div>'
      + (tomorrow ? '<button class="opt b" data-l="tomorrow"><span class="ic">→</span><div><b>' + esc(t('tomorrow', { d: wdS(tomorrow) + ' ' + tomorrow.dt })) + '</b><span>' + esc(cleanLabel(dTi(tomorrow))) + '</span></div><span class="chev">›</span></button>' : '')
      + '<div class="row"><select class="in" id="lt-day"><option value="">' + esc(t('other_day_sel')) + '</option>' + dayOptions() + '</select></div>'
      + '<button class="opt w" data-l="pend"><span class="ic">📌</span><div><b>' + esc(t('pend_opt')) + '</b><span>' + esc(t('pend_opt_s')) + '</span></div><span class="chev">›</span></button>'
      + '</div>', (p) => {
        const done = (msg) => { o.s = null; o.res = null; save(); closeSheet(); render(); toast(msg); };
        p.querySelectorAll('[data-l]').forEach((b) => { b.onclick = () => { const l = b.dataset.l;
          if (l.startsWith('+')) { const np = nowParts(); let base = o.t || e.t || np.hm; if (dayIndex(np.iso) === di && toMin(base) < np.min) base = np.hm; o.t = addMin(base, +l.slice(1)); done(t('postponed_to', { t: o.t })); }
          else if (l === 'at') { const v = p.querySelector('#lt-hm').value.trim(); const m = /^(\d{1,2}):?(\d{2})$/.exec(v); if (!m) { p.querySelector('#lt-hm').focus(); return; } o.t = String(+m[1]).padStart(2, '0') + ':' + m[2]; done(t('today_at_done', { t: o.t })); }
          else if (l === 'tomorrow') { o.d = tomorrow.d; done(t('moved_to', { d: tomorrow.dt })); }
          else if (l === 'pend') { o.s = 'later'; o.res = null; save(); closeSheet(); render(); toast(t('left_later')); }
        }; });
        p.querySelector('#lt-day').onchange = (ev) => { if (!ev.target.value) return; o.d = ev.target.value; done(t('moved_to', { d: ddmm(ev.target.value) })); };
      });
  }
  function sheetAlt(id) {
    const e = baseEv(id); const o = ovf(id); const alts = e.alts || []; const d = dayOfEvent(id); const mine = S.ex.some((x) => x.id === id); const dd = mine ? null : d;
    openSheet('<h3>' + esc(t('alt_title', { ti: mine ? e.ti : eTi(e, dd) })) + '</h3><div class="sub">' + esc(t(alts.length ? 'alt_some' : 'alt_none')) + '</div>'
      + alts.map((a, i) => { const ati = dd ? aTi(e, i, dd) : a.ti, ab = dd ? aB(e, i, dd) : a.b; return '<div class="alt"><b>' + esc(ati) + '</b>' + (a.t ? '<span class="k acc" style="display:block;margin-top:4px">' + esc(a.t) + '</span>' : '') + '<p>' + ab + '</p><div class="src">' + esc(a.src) + '</div><div class="btnrow"><button class="btn sm ok" data-alt="' + i + '">' + esc(t('use_this')) + '</button>' + (/[A-Za-z]/.test(a.ti) ? '<a class="btn sm" href="' + mapsUrl(a.ti + ' ' + (d || {}).base) + '" target="_blank" rel="noopener">📍</a>' : '') + '</div></div>'; }).join('')
      + '<div class="opts"><button class="opt cl" data-go="claude"><span class="ic">✦</span><div><b>' + esc(t(alts.length ? 'ask_more' : 'ask_one')) + '</b><span>' + esc(t('ask_more_s')) + '</span></div><span class="chev">›</span></button></div>', (p) => {
        p.querySelectorAll('[data-alt]').forEach((b) => { b.onclick = () => { const i = +b.dataset.alt; const a = alts[i]; const ati = dd ? aTi(e, i, dd) : a.ti, ab = dd ? aB(e, i, dd) : a.b; const ddI = (o.d && dayIndex(o.d) >= 0) ? o.d : (d ? d.d : nowParts().iso);
          S.ex.push({ id: uid(), d: ddI, t: a.t || o.t || e.t || null, h: a.t ? '' : t('src_alt'), ti: ati, b: ab, c: 'note', kind: 'do', src: 'alt', from: id, maps: '', place: '', dur: e.dur || 0, alts: [] });
          o.s = 'miss'; o.res = 'alt'; save(); closeSheet(); render(); toast(t('swapped', { ti: ati })); }; });
        p.querySelector('[data-go="claude"]').onclick = () => { o.s = 'miss'; o.res = null; save(); closeSheet(); askAbout(id, 'alt'); };
      });
  }
  function sheetMove(id) {
    const e = baseEv(id); const o = ovf(id); const mine = S.ex.some((x) => x.id === id);
    openSheet('<h3>' + esc(t('move_title', { ti: mine ? e.ti : eTi(e, dayOfEvent(id)) })) + '</h3><div class="sub">' + esc(t('which_day')) + '</div><div class="opts"><select class="in" id="mv-day"><option value="">' + esc(t('choose_day')) + '</option>' + dayOptions() + '</select></div>', (p) => {
      p.querySelector('#mv-day').onchange = (ev) => { if (!ev.target.value) return; o.d = ev.target.value; if (o.s === 'later') o.s = null; save(); closeSheet(); render(); toast(t('moved_to', { d: ddmm(ev.target.value) })); };
    });
  }
  function sheetNote(id) {
    const e = baseEv(id); const o = ovf(id); const mine = S.ex.some((x) => x.id === id);
    openSheet('<h3>' + esc(t('note_title', { ti: mine ? e.ti : eTi(e, dayOfEvent(id)) })) + '</h3><textarea class="ta" id="nt-ta" placeholder="' + esc(t('note_ph')) + '" style="margin-top:12px">' + esc(o.n || '') + '</textarea><div class="btnrow"><button class="btn p" id="nt-ok">' + esc(t('save')) + '</button>' + (o.n ? '<button class="btn" id="nt-del">' + esc(t('del_note')) + '</button>' : '') + '</div>', (p) => {
      const ta = p.querySelector('#nt-ta'); ta.focus();
      p.querySelector('#nt-ok').onclick = () => { o.n = ta.value.trim() || null; prune(); save(); closeSheet(); render(); };
      const del = p.querySelector('#nt-del'); if (del) del.onclick = () => { o.n = null; prune(); save(); closeSheet(); render(); };
    });
  }
  function sheetHora(id, forceToday) {
    const e = baseEv(id); const o = ovf(id); const mine = S.ex.some((x) => x.id === id);
    openSheet('<h3>' + esc(forceToday ? t('today_at') : t('time_title', { ti: mine ? e.ti : eTi(e, dayOfEvent(id)) })) + '</h3><div class="row" style="margin-top:12px"><input class="in hm" id="hr-hm" inputmode="numeric" maxlength="5" placeholder="14:30" value="' + esc(o.t || e.t || '') + '"><button class="btn p" id="hr-ok">' + esc(t('mark')) + '</button>' + (o.t ? '<button class="btn" id="hr-clear">' + esc(t('clear_time')) + '</button>' : '') + '</div>', (p) => {
      const inp = p.querySelector('#hr-hm'); inp.focus();
      p.querySelector('#hr-ok').onclick = () => { const m = /^(\d{1,2}):?(\d{2})$/.exec(inp.value.trim()); if (!m) { inp.style.borderColor = 'var(--gone)'; return; } o.t = String(+m[1]).padStart(2, '0') + ':' + m[2]; if (forceToday) { o.d = nowParts().iso; o.s = null; } save(); closeSheet(); render(); toast(t('marked', { t: o.t })); };
      const c = p.querySelector('#hr-clear'); if (c) c.onclick = () => { o.t = null; prune(); save(); closeSheet(); render(); };
    });
  }
  function sheetAdd(dISO) {
    const d = DAYS[dayIndex(dISO)] || DAYS[todayIndex()];
    openSheet('<h3>' + esc(t('add_title', { dt: d.dt })) + '</h3><div class="field"><label>' + esc(t('f_time')) + '</label><input class="in hm" id="ad-hm" inputmode="numeric" maxlength="5" placeholder="09:30"></div><div class="field"><label>' + esc(t('f_what')) + '</label><input class="in" id="ad-ti" placeholder="' + esc(t('f_what_ph')) + '"></div><div class="field"><label>' + esc(t('f_detail')) + '</label><textarea class="ta" id="ad-b" placeholder="' + esc(t('f_detail_ph')) + '"></textarea></div><div class="btnrow"><button class="btn p" id="ad-ok">' + esc(t('add_btn')) + '</button></div>', (p) => {
      p.querySelector('#ad-ti').focus();
      p.querySelector('#ad-ok').onclick = () => { const ti = p.querySelector('#ad-ti').value.trim(); if (!ti) { p.querySelector('#ad-ti').focus(); return; } const m = /^(\d{1,2}):?(\d{2})$/.exec(p.querySelector('#ad-hm').value.trim());
        S.ex.push({ id: uid(), d: d.d, t: m ? String(+m[1]).padStart(2, '0') + ':' + m[2] : null, h: m ? '' : t('src_me'), ti, b: p.querySelector('#ad-b').value.trim(), c: 'note', kind: 'do', src: 'me', maps: ti, place: '', dur: 0, alts: [] });
        save(); closeSheet(); render(); toast(t('added')); };
    });
  }
  function sheetLang() {
    openSheet('<h3>' + esc(t('lang_label')) + '</h3><div class="opts">' + I.langs.map((l) => '<button class="opt' + (l.id === lang ? ' b' : '') + '" data-lang="' + l.id + '"><span class="ic">' + (FLAG[l.id] || '🌐') + '</span><div><b>' + esc(l.name) + '</b></div><span class="chev">' + (l.id === lang ? '✓' : '›') + '</span></button>').join('') + '</div>', (p) => {
      p.querySelectorAll('[data-lang]').forEach((b) => { b.onclick = () => { closeSheet(); setLang(b.dataset.lang); }; });
    });
  }
  document.getElementById('btn-lang').onclick = sheetLang;

  /* ---------- CONFIG ---------- */
  function sheetCfg() {
    const m = S.cfg.model;
    openSheet('<h3>' + esc(t('cfg')) + '</h3><div class="sub">' + esc(t(IN_ARTIFACT ? 'cfg_sub_art' : 'cfg_sub')) + '</div>'
      + '<div class="field"><label>' + esc(t('lang_label')) + '</label><div class="seg" id="cf-lang">' + I.langs.map((l) => '<button data-l="' + l.id + '" class="' + (l.id === lang ? 'on' : '') + '">' + (FLAG[l.id] || '') + ' ' + esc(l.short) + '</button>').join('') + '</div></div>'
      + (IN_ARTIFACT ? '<div class="field"><div class="card"><p>' + t('cfg_art_note') + '</p></div></div><input id="cf-key" type="hidden" value="' + esc(S.key || '') + '"><div id="cf-model" hidden></div><div id="cf-search" hidden></div>'
        : '<div class="field"><label>' + esc(t('key_label')) + '</label><input class="in" id="cf-key" type="password" autocomplete="off" placeholder="sk-ant-…" value="' + esc(S.key || '') + '"><div class="hint">' + t('key_hint') + '</div></div>'
        + '<div class="field"><label>' + esc(t('model_label')) + '</label><div class="seg" id="cf-model">' + ClaudeAPI.MODELS.map((x) => '<button data-m="' + x.id + '" class="' + (x.id === m ? 'on' : '') + '">' + esc(x.name.replace('Claude ', '')) + '</button>').join('') + '</div><div class="hint" id="cf-model-sub">' + esc(ClaudeAPI.modelInfo(m).sub) + '</div></div>')
      + '<div class="field"><label>' + esc(t('effort_label')) + '</label><div class="seg" id="cf-effort">' + ['low', 'medium', 'high'].map((x) => '<button data-e="' + x + '" class="' + (x === S.cfg.effort ? 'on' : '') + '">' + esc(t('ef_' + x)) + '</button>').join('') + '</div></div>'
      + (IN_ARTIFACT ? '' : '<div class="field"><div class="toggle"><div><b>' + esc(t('search_t')) + '</b><span>' + esc(t('search_s')) + '</span></div><button class="sw' + (S.cfg.search ? ' on' : '') + '" id="cf-search" aria-label="' + esc(t('search_t')) + '"></button></div></div>')
      + '<div class="field"><label>' + esc(t('sim_label')) + '</label><div class="row" style="margin-top:0"><select class="in" id="cf-simd" style="flex:1"><option value="">' + esc(t('sim_now')) + '</option>' + DAYS.map((x) => '<option value="' + x.d + '"' + (S.misc.sim && S.misc.sim.d === x.d ? ' selected' : '') + '>' + x.dt + ' · ' + esc(wdS(x)) + '</option>').join('') + '</select><input class="in hm" id="cf-simh" placeholder="09:00" maxlength="5" value="' + esc(S.misc.sim ? S.misc.sim.hm || '' : '') + '"></div></div>'
      + '<div class="btnrow"><button class="btn p" id="cf-ok">' + esc(t('save')) + '</button><button class="btn" id="cf-cancel">' + esc(t('cancel')) + '</button></div>', (p) => {
        let model = m, effort = S.cfg.effort, search = !!S.cfg.search, nl = lang;
        p.querySelectorAll('#cf-lang button').forEach((b) => { b.onclick = () => { nl = b.dataset.l; p.querySelectorAll('#cf-lang button').forEach((x) => x.classList.toggle('on', x.dataset.l === nl)); }; });
        p.querySelectorAll('#cf-model button').forEach((b) => { b.onclick = () => { model = b.dataset.m; p.querySelectorAll('#cf-model button').forEach((x) => x.classList.toggle('on', x.dataset.m === model)); p.querySelector('#cf-model-sub').textContent = ClaudeAPI.modelInfo(model).sub; }; });
        p.querySelectorAll('#cf-effort button').forEach((b) => { b.onclick = () => { effort = b.dataset.e; p.querySelectorAll('#cf-effort button').forEach((x) => x.classList.toggle('on', x.dataset.e === effort)); }; });
        const sw = p.querySelector('#cf-search'); if (sw && !IN_ARTIFACT) sw.onclick = (ev) => { search = !search; ev.currentTarget.classList.toggle('on', search); };
        p.querySelector('#cf-cancel').onclick = closeSheet;
        p.querySelector('#cf-ok').onclick = () => {
          S.key = p.querySelector('#cf-key').value.trim(); S.cfg.model = model; S.cfg.effort = effort; S.cfg.search = search;
          const sd = p.querySelector('#cf-simd').value; const sh = p.querySelector('#cf-simh').value.trim();
          if (sd) { const mm = /^(\d{1,2}):?(\d{2})$/.exec(sh); S.misc.sim = { d: sd, hm: mm ? String(+mm[1]).padStart(2, '0') + ':' + mm[2] : '09:00' }; } else S.misc.sim = null;
          save(); closeSheet(); cur = todayIndex(); if (nl !== lang) setLang(nl); else render(); toast(t(hasClaude() ? 'saved' : 'saved_nokey'));
        };
      });
  }
  document.getElementById('btn-cfg').onclick = sheetCfg;

  /* ---------- CLAUDE ---------- */
  let chatCtx = null; // {id, mode:'alt'|'new'|'ask'} — o item sobre o qual o pedido é
  let streaming = null; // {abort}
  let stableSystem = null;
  // Modo claude.ai: quando a página roda como artifact no claude.ai, o Claude vem da conta do usuário (sem chave)
  const IN_ARTIFACT = !!(window.claude && typeof window.claude.use === 'function');
  let SAMPLE = null, sampleResolved = false;
  function hasClaude() { return !!(SAMPLE || S.key); }
  function head() {
    return [
      'Você é o Claude, o assistente de viagem do Lucas, e está no celular dele durante a viagem. Ele te chama de Claude, com afeto. ' + langInfo().claude + ' Você conhece o plano inteiro; o Lucas está na rua, no pub ou na estrada, lendo no celular: seja curto, concreto, com nome de lugar, endereço, horário e preço quando existirem. Nunca reabra decisões já tomadas (seção 6). Respeite as regras dele: turístico que entrega SIM (Cliffs), só-foto NÃO (Temple Bar NUNCA); música é pano de fundo de pub, nenhum show pago, nada de música como programa; cerveja, natureza, história, gastronomia e gente de verdade antes de vida noturna; ele gosta de "cabaré e bagaceira" e do simples. Se não souber, diga. Se usar pesquisa na web, prefira sites irlandeses e oficiais e cite a fonte numa linha curta.',
      '## Formato de resposta',
      '- Markdown leve: negrito para o que importa, listas curtas. Sem tabelas largas. Sem despedidas.',
      '- Quando você propuser atividades concretas que ele possa colocar no roteiro (uma alternativa, um restaurante, um passeio com hora), TERMINE a resposta com um bloco de código ```json contendo {"sugestoes":[{"d":"YYYY-MM-DD","t":"HH:MM" ou "","ti":"título curto ≤ 48 caracteres","b":"1 a 3 frases com endereço, horário, preço e por quê","maps":"texto de busca no Google Maps ou \\"\\""}]} — no máximo 4 sugestões, só o que realmente recomenda, sem repetir o que já está no plano do dia, com "ti" e "b" na mesma língua da resposta. Se a resposta não propõe atividade nenhuma, não inclua o bloco.',
      '- Telefones no formato irlandês (01 524 0383, 095 37228) para virarem link.',
    ];
  }
  function compactContext() { // versão enxuta (< 64 KiB) para o modo claude.ai, que não tem prompt de sistema nem memória
    const ti = todayIndex();
    const skel = DAYS.map((d) => `${I.pt.wd[d.wd] || d.wd} ${d.dt}: ${strip(d.ti)} · base ${d.base}`).join('\n');
    const full = (d) => d ? `### ${I.pt.wdl[d.wd] || d.wd} ${d.dt} (${d.d}) — ${strip(d.ti)} · base ${d.base}\n${d.note ? 'Nota do dia: ' + strip(d.note) + '\n' : ''}` + d.ev.map((e) => `- [${e.id}] ${e.t || cleanLabel(e.h)} · ${e.ti} — ${strip(e.b)}`).join('\n') : '';
    const days = [DAYS[ti], DAYS[ti + 1]]; if (chatCtx) { const cd = dayOfEvent(chatCtx.id); if (cd && !days.includes(cd)) days.push(cd); }
    return head().concat([
      '## Quem é ele, o que está travado, as decisões (documento do projeto)', D.claude.brief,
      '## Os 21 dias (resumo)', skel,
      '## Os dias que importam agora, em detalhe (ids entre colchetes)', days.filter(Boolean).map(full).join('\n\n'),
      '## Pendências', D.claude.book,
      dynamicText(),
    ]).join('\n\n');
  }
  function stableText() {
    if (stableSystem) return stableSystem;
    const c = D.claude;
    stableSystem = head().concat([
      '## Quem é ele, o que está travado, as decisões (documento do projeto)', c.brief,
      '## O plano completo, dia a dia (ids entre colchetes; "do" = ação, "info" = contexto)', c.plan,
      '## Pendências e postura de reservas', c.book,
      '## O que NÃO está confirmado (com telefone que resolve)', c.doubts,
      '## Etiqueta', c.etiquette,
      '## O que mais acontece no país nessas datas', c.bands,
      '## O carro', c.carro,
      '## A última noite (15/10)', c.ultima,
    ]).join('\n\n');
    return stableSystem;
  }
  function dynamicText() {
    const np = nowParts(); const ti = todayIndex(); const d = DAYS[ti]; const ph = tripPhase();
    const lines = ['## Agora', 'Data e hora na Irlanda: ' + (I.pt.wdl[d.wd] || d.wd) + ' ' + d.dt + '/2026, ' + np.hm + (ph === 'antes' ? ' (a viagem ainda não começou; ele chega dia 25/09)' : ph === 'depois' ? ' (a viagem acabou)' : ' — dia ' + (ti + 1) + ' de 21') + '. Base de hoje: ' + d.base + '. Língua da interface dele agora: ' + langInfo().name + '.'];
    const list = effective(d);
    const st = (x) => { const s = x.o.s; return s === 'done' ? 'FEITO' : s === 'miss' ? 'NÃO CONSEGUIU' + (x.o.why ? ' (' + x.o.why + ')' : '') + (x.o.res === 'alt' ? ' → trocado por alternativa' : '') : s === 'later' ? 'FICOU PARA DEPOIS' : s === 'skip' ? 'PULADO' : 'pendente'; };
    lines.push('## Estado de hoje (' + d.dt + ')');
    list.forEach((x) => { if (x.e.kind === 'info' && !x.mine) return; lines.push('- [' + x.e.id + '] ' + (x.t || cleanLabel(x.e.h)) + ' · ' + x.e.ti + ' — ' + st(x) + (x.o.t && x.o.t !== x.e.t ? ' (adiado de ' + (x.e.t || '?') + ' para ' + x.o.t + ')' : '') + (x.mine ? ' [item ' + (x.e.src === 'claude' ? 'que você sugeriu' : x.e.src === 'alt' ? 'alternativo escolhido' : 'que ele acrescentou') + ': ' + strip(x.e.b).slice(0, 200) + ']' : '') + (x.o.n ? ' · nota dele: "' + x.o.n + '"' : '')); });
    const later = laterItems(); if (later.length) lines.push('## Ficou para depois (sem dia)\n' + later.map((l) => '- ' + l.e.ti + ' (era ' + (l.from ? l.from.dt : '?') + ')' + (l.o.why ? ' · motivo: ' + l.o.why : '')).join('\n'));
    const moved = []; Object.keys(S.ov).forEach((k) => { const o = S.ov[k]; if (o.d) { const e = baseEv(k); const from = dayOfEvent(k); if (e) moved.push('- ' + e.ti + ': movido de ' + (from ? from.dt : '?') + ' para ' + ddmm(o.d)); } });
    if (moved.length) lines.push('## Itens movidos de dia\n' + moved.join('\n'));
    const ex = S.ex.filter((x) => x.d !== d.d); if (ex.length) lines.push('## Itens acrescentados em outros dias\n' + ex.map((x) => '- ' + x.d + ' ' + (x.t || '') + ' ' + x.ti).join('\n'));
    const ck = BOOK.filter((b) => S.ck[b.id]).map((b) => b.t); if (ck.length) lines.push('## Pendências já resolvidas\n' + ck.map((x) => '- ' + x).join('\n'));
    if (DAYS[ti + 1]) lines.push('## Amanhã: ' + DAYS[ti + 1].dt + ' — ' + cleanLabel(DAYS[ti + 1].ti) + ' · base ' + DAYS[ti + 1].base);
    if (chatCtx) { const e = baseEv(chatCtx.id); const o = S.ov[chatCtx.id] || {}; if (e) lines.push('## O pedido atual é sobre este item\n[' + e.id + '] ' + (e.t || cleanLabel(e.h)) + ' · ' + e.ti + (o.why ? ' · ele NÃO conseguiu fazer, motivo: ' + o.why : '') + '\nTexto do item: ' + strip(e.b) + (chatCtx.mode === 'alt' ? '\nEle quer ALTERNATIVAS para colocar no lugar, agora, considerando a hora e onde está. Dê 2 a 3, concretas, com o bloco json.' : chatCtx.mode === 'new' ? '\nEle vai descrever o que quer no lugar. Monte a partir do plano e das regras, com o bloco json quando propuser algo concreto.' : '')); }
    return lines.join('\n');
  }
  function systemBlocks() { return [{ type: 'text', text: stableText(), cache_control: { type: 'ephemeral' } }, { type: 'text', text: dynamicText() }]; }

  function renderClaude() {
    const el = document.getElementById('v-claude'); const h = [];
    if (IN_ARTIFACT && !SAMPLE) {
      h.push('<div class="sec"><div class="card cl"><span class="k" style="color:var(--claude)">Claude</span><h4 style="margin-top:4px">' + esc(t(sampleResolved ? 'cl_unavail' : 'cl_connecting')) + '</h4><p>' + esc(t(sampleResolved ? 'cl_unavail_p' : 'cl_connecting_p')) + '</p></div></div>');
    } else if (!hasClaude()) {
      h.push('<div class="sec"><div class="card cl"><span class="k" style="color:var(--claude)">Claude</span><h4 style="margin-top:4px">' + esc(t('cl_connect')) + '</h4><p>' + esc(t('cl_connect_p')) + '</p><ol style="padding-left:18px;margin:8px 0 0;color:var(--ink2);font-size:13.4px;line-height:1.55"><li>' + t('cl_step1') + '</li><li>' + esc(t('cl_step2')) + '</li><li>' + esc(t('cl_step3')) + '</li></ol><div class="btnrow"><button class="btn p" data-act="cfg">' + esc(t('cl_open_cfg')) + '</button></div></div></div>');
    }
    h.push('<div class="chat" id="chatlog">');
    if (!S.chat.length) h.push('<div class="empty">' + esc(t('chat_empty')) + '</div>');
    S.chat.forEach((m, i) => h.push(msgHtml(m, i)));
    h.push('</div>');
    const ctxE = chatCtx ? baseEv(chatCtx.id) : null;
    h.push('<div class="composer">'
      + (chatCtx ? '<div class="ctxbar">' + (chatCtx.mode === 'alt' ? '💡' : chatCtx.mode === 'new' ? '✦' : '❓') + ' <span>' + esc(t('ctx_about')) + '<b>' + esc(ctxE ? (S.ex.some((x) => x.id === chatCtx.id) ? ctxE.ti : eTi(ctxE, dayOfEvent(chatCtx.id))) : '') + '</b></span><button data-act="ctxclear">' + esc(t('ctx_remove')) + '</button></div>' : '')
      + '<div class="quick">' + quickChips().map((q) => '<button class="act" data-act="askq" data-q="' + esc(q.q) + '">' + esc(q.l) + '</button>').join('') + '</div>'
      + '<div class="cbox"><textarea id="cin" rows="1" placeholder="' + esc(t(chatCtx && chatCtx.mode === 'new' ? 'ph_new' : 'ph')) + '"></textarea><button class="send" id="csend" aria-label="' + esc(t('send_aria')) + '">' + (streaming ? ICON_X : '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>') + '</button></div>'
      + '<div class="ctools">' + (SAMPLE ? '<span class="k">' + esc(t('via_account')) + '</span>' : '<button class="act' + (S.cfg.search ? ' on' : '') + '" data-act="togglesearch">' + esc(t(S.cfg.search ? 'web_on' : 'web_off')) + '</button><span class="k">' + esc(ClaudeAPI.modelInfo(S.cfg.model).name.replace('Claude ', '')) + ' · ' + esc(t('ef_' + S.cfg.effort)) + '</span>') + (S.chat.length ? '<button class="act" data-act="newchat" style="margin-left:auto">' + esc(t('new_chat')) + '</button>' : '') + '</div>'
      + '</div>');
    el.innerHTML = h.join('');
    el.querySelectorAll('.msg.a').forEach(linkify);
    const ta = document.getElementById('cin');
    ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; };
    ta.onkeydown = (ev) => { if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); sendChat(); } };
    document.getElementById('csend').onclick = () => { if (streaming) { streaming.abort(); } else sendChat(); };
    if (chatCtx && chatCtx.mode === 'new') ta.focus();
    if (S.chat.length) setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }), 0);
  }
  function quickChips() {
    const np = nowParts(); const h = Math.floor(np.min / 60);
    const base = [
      { l: t('q_now_l'), q: t('q_now') },
      { l: t(h >= 11 && h < 15 ? 'q_lunch_l' : h >= 17 ? 'q_dinner_l' : 'q_eat_l'), q: t('q_eat') },
      { l: t('q_replan_l'), q: t('q_replan') },
      { l: t('q_tmrw_l'), q: t('q_tmrw') },
      { l: t('q_pub_l'), q: t('q_pub') },
      { l: t('q_how_l'), q: t('q_how') },
    ];
    if (chatCtx && chatCtx.mode === 'alt') base.unshift({ l: t('q_alt_l'), q: t('q_alt') });
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
      return '<div class="s"><span class="m">' + esc(wdS(d) + ' ' + d.dt + (s.t ? ' · ' + s.t : '')) + '</span><b>' + esc(s.ti || '') + '</b><p>' + esc(s.b || '') + '</p><div class="row">' + (added ? '<span class="k" style="color:var(--done)">' + esc(t('in_day', { dt: d.dt })) + '</span>' : '<button class="btn sm ok" data-act="addsug" data-mi="' + mi + '" data-j="' + j + '">' + esc(t('put_in_day', { dt: d.dt })) + '</button>') + (s.maps ? '<a class="btn sm" href="' + mapsUrl(s.maps) + '" target="_blank" rel="noopener">📍</a>' : '') + '</div></div>'; }).join('') + '</div>';
  }
  function parseSug(text) {
    const re = /```(?:json)?\s*([\s\S]*?)```/g; let m, sug = [], out = text || '';
    while ((m = re.exec(text || ''))) { try { const j = JSON.parse(m[1]); const arr = Array.isArray(j) ? j : (j.sugestoes || j.suggestions || j.sugestões || j.moltaí); if (Array.isArray(arr)) { sug = sug.concat(arr.filter((s) => s && s.ti)); out = out.replace(m[0], ''); } } catch (e) { /* bloco não é sugestão */ } }
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
  function askAbout(id, mode) { chatCtx = { id, mode }; go('claude'); if (mode === 'alt') sendChat(t('alt_prompt')); }
  async function sendChat(text) {
    if (streaming) return;
    const ta = document.getElementById('cin');
    const msg = (text || (ta ? ta.value : '') || '').trim(); if (!msg) return;
    if (!hasClaude()) { if (IN_ARTIFACT) { toast(t(sampleResolved ? 'cl_unavail' : 'cl_wait')); return; } toast(t('no_key')); sheetCfg(); return; }
    if (!navigator.onLine) { toast(t('offline_toast')); }
    if (ta) { ta.value = ''; ta.style.height = 'auto'; }
    S.chat.push({ role: 'user', text: msg, ts: Date.now() });
    const a = { role: 'assistant', text: '', ts: Date.now(), model: null, search: !!S.cfg.search, ctx: chatCtx ? chatCtx.id : null };
    S.chat.push(a); save(); renderClaude();
    const log = document.getElementById('chatlog');
    const el = log.lastElementChild; // a mensagem do assistente vazia
    const status = document.createElement('div'); status.className = 'status'; status.innerHTML = '<span class="sp"></span><span>' + esc(t('s_connecting')) + '</span>'; log.appendChild(status);
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
    const onEvent = (ev) => {
      if (ev.type === 'text') { acc = ev.whole ? ev.text : acc + ev.text; a.text = acc; if (status.isConnected) status.hidden = true; paint(); }
      else if (ev.type === 'status') { if (status.isConnected) { status.hidden = !ev.code; status.querySelector('span:last-child').textContent = ev.code ? t('s_' + ev.code) : ''; } }
      else if (ev.type === 'done') { a.model = ev.model; }
    };
    try {
      let r;
      if (SAMPLE) {
        // modo claude.ai: sem prompt de sistema e sem memória — o contexto enxuto vai numa primeira vez de "user"
        a.search = false;
        const turns = [{ role: 'user', content: compactContext() }].concat(messages.slice(-8).map((m) => ({ role: m.role, content: String(m.content).slice(0, 4000) })));
        r = await ClaudeAPI.sendSample({ sample: SAMPLE, turns, signal: ctrl.signal, onEvent, tier: S.cfg.effort === 'high' ? 'complex' : 'default' });
      } else {
        r = await ClaudeAPI.send({ key: S.key, model: S.cfg.model, effort: S.cfg.effort, search: !!S.cfg.search, system: systemBlocks(), messages, signal: ctrl.signal, onEvent });
      }
      if (r) {
        if (r.stopReason === 'refusal') a.tail = t('tail_refusal');
        else if (r.stopReason === 'max_tokens') a.tail = t('tail_max');
        else if (r.stopReason === 'pause_turn') a.tail = t('tail_pause');
        else if (!r.complete) a.tail = t('tail_cut');
        if (r.noSearch) { a.search = false; a.tail = [t('tail_nosearch', { why: String(r.noSearch).slice(0, 140) }), a.tail].filter(Boolean).join(' '); }
      }
    } catch (err) {
      const f = SAMPLE ? ClaudeAPI.sampleFriendly(err) : ClaudeAPI.friendly(err);
      if (SAMPLE && err && err.code === 'refused') acc = '';
      if (SAMPLE && err && typeof err.text === 'string') acc = err.text;
      a.err = true; a.text = (acc ? acc + '\n\n' : '') + '⚠️ ' + f;
    }
    if (status.isConnected) status.remove(); streaming = null; if (!a.text) { a.text = t('no_answer'); a.err = true; }
    save(); renderClaude();
  }
  function addSug(mi, j) {
    const m = S.chat[mi]; if (!m) return; const s = parseSug(m.text).sug[j]; if (!s) return;
    const di = dayIndex(s.d || ''); const d = DAYS[di] || DAYS[todayIndex()];
    const tm = /^\d{1,2}:\d{2}$/.test(s.t || '') ? s.t : null;
    S.ex.push({ id: uid(), d: d.d, t: tm, h: tm ? '' : t('src_claude'), ti: String(s.ti).slice(0, 60), b: String(s.b || ''), c: 'note', kind: 'do', src: 'claude', sid: mi + ':' + j, from: chatCtx ? chatCtx.id : null, maps: s.maps || '', place: '', dur: 0, alts: [] });
    if (chatCtx) { const o = ovf(chatCtx.id); if (o.s === 'miss') o.res = 'claude'; }
    save(); renderClaude(); toast(t('added_day', { dt: d.dt, ti: s.ti }));
  }

  /* ---------- ações delegadas ---------- */
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]'); if (!b) return;
    if (ev.target.closest('a')) return;
    const act = b.dataset.act, id = b.dataset.id;
    const stop = ev.target.closest('[data-stop]');
    if (act === 'open') { if (stop) return; open[id] = !open[id]; render(); return; }
    if (act === 'toggle') { open[b.dataset.k] = !open[b.dataset.k]; render(); return; }
    if (act === 'done') { const o = ovf(id); o.s = o.s === 'done' ? null : 'done'; if (o.s === 'done') { o.res = null; } prune(); save(); render(); if (o.s === 'done') toast(t('done_toast')); return; }
    if (act === 'miss') { sheetMiss(id); return; }
    if (act === 'skip') { const o = ovf(id); o.s = o.s === 'skip' ? null : 'skip'; prune(); save(); render(); return; }
    if (act === 'push') { const o = ovf(id); const e = baseEv(id); o.t = addMin(o.t || (e && e.t) || nowParts().hm, +b.dataset.m); save(); render(); toast('→ ' + o.t); return; }
    if (act === 'hora') { sheetHora(id); return; }
    if (act === 'todayat') { sheetHora(id, true); return; }
    if (act === 'move') { sheetMove(id); return; }
    if (act === 'note') { sheetNote(id); return; }
    if (act === 'reset') { delete S.ov[id]; save(); render(); toast(t('restored')); return; }
    if (act === 'del') { S.ex = S.ex.filter((x) => x.id !== id); delete S.ov[id]; save(); render(); return; }
    if (act === 'ask') { askAbout(id, 'ask'); return; }
    if (act === 'askq') { go('claude'); sendChat(b.dataset.q); return; }
    if (act === 'addev') { sheetAdd(b.dataset.d); return; }
    if (act === 'day') { cur = +b.dataset.i; diasMode = 'tl'; open = {}; go('dias'); return; }
    if (act === 'diasmode') { diasMode = b.dataset.m; go('dias'); return; }
    if (act === 'panel') { panel = b.dataset.p || null; go('mais'); return; }
    if (act === 'cfg') { sheetCfg(); return; }
    if (act === 'lang') { sheetLang(); return; }
    if (act === 'tr') { translateSection(b.dataset.sec); return; }
    if (act === 'ck') { if (S.ck[id]) delete S.ck[id]; else S.ck[id] = true; save(); render(); return; }
    if (act === 'remdone') { if (S.ck[id]) delete S.ck[id]; else S.ck[id] = true; save(); render(); return; }
    if (act === 'addsug') { addSug(+b.dataset.mi, +b.dataset.j); return; }
    if (act === 'ctxclear') { chatCtx = null; renderClaude(); return; }
    if (act === 'togglesearch') { S.cfg.search = !S.cfg.search; save(); renderClaude(); return; }
    if (act === 'newchat') { S.chat = []; chatCtx = null; save(); renderClaude(); return; }
    if (act === 'export') {
      const data = Object.assign({}, S, { key: undefined }); const json = JSON.stringify(data, null, 1);
      if (IN_ARTIFACT) { // o visualizador do claude.ai não deixa a página baixar arquivos: mostra para copiar
        openSheet('<h3>' + esc(t('bk_sheet')) + '</h3><div class="sub">' + esc(t('bk_sheet_s')) + '</div><textarea class="ta" id="bk-ta" style="margin-top:12px;min-height:180px;font-family:var(--mono);font-size:11px">' + esc(json) + '</textarea><div class="btnrow"><button class="btn p" id="bk-copy">' + esc(t('copy')) + '</button></div>', (p) => { p.querySelector('#bk-copy').onclick = () => { const ta = p.querySelector('#bk-ta'); ta.select(); (navigator.clipboard && navigator.clipboard.writeText(json) || Promise.reject()).then(() => toast(t('copied')), () => toast(t('select_copy'))); }; });
        return;
      }
      const blob = new Blob([json], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'irlanda-backup-' + nowParts().iso + '.json'; document.body.appendChild(a); a.click(); a.remove(); return;
    }
    if (act === 'reset-all') { openSheet('<h3>' + esc(t('reset_title')) + '</h3><div class="sub">' + esc(t('reset_sub')) + '</div><div class="btnrow"><button class="btn no" id="rz-ok">' + esc(t('reset_yes')) + '</button><button class="btn" id="rz-no">' + esc(t('cancel')) + '</button></div>', (p) => { p.querySelector('#rz-no').onclick = closeSheet; p.querySelector('#rz-ok').onclick = () => { const key = S.key, cfg = S.cfg, tr = S.tr; S = JSON.parse(JSON.stringify(BLANK)); S.key = key; S.cfg = cfg; S.tr = tr; save(); closeSheet(); render(); toast(t('zeroed')); }; }); return; }
    if (act === 'install') { if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } return; }
    if (act === 'update') { checkUpdate(true); return; }
  });

  /* ---------- rede / PWA ---------- */
  function net() { const on = navigator.onLine; document.getElementById('netdot').classList.toggle('off', !on); document.getElementById('nettxt').textContent = t(on ? (hasClaude() ? 'net_claude' : 'net_online') : 'net_offline'); }
  window.addEventListener('online', net); window.addEventListener('offline', net);
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; const b = document.getElementById('btn-install'); if (b) b.hidden = false; });
  let swReg = null;
  function checkUpdate(manual) { if (!swReg) { if (manual) toast(t('no_sw')); return; } swReg.update().then(() => { if (manual && !swReg.waiting && !swReg.installing) toast(t('latest')); }).catch(() => { if (manual) toast(t('cant_check')); }); }
  if (IN_ARTIFACT) {
    window.claude.use('sample').then((fn) => { SAMPLE = (typeof fn === 'function') ? fn : null; sampleResolved = true; if (view === 'claude' || view === 'mais') render(); net(); }).catch(() => { sampleResolved = true; if (view === 'claude') renderClaude(); });
  }
  if ('serviceWorker' in navigator && !IN_ARTIFACT && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      swReg = reg;
      const onWaiting = () => { const f = document.getElementById('foot'); if (!document.getElementById('upd')) { const b = document.createElement('div'); b.className = 'banner'; b.id = 'upd'; b.innerHTML = esc(t('update_ready')) + '<button id="upd-go">' + esc(t('reload')) + '</button>'; f.parentNode.insertBefore(b, f); document.getElementById('upd-go').onclick = () => { if (reg.waiting) reg.waiting.postMessage('skipWaiting'); }; } };
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
  applyStatic(); net();
  go('hoje');
  if (!S.key && !IN_ARTIFACT && !S.misc.seenCfg) { S.misc.seenCfg = true; save(); setTimeout(() => toast(t('first_toast'), 4000), 800); }
})();
