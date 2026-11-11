// usrakou.com statik site derleyicisi
// content/ altındaki Markdown dosyalarını dist/ klasörüne HTML sayfaları olarak yazar.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { marked } from 'marked';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'dist');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
// base: sitenin yayınlandığı alt klasör. "/deneme/" iken site usrakou.com/deneme adresindedir; kök için "/" yapın.
const BASE = (CFG.base || '/').replace(/^\/?/, '/').replace(/\/?$/, '/');
const PUBLIC = !!CFG.public;
const SITE_URL = 'https://' + CFG.domain + BASE.replace(/\/$/, '');
const SITE_DIR = path.join(OUT, BASE);
const u = (p) => BASE + p.replace(/^\//, '');

marked.setOptions({ gfm: true, breaks: false });

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function parseMd(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const data = m ? (yaml.load(m[1]) || {}) : {};
  const body = m ? m[2] : raw;
  return { ...data, body };
}

/* ---------- video ---------- */
function ytId(url) {
  const m = String(url).match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}
function vimeoId(url) { const m = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/); return m ? m[1] : null; }
function videoHtml(src, title = 'Video') {
  if (!src) return '';
  src = String(src).trim();
  const yt = ytId(src);
  if (yt) return `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${yt}" title="${esc(title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  const vm = vimeoId(src);
  if (vm) return `<div class="embed"><iframe src="https://player.vimeo.com/video/${vm}" title="${esc(title)}" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(src) || src.startsWith('/')) return `<video controls preload="metadata" src="${esc(src.startsWith('/') ? u(src) : src)}"></video>`;
  return `<a class="vid-ext" href="${esc(src)}" target="_blank" rel="noopener"><span class="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18"><path d="M8 5v14l11-7z" fill="#fff"/></svg></span><span><b>${esc(title)}</b><small>Yeni sekmede açılır</small></span></a>`;
}
function thumbOf(it) {
  if (it.cover) return it.cover;
  const yt = ytId(it.video_url || '') || ytId(it.video || '') || ytId((String(it.body).match(/@\\?\[video\\?\]\(([^)\s]+)\)/) || [])[1] || '');
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : null;
}

/* ---------- markdown ---------- */
const LBL = { YAPIN: 'Yapın', YAPMAYIN: 'Yapmayın', IPUCU: 'İpucu', DIKKAT: 'Dikkat', NOT: 'Not' };
function md(src) {
  let s = String(src || '');
  // Görsel düzenleyicinin kaçış karakterlerini geri al
  s = s.replace(/\\\[!([A-Za-zİıÇçŞşĞğÜüÖö]+)\\\]/g, '[!$1]');
  s = s.replace(/^(\s*[-*]\s+)\\\[( |x|X)\\\]/gm, '$1[$2]');
  s = s.replace(/@\\\[video\\\]/g, '@[video]');
  // Video kısa kodu
  s = s.replace(/@\[video\]\(([^)\s]+)\)/g, (m, url) => `\n\n${videoHtml(url, 'Video')}\n\n`);
  let html = marked.parse(s);
  // Tek görselli paragraf -> şekil
  html = html.replace(/<p>\s*<img src="([^"]+)" alt="([^"]*)"(?: title="[^"]*")?>\s*<\/p>/g, (m, src, alt) => {
    const altText = alt.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\\\*/g, '*');
    const cap = altText.trim() ? `<figcaption>${marked.parseInline(altText)}</figcaption>` : '';
    const plain = esc(altText.replace(/\*\*/g, ''));
    return `<figure><img src="${src}" alt="${plain}" loading="lazy">${cap}</figure>`;
  });
  html = html.replace(/<img src="(\/[^"]+)"/g, (m, s2) => `<img src="${u(s2)}"`);
  // Kutular
  html = html.replace(/<blockquote>\s*<p>\[!([A-Za-zİıÇçŞşĞğÜüÖö]+)\]\s*([\s\S]*?)<\/blockquote>/g, (m, k, rest) => {
    const key = k.replace(/İ/g, 'I').replace(/ı/g, 'i').toUpperCase();
    if (!LBL[key]) return m;
    const inner = ('<p>' + rest).replace(/<p>\s*<\/p>/g, '');
    return `<aside class="callout c-${key}"><div class="callout-t">${LBL[key]}</div>${inner}</aside>`;
  });
  // Tablolar
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
  // Dış bağlantılar
  html = html.replace(/<a href="(https?:\/\/[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener"');
  return html;
}

/* ---------- içerik ---------- */
const site = yaml.load(read('content/site.yml')) || {};
const TABS = [
  { id: 'kilavuzlar', kind: 'list' },
  { id: 'teknikler', kind: 'list' },
  { id: 'videolar', kind: 'video' },
  { id: 'hakkinda', kind: 'page' },
].map((t) => ({ ...t, title: site.tabs?.[t.id]?.title || t.id, intro: site.tabs?.[t.id]?.intro || '' }));

