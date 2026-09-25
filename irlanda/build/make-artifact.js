#!/usr/bin/env node
/* Gera irlanda/artifact.html: a mesma página, no formato que o claude.ai espera para publicar como artifact
   (sem doctype/html/head/body — o publicador injeta o esqueleto; título curto; sem manifest/ícones/service worker).
   Uso: node irlanda/build/make-artifact.js */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

html = html
  .replace(/^<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*$/i, '')
  .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<link rel="manifest"[^>]*>\s*/i, '')
  .replace(/<link rel="icon"[^>]*>\s*/i, '')
  .replace(/<link rel="apple-touch-icon"[^>]*>\s*/i, '')
  .replace(/<meta name="(mobile-web-app-capable|apple-mobile-web-app-capable|apple-mobile-web-app-status-bar-style|apple-mobile-web-app-title|theme-color)"[^>]*>\s*/gi, '')
  .replace(/<title>[^<]*<\/title>/i, '<title>Irlanda 21 dias</title>');

// no artifact o :root já vem com o recuo da safe-area: o cabeçalho fixo gruda nele
html = html.replace('</style>', 'header{top:env(safe-area-inset-top,0px);padding-top:0}\n</style>');

fs.writeFileSync(path.join(ROOT, 'artifact.html'), html);
const bad = /<html|<\/html>|<head>|<body>/i.test(html);
console.log(`artifact.html: ${(html.length / 1024).toFixed(0)} KB${bad ? ' — ATENÇÃO: sobrou esqueleto' : ''}`);
