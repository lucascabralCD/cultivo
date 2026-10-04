#!/usr/bin/env node
/* Gera irlanda-local.html: um arquivo único com CSS, dados, código e mapas embutidos,
   para abrir direto do aparelho (file://) sem servidor e sem instalar nada.
   Uso: node irlanda/build/make-local.js  → escreve irlanda/irlanda-local.html */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const safe = (js) => js.replace(/<\/script/gi, '<\\/script'); // nunca fecha a tag por acidente

let html = read('index.html');
const maps = { nat: read('maps/nat.svg'), con: read('maps/con.svg'), wc: read('maps/wc.svg') };
const scripts = ['i18n.js', 'data.js', 'claude.js', 'app.js'].filter((f) => fs.existsSync(path.join(ROOT, f)));
const inline = '<script>window.IRL_LOCAL=true;window.IRL_MAPS=' + safe(JSON.stringify(maps)) + ';</script>\n'
  + scripts.map((f) => '<script>\n' + safe(read(f)) + '\n</script>').join('\n');

// troca os <script src> pelo código embutido e tira manifest/ícones/service worker (não valem em file://)
html = html
  .replace(/<script src="[^"]+"><\/script>\s*/g, '')
  .replace('</body>', inline + '\n</body>')
  .replace(/<link rel="manifest"[^>]*>\s*/i, '')
  .replace(/<link rel="icon"[^>]*>\s*/i, '<link rel="icon" href="data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'icons/icon-192.png')).toString('base64') + '">\n')
  .replace(/<link rel="apple-touch-icon"[^>]*>\s*/i, '');

const out = path.join(ROOT, 'irlanda-local.html');
fs.writeFileSync(out, html);
console.log(`irlanda-local.html: ${(html.length / 1024).toFixed(0)} KB (${scripts.join(', ')} + mapas embutidos)`);