function loadCollection(id) {
  const dir = path.join(ROOT, 'content', id);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
    const it = parseMd(path.join(dir, f));
    it.slug = f.replace(/\.md$/, '');
    it.section = id;
    it.date = it.date ? String(it.date instanceof Date ? it.date.toISOString().slice(0, 10) : it.date) : '';
    it.refs = Array.isArray(it.refs) ? it.refs.map((r) => (typeof r === 'object' && r ? Object.values(r)[0] : r)).filter(Boolean).map(String) : [];
    return it;
  }).filter((it) => !it.draft && it.title)
    .sort((a, b) => ((a.order ?? 999) - (b.order ?? 999)) || b.date.localeCompare(a.date) || String(a.title).localeCompare(String(b.title), 'tr'));
}
const COL = Object.fromEntries(TABS.filter((t) => t.kind !== 'page').map((t) => [t.id, loadCollection(t.id)]));
const about = parseMd(path.join(ROOT, 'content/sayfalar/hakkinda.md'));

/* ---------- şablon ---------- */
const CSS_V = Date.now().toString(36);
function layout({ title, desc, rel, current, body, image }) {
  const full = title ? `${title} · KOÜ Rejyonal Anestezi` : 'KOÜ Rejyonal Anestezi';
  const canon = SITE_URL + '/' + rel;
  const nav = [`<a class="tab" href="${u('')}"${current === '' ? ' aria-current="page"' : ''}>Ana Sayfa</a>`]
    .concat(TABS.map((t) => `<a class="tab" href="${u(t.id + '/')}"${current === t.id ? ' aria-current="page"' : ''}>${esc(t.title)}</a>`)).join('');
  const img = image ? (image.startsWith('http') ? image : SITE_URL + image) : '';
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
${PUBLIC ? '' : '<meta name="robots" content="noindex, nofollow">\n'}<meta name="description" content="${esc(desc || site.home_intro || '')}">
<link rel="canonical" href="${esc(canon)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(desc || site.home_intro || '')}">
<meta property="og:url" content="${esc(canon)}">
${img ? `<meta property="og:image" content="${esc(img)}">` : ''}
<link rel="icon" href="${u('assets/favicon.svg')}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Source+Serif+4:opsz,wght@8..60,500;8..60,600;8..60,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${u('assets/site.css')}?v=${CSS_V}">
</head>
<body>
<header class="topbar">
  <div class="topbar-in">
    <a class="brand" href="${u('')}">
      <span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><path d="M3 15c3-1 4-6 9-6s6 5 9 6"/><path d="M12 3v6"/><path d="M8 21l4-6 4 6"/></svg></span>
      <span class="brand-txt"><small>Kocaeli Üniversitesi Tıp Fakültesi · Anesteziyoloji ve Reanimasyon AD</small><strong>Rejyonal Anestezi</strong></span>
    </a>
    <nav class="tabs" aria-label="Bölümler">${nav}</nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer><div>Kılavuzlar, ekibimizin özgün yayınlarının özetlenmiş Türkçe uyarlamalarıdır. Ayrıntılar ve tam metin için her sayfada bağlantısı verilen özgün yayına başvurun. İçerikler eğitim amaçlıdır.</div></footer>
<script src="${u('assets/site.js')}?v=${CSS_V}" defer></script>
</body>
</html>
`;
}

function card(it) {
  const th = thumbOf(it);
  const href = u(`${it.section}/${it.slug}/`);
  const authors = it.authors ? String(it.authors).split(',') : [];
  const isVid = it.video || it.video_url || /@\\?\[video/.test(it.body);
  return `<a class="card" href="${href}">
${th ? `<div class="cover"><img src="${esc(th.startsWith('/') ? u(th) : th)}" alt="" loading="lazy"></div>` : ''}
<h3>${esc(it.title)}</h3>
${it.subtitle ? `<div class="orig">${esc(it.subtitle)}</div>` : ''}
${it.summary ? `<p>${esc(it.summary)}</p>` : ''}
<div class="meta">${it.journal ? `<span class="chip">${esc(it.journal)}</span>` : ''}${isVid ? '<span class="chip">Video</span>' : ''}${authors.length ? `<span>${esc(authors.slice(0, 2).join(',').trim())}${authors.length > 2 ? ' ve ark.' : ''}</span>` : ''}</div>
</a>`;
}

function itemPage(it) {
  const tab = TABS.find((t) => t.id === it.section);
  const src = (it.citation || it.doi || it.url) ? `<div class="source"><span class="lbl">Özgün yayın</span>${it.citation ? `<span>${esc(it.citation)}</span>` : ''}${it.doi ? `<span>DOI: <a href="https://doi.org/${esc(it.doi)}" target="_blank" rel="noopener">${esc(it.doi)}</a></span>` : (it.url ? `<span><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.url)}</a></span>` : '')}${it.license ? `<span class="note">${esc(it.license)}</span>` : ''}</div>` : '';
  const vids = [it.video && videoHtml(it.video, it.title), it.video_url && videoHtml(it.video_url, it.title)].filter(Boolean).join('');
  const refs = it.refs.length ? `<details class="refs" id="refs"><summary>Kaynaklar (${it.refs.length})</summary><ol>${it.refs.map((r, i) => `<li id="ref-${i + 1}">${esc(r)}</li>`).join('')}</ol></details>` : '';
  const body = `<div class="article-wrap"><nav class="toc" aria-label="İçindekiler"></nav><article>
<header class="a-head">
<div class="crumb"><a href="${u(it.section + '/')}">← ${esc(tab.title)}</a></div>
<h1>${esc(it.title)}</h1>
${it.subtitle ? `<p class="orig">${esc(it.subtitle)}</p>` : ''}
${it.authors ? `<p class="authors">${esc(it.authors)}</p>` : ''}
${src}
${it.note ? `<p class="note">${esc(it.note)}</p>` : ''}
</header>
${vids ? `<div class="prose hero-video">${vids}</div>` : ''}
<div class="prose" data-cites="${it.refs.length ? 1 : 0}">${md(it.body)}</div>
${refs}
</article></div>`;
  return layout({ title: it.title, desc: it.summary, rel: `${it.section}/${it.slug}/`, current: it.section, body, image: it.cover || thumbOf(it) });
}

function write(rel, html) {
  const f = path.join(SITE_DIR, rel, 'index.html');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
}
function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === '.gitkeep') continue;
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
  }
}

/* ---------- derleme ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
copyDir(path.join(ROOT, 'static'), SITE_DIR);
// Yönetim paneli: yapılandırmadaki yer tutucuları doldur
fs.mkdirSync(path.join(SITE_DIR, 'admin'), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'admin'))) {
  const txt = fs.readFileSync(path.join(ROOT, 'admin', f), 'utf8').replaceAll('__BASE__', BASE).replaceAll('__SITE_URL__', SITE_URL).replaceAll('__REPO__', CFG.repo);
  fs.writeFileSync(path.join(SITE_DIR, 'admin', f), txt);
}
fs.writeFileSync(path.join(OUT, 'CNAME'), CFG.domain + '\n');
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
if (BASE !== '/') {
  // Site alt klasördeyken kök adres sade bir bekleme sayfası gösterir
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(CFG.domain)}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f4f7f6;color:#12201c}div{text-align:center;padding:24px}b{display:block;font-size:22px;margin-bottom:6px}span{color:#55655f}</style></head><body><div><b>Kocaeli Üniversitesi Rejyonal Anestezi</b><span>Sayfa hazırlanıyor.</span></div></body></html>`);
}

