/* Cliente do Claude para o navegador — chamada direta à API da Anthropic (sem servidor no meio).
   A chave fica só no localStorage deste aparelho. */
(function () {
  'use strict';

  const API = 'https://api.anthropic.com/v1/messages';
  const VERSION = '2023-06-01';

  const MODELS = [
    { id: 'claude-opus-5', name: 'Claude Opus 5', sub: 'o mais inteligente · padrão', search: 'web_search_20260209', effort: true, fallbacks: true },
    { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', sub: 'mais rápido e mais barato', search: 'web_search_20260209', effort: true, fallbacks: false },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', sub: 'o mais barato · respostas curtas', search: 'web_search_20250305', effort: false, fallbacks: false },
  ];

  function modelInfo(id) { return MODELS.find((m) => m.id === id) || MODELS[0]; }

  function headers(key, betas) {
    const h = {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    if (betas && betas.length) h['anthropic-beta'] = betas.join(',');
    return h;
  }

  function buildBody(opts, variant) {
    const m = modelInfo(opts.model);
    const body = {
      model: m.id,
      max_tokens: opts.maxTokens || 16000, // inclui o raciocínio (thinking) nos modelos que pensam; a resposta visível é bem menor
      stream: true,
      system: opts.system,
      messages: opts.messages,
    };
    if (m.effort && opts.effort) body.output_config = { effort: opts.effort };
    if (opts.search) {
      body.tools = [{
        type: m.search, name: 'web_search', max_uses: opts.maxSearches || 3,
        user_location: { type: 'approximate', city: opts.city || 'Dublin', country: opts.country || 'IE', timezone: 'Europe/Dublin' },
      }];
    }
    const betas = [];
    if (m.fallbacks && variant.fallbacks) { body.fallbacks = 'default'; betas.push('server-side-fallback-2026-07-01'); }
    return { body, betas };
  }

  function parseError(status, text) {
    let msg = text;
    try { const j = JSON.parse(text); msg = (j.error && (j.error.message || j.error.type)) || text; } catch (e) { /* texto puro */ }
    const e = new Error(msg || ('HTTP ' + status));
    e.status = status;
    return e;
  }

  function friendly(err) {
    const s = err.status, m = String(err.message || '');
    if (s === 401 || /invalid x-api-key|authentication/i.test(m)) return 'Chave da API inválida ou revogada. Confira em Configurações.';
    if (s === 403) return 'A chave não tem permissão para este modelo. Confira em console.anthropic.com.';
    if (s === 429) return 'Limite de uso atingido por agora. Espere um minuto e tente de novo.';
    if (s === 529 || /overloaded/i.test(m)) return 'A API está sobrecarregada. Tente de novo em instantes.';
    if (s === 400 && /credit|balance|billing/i.test(m)) return 'Sem créditos na conta da API. Adicione saldo em console.anthropic.com.';
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'Sem rede agora. As suas anotações ficam salvas; o Claude precisa de internet.';
    if (err.name === 'AbortError') return 'Cancelado.';
    return m || 'Erro desconhecido.';
  }

  /* Lê a resposta em stream (SSE) e chama onEvent para cada evento útil:
     {type:'text', text} · {type:'status', text} · {type:'done', stopReason, model, usage} */
  async function readStream(res, onEvent, signal) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', stopReason = null, model = null, usage = null, complete = false;
    const blocks = {};
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (signal && signal.aborted) { try { reader.cancel(); } catch (e) { /* ignore */ } break; }
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const raw = buf.slice(0, idx); buf = buf.slice(idx + 2);
        let data = null;
        for (const line of raw.split('\n')) {
          if (line.startsWith('data:')) data = (data || '') + line.slice(5).trim();
        }
        if (!data) continue;
        let ev; try { ev = JSON.parse(data); } catch (e) { continue; }
        if (ev.type === 'message_start' && ev.message) { model = ev.message.model || model; usage = ev.message.usage || usage; }
        else if (ev.type === 'content_block_start') {
          const cb = ev.content_block || {};
          blocks[ev.index] = cb.type;
          if (cb.type === 'server_tool_use') onEvent({ type: 'status', code: 'search' });
          else if (cb.type === 'web_search_tool_result') onEvent({ type: 'status', code: 'read' });
          else if (cb.type === 'text') onEvent({ type: 'status', code: '' });
          else if (cb.type === 'thinking') onEvent({ type: 'status', code: 'think' });
        }
        else if (ev.type === 'content_block_delta') {
          const d = ev.delta || {};
          if (d.type === 'text_delta' && d.text) onEvent({ type: 'text', text: d.text });
        }
        else if (ev.type === 'message_delta') {
          if (ev.delta && ev.delta.stop_reason) stopReason = ev.delta.stop_reason;
          if (ev.usage) usage = Object.assign(usage || {}, ev.usage);
        }
        else if (ev.type === 'message_stop') complete = true;
        else if (ev.type === 'error') {
          const e = new Error((ev.error && ev.error.message) || 'erro no stream'); e.status = 0; e.streamError = (ev.error && ev.error.type) || 'api_error'; throw e;
        }
      }
    }
    onEvent({ type: 'done', stopReason, model, usage, complete });
    return { stopReason, model, usage, complete };
  }

  /* opts: {key, model, effort, search, system:[blocks], messages:[...], signal, onEvent} */
  async function send(opts) {
    if (!opts.key) { const e = new Error('Sem chave da API.'); e.status = 401; throw e; }
    let variant = { fallbacks: true };
    for (let attempt = 0; attempt < 3; attempt++) {
      const { body, betas } = buildBody(opts, variant);
      let res;
      try {
        res = await fetch(API, { method: 'POST', headers: headers(opts.key, betas), body: JSON.stringify(body), signal: opts.signal });
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        if (attempt < 2) { await wait(1200 * (attempt + 1)); continue; }
        throw err;
      }
      if (res.ok) {
        // erro dentro do stream (ex.: overloaded) antes de qualquer texto: tenta de novo uma vez
        let gotText = false;
        const onEvent = (ev) => { if (ev.type === 'text') gotText = true; opts.onEvent(ev); };
        try { return await readStream(res, onEvent, opts.signal); }
        catch (err) { if (err.streamError && !gotText && attempt < 2) { await wait(1500 * (attempt + 1)); continue; } throw err; }
      }
      const text = await res.text();
      const err = parseError(res.status, text);
      // Se a beta de fallback não for aceita nesta conta/modelo, tenta sem ela.
      if (res.status === 400 && betas.length && /fallback|beta|unexpected|extra|unrecognized/i.test(err.message)) { variant = { fallbacks: false }; continue; }
      if ((res.status === 529 || res.status >= 500) && attempt < 2) { await wait(1500 * (attempt + 1)); continue; }
      if (res.status === 429 && attempt < 1) { await wait(4000); continue; }
      throw err;
    }
    throw new Error('Não consegui falar com a API.');
  }

  function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

  /* Modo claude.ai: a página publicada como artifact pergunta ao Claude pela conta do próprio usuário
     (capacidade "sample"), sem chave da API. Sem memória: o contexto inteiro vai em cada chamada. */
  function sampleFriendly(e) {
    const c = e && e.code;
    if (c === 'not_granted') return 'Você não permitiu que esta página use o seu Claude. Recarregue a página e aceite o pedido.';
    if (c === 'rate_limited') return 'Limite de uso do seu Claude por agora. Espere um pouco e tente de novo.';
    if (c === 'session_expired') return 'A sessão do claude.ai expirou. Entre de novo.';
    if (c === 'refused') return 'O Claude recusou este pedido. Reformule.';
    if (c === 'prompt_too_large') return 'Conversa grande demais para esta página. Comece uma conversa nova.';
    if (c === 'cancelled') return 'Cancelado.';
    if (c === 'sampling_disabled' || c === 'not_declared' || c === 'capability_disabled') return 'O Claude não está disponível nesta página. Use a versão instalada no celular.';
    if (c === 'empty_completion') return 'O Claude não respondeu nada. Tente perguntar de outro jeito.';
    return (e && e.message) || 'Erro ao falar com o Claude.';
  }
  async function sendSample(opts) { // {sample, turns, signal, onEvent, tier}
    opts.onEvent({ type: 'status', code: 'think' });
    const r = await opts.sample(opts.turns, { cache: false, signal: opts.signal, modelTier: opts.tier || 'default', onText: ({ text }) => opts.onEvent({ type: 'text', text, whole: true }) });
    const out = { stopReason: r.truncated ? 'max_tokens' : 'end_turn', model: 'claude.ai · ' + (r.modelTierApplied || 'default'), usage: null, complete: true };
    opts.onEvent(Object.assign({ type: 'done' }, out));
    return out;
  }

  window.ClaudeAPI = { MODELS, modelInfo, send, friendly, sendSample, sampleFriendly };
})();