// Ana sayfa
const all = Object.values(COL).flat();
const recent = [...all].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
const quick = TABS.map((t) => `<a href="${u(t.id + '/')}"><b>${esc(t.title)}</b><span>${t.kind === 'page' ? esc(t.intro || 'Sayfa') : (COL[t.id].length ? COL[t.id].length + ' içerik' : 'Hazırlanıyor')}</span></a>`).join('');
write('', layout({ title: '', rel: '', current: '', body:
  `<section class="lede"><h1>${esc(site.home_title || 'Rejyonal Anestezi')}</h1><p>${esc(site.home_intro || '')}</p></section>
<section class="home-block"><h2>Bölümler</h2><div class="quick">${quick}</div></section>
${recent.length ? `<section class="home-block"><h2>Son eklenenler</h2><div class="grid">${recent.map(card).join('')}</div></section>` : ''}` }));

// Bölümler ve içerikler
for (const t of TABS) {
  if (t.kind === 'page') {
    write(t.id, layout({ title: about.title || t.title, desc: t.intro, rel: t.id + '/', current: t.id, body:
      `<div class="article-wrap"><nav class="toc" aria-label="İçindekiler"></nav><article><header class="a-head"><h1>${esc(about.title || t.title)}</h1></header><div class="prose">${md(about.body)}</div></article></div>` }));
    continue;
  }
  const items = COL[t.id];
  write(t.id, layout({ title: t.title, desc: t.intro, rel: t.id + '/', current: t.id, body:
    `<div class="sec-head"><div><h1>${esc(t.title)}</h1>${t.intro ? `<p>${esc(t.intro)}</p>` : ''}</div></div>
${items.length ? `<div class="grid">${items.map(card).join('')}</div>` : '<div class="empty">Bu bölüm hazırlanıyor.</div>'}` }));
  for (const it of items) write(`${t.id}/${it.slug}`, itemPage(it));
}

// 404, site haritası, robots
fs.writeFileSync(path.join(OUT, '404.html'), layout({ title: 'Sayfa bulunamadı', rel: '404.html', current: null, body: `<div class="empty">Aradığınız sayfa bulunamadı. <a href="${u('')}">Ana sayfaya dönün.</a></div>` }));
const urls = ['', ...TABS.map((t) => t.id + '/'), ...all.map((i) => `${i.section}/${i.slug}/`)];
if (PUBLIC) fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((p) => `<url><loc>${SITE_URL}/${p}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), PUBLIC ? `User-agent: *\nDisallow: ${BASE}admin/\nSitemap: ${SITE_URL}/sitemap.xml\n` : `User-agent: *\nDisallow: /\n`);
console.log(`Derlendi: ${all.length} içerik, ${urls.length} sayfa -> https://${CFG.domain}${BASE} (${PUBLIC ? 'herkese açık, arama motorlarına açık' : 'arama motorlarına kapalı'})`);
