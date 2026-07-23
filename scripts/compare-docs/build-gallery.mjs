#!/usr/bin/env node
/**
 * Assemble the comparison sheets under `docs/comparison/sheets/*.md` and the
 * screenshots under `docs/comparison/images/` into one browsable HTML gallery:
 * Godot beside our renderer, per node type, under a drag-slider.
 *
 *   node scripts/compare-docs/build-gallery.mjs                # -> docs/comparison/index.html, images referenced
 *   node scripts/compare-docs/build-gallery.mjs --inline --out /tmp/gallery.html   # self-contained (artifact/preview)
 *
 * The sheets carry only content (see SHEET-STANDARD.md); everything visual is
 * decided here, so re-styling the gallery never touches a sheet and refreshing
 * the screenshots (`capture.mjs`) never touches one either.
 *
 * `--inline` base64-embeds every image so the file stands alone under an
 * artifact's strict CSP; the default references `images/…` for the committed,
 * website-served copy.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, '../..');
const SHEETS_DIR = join(REPO_ROOT, 'docs/comparison/sheets');
const IMAGES_DIR = join(REPO_ROOT, 'docs/comparison/images');

function parseArgs(argv) {
  const args = { inline: false, fragment: false, out: join(REPO_ROOT, 'docs/comparison/index.html') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--inline') args.inline = true;
    else if (argv[i] === '--fragment') args.fragment = true;
    else if (argv[i] === '--out') args.out = argv[++i];
    else throw new Error(`Unknown flag ${argv[i]}`);
  }
  return args;
}

/** Split a sheet into `--- key: value ---` frontmatter and the Markdown body. */
function parseSheet(text, file) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    const kv = /^(\w+):\s*(.*)$/.exec(line.trim());
    // Strip a trailing `# ...` inline comment (the SHEET-STANDARD template
    // documents values as `category: 3D   # 3D | 2D | Other`); `\s*#` catches both
    // a trailing comment and a whole-line one. No frontmatter value contains a
    // literal '#', so this never eats real content.
    if (kv) meta[kv[1]] = kv[2].replace(/\s*#.*$/, '').trim();
  }
  for (const key of ['type', 'category', 'image']) {
    if (!meta[key]) throw new Error(`${file}: frontmatter missing "${key}"`);
  }
  return { meta, body: match[2].trim() };
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline Markdown: `code`, **bold**, and [text](href). Escapes first. */
function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * Render the strict Markdown subset the sheet standard permits: `##` headings,
 * pipe tables, paragraphs. The `# H1` and the two `![]()` images are dropped —
 * the gallery supplies the title and lays the images out itself.
 */
function renderBody(body) {
  const lines = body.split('\n');
  const out = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#\s/.test(line) || /^!\[/.test(line.trim())) continue; // H1 and images handled elsewhere
    if (/^##\s/.test(line)) {
      flush();
      out.push(`<h3>${inline(line.replace(/^##\s/, ''))}</h3>`);
    } else if (/^\|/.test(line.trim())) {
      flush();
      const rows = [line];
      while (i + 1 < lines.length && /^\|/.test(lines[i + 1].trim())) rows.push(lines[++i]);
      out.push(renderTable(rows));
    } else if (/^-\s/.test(line.trim())) {
      // A `- ` bullet list ("What it exercises" in every sheet). Without this it
      // fell through to the paragraph branch and every item collapsed into one
      // run-on `<p>- a - b - c</p>`. A wrapped continuation line (indented, not a
      // new bullet or a blank) joins the current item, as paragraphs collapse wraps.
      flush();
      const items = [];
      let item = line.trim().replace(/^-\s+/, '');
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (/^-\s/.test(next.trim())) {
          items.push(item);
          item = next.trim().replace(/^-\s+/, '');
          i++;
        } else if (next.trim() === '' || /^#/.test(next.trim()) || /^\|/.test(next.trim())) {
          break;
        } else {
          item += ` ${next.trim()}`;
          i++;
        }
      }
      items.push(item);
      out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join('')}</ul>`);
    } else if (line.trim() === '') {
      flush();
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return out.join('\n');
}

function renderTable(rows) {
  const cells = (r) =>
    r
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());
  const isDivider = (r) => /^[\s|:-]+$/.test(r);
  const body = rows.filter((r) => !isDivider(r));
  const [head, ...rest] = body;
  const th = cells(head).map((c) => `<th>${inline(c)}</th>`).join('');
  const trs = rest
    .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="tablewrap"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

/**
 * A screenshot as a `src` value — a data URI under `--inline`, else a relative
 * path. An animated node (AnimationPlayer) writes a `.gif`; a still writes a
 * `.png`. Prefer the gif so a motion node plays, and fall back to the png.
 */
function imageSrc(basename, side, inlineImages) {
  for (const ext of ['gif', 'png']) {
    const file = join(IMAGES_DIR, `${basename}-${side}.${ext}`);
    if (!existsSync(file)) continue;
    if (!inlineImages) return `images/${basename}-${side}.${ext}`;
    const mime = ext === 'gif' ? 'image/gif' : 'image/png';
    return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
  }
  return null;
}

const CATEGORY_ORDER = ['3D', '2D', 'Complex Scenes', 'Other'];

// The public previewer, deployed from main. Its `?fixture=<file>` deep link
// (useFixtureSelection.ts) opens directly on a scene, so each sheet can link to
// the very fixture it documents. A fixture added in this PR only resolves once
// it reaches main and the site redeploys — the sheets ship in the same PR.
const PREVIEW_URL = 'https://textscene-inspector.pages.dev/';

function build(sheets, inlineImages, fragment) {
  const missing = [];
  const nodes = sheets
    .map(({ meta, body }) => {
      const godot = imageSrc(meta.image, 'godot', inlineImages);
      const ours = imageSrc(meta.image, 'ours', inlineImages);
      if (!godot || !ours) missing.push(`${meta.type} (${meta.image})`);
      return {
        type: meta.type,
        category: CATEGORY_ORDER.includes(meta.category) ? meta.category : 'Other',
        // A node with no visual output at all (Timer, an AudioStreamPlayer, a
        // RemoteTransform body) sets `visual: false`; the gallery then shows an
        // explicit "no visual output" note instead of an empty image pair that
        // would imply something should be there.
        visual: meta.visual !== 'false',
        fixture: meta.fixture ?? '',
        // Optional: a Camera3D node path to look through on open (`?camera=`), so
        // the live link opens the SAME view as the captured image for scenes the
        // previewer's default framing does not compose well on its own.
        camera: meta.camera ?? '',
        rendersAs: meta.renders_as ?? '',
        godot,
        ours,
        html: renderBody(body),
      };
    })
    .sort((a, b) => a.type.localeCompare(b.type));

  // Within each dimension (3D, 2D, Other) the nav splits Visual from Other, so a
  // node that draws nothing sits apart from one that does.
  const groups = CATEGORY_ORDER.flatMap((category) =>
    [true, false].map((visual) => ({
      category,
      visual,
      items: nodes.filter((n) => n.category === category && n.visual === visual),
    }))
  ).filter((g) => g.items.length);

  // A category shows the Visual/Other sub-label only when it actually has both;
  // a single-group category (all-visual Complex Scenes) just shows its name.
  const splitCategories = new Set(
    CATEGORY_ORDER.filter(
      (category) =>
        nodes.some((n) => n.category === category && n.visual) &&
        nodes.some((n) => n.category === category && !n.visual)
    )
  );

  const nav = groups
    .map(
      (g) =>
        `<div class="nav-group"><div class="nav-head">${
          splitCategories.has(g.category) ? `${g.category} · ${g.visual ? 'Visual' : 'Other'}` : g.category
        }</div>${g.items
          .map(
            (n) =>
              `<button class="nav-item${n.visual ? '' : ' novis'}" data-type="${n.type}">${n.type}</button>`
          )
          .join('')}</div>`
    )
    .join('');

  const panels = nodes
    .map(
      (n) => `
    <article class="sheet" data-type="${n.type}" hidden>
      <header class="sheet-head">
        <h2>${escapeHtml(n.type)}</h2>
        ${n.rendersAs ? `<span class="renders">renders as ${inline(n.rendersAs)}</span>` : ''}
        ${
          n.fixture
            ? `<a class="fixture" href="${PREVIEW_URL}?fixture=${encodeURIComponent(
                n.fixture
              )}${
                n.camera ? `&camera=${encodeURIComponent(n.camera)}` : ''
              }" target="_blank" rel="noopener" title="Open ${escapeHtml(
                n.fixture
              )} in the previewer"><code>${escapeHtml(n.fixture)}</code> ↗</a>`
            : ''
        }
      </header>
      ${
        n.visual
          ? `<div class="compare">
        <div class="stage">
          <img class="img-godot" src="${n.godot}" alt="Godot render of ${escapeHtml(n.type)}">
          <img class="img-ours" src="${n.ours}" alt="Our render of ${escapeHtml(n.type)}">
          <div class="handle"></div>
          <span class="tag g">Godot 4.6.3</span>
          <span class="tag o">Ours</span>
        </div>
        <div class="modes">
          <button data-mode="slider" aria-pressed="true">Slider</button>
          <button data-mode="sbs" aria-pressed="false">Side by side</button>
        </div>
      </div>`
          : `<div class="novisual">No visual output — this node draws nothing to compare.</div>`
      }
      <div class="prose">${n.html}</div>
    </article>`
    )
    .join('');

  return { html: page(nav, panels, nodes[0]?.type, fragment), missing };
}

/**
 * A standalone document for the repo/website, or — under `fragment` — just the
 * page content an Artifact publish expects (it supplies its own
 * doctype/head/body skeleton, so those tags must not be repeated here).
 */
function page(nav, panels, firstType, fragment) {
  const body = `<aside class="side">
  <div class="brand"><span class="dot"></span>Render comparison</div>
  <input id="search" type="search" placeholder="Filter nodes…" aria-label="Filter nodes">
  <nav>${nav}</nav>
</aside>
<main id="main">${panels}</main>
<script>const FIRST=${JSON.stringify(firstType ?? null)};${JS}</script>`;
  if (fragment) {
    return `<title>Godot ⇄ TextScene — render comparison</title>\n<style>${CSS}</style>\n${body}`;
  }
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Godot ⇄ TextScene — render comparison</title>
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

const CSS = String.raw`
:root{
  --bg:#f5f6f8; --panel:#fff; --panel-2:#eceef2; --ink:#161a20; --muted:#5c6470;
  --line:#dde1e8; --godot:#b07430; --ours:#37729e; --ok:#2f8158; --warn:#b4553a;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0e1014; --panel:#161a20; --panel-2:#1d222b; --ink:#e6e9ee; --muted:#98a1af;
  --line:#272d38; --godot:#d69b58; --ours:#69a8d6; --ok:#57b085; --warn:#e07a5f;
}}
:root[data-theme=dark]{--bg:#0e1014;--panel:#161a20;--panel-2:#1d222b;--ink:#e6e9ee;--muted:#98a1af;--line:#272d38;--godot:#d69b58;--ours:#69a8d6;--ok:#57b085;--warn:#e07a5f}
:root[data-theme=light]{--bg:#f5f6f8;--panel:#fff;--panel-2:#eceef2;--ink:#161a20;--muted:#5c6470;--line:#dde1e8;--godot:#b07430;--ours:#37729e;--ok:#2f8158;--warn:#b4553a}
*{box-sizing:border-box}
body{margin:0;display:grid;grid-template-columns:264px 1fr;min-height:100vh;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.6}
.side{border-right:1px solid var(--line);background:var(--panel);padding:18px 14px;position:sticky;top:0;height:100vh;overflow-y:auto}
.brand{display:flex;align-items:center;gap:8px;font-weight:650;font-size:15px;letter-spacing:-.01em;margin-bottom:14px}
.dot{width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,var(--godot),var(--ours))}
#search{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel-2);color:var(--ink);font:inherit;font-size:13px;margin-bottom:12px}
#search:focus{outline:2px solid var(--ours);outline-offset:1px}
.nav-group{margin-bottom:14px}
.nav-head{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);padding:0 8px 6px}
.nav-item{display:block;width:100%;text-align:left;border:0;background:none;color:var(--ink);font:inherit;font-size:13.5px;padding:5px 8px;border-radius:6px;cursor:pointer}
.nav-item:hover{background:var(--panel-2)}
.nav-item[aria-current=true]{background:var(--ours);color:#fff}
.nav-item.novis{color:var(--muted)}
.nav-item.novis::after{content:"○";float:right;font-size:10px;line-height:1.6;opacity:.6}
.novisual{background:var(--panel-2);border:1px dashed var(--line);border-radius:12px;padding:26px;text-align:center;color:var(--muted);font-size:14px}
main{padding:28px clamp(16px,4vw,48px)}
.sheet{max-width:900px;margin:0 auto}
.sheet-head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:18px}
.sheet-head h2{margin:0;font-size:26px;letter-spacing:-.02em}
.renders{color:var(--muted);font-size:14px}
.renders code{color:var(--ours)}
.fixture{margin-left:auto;font-size:12px;color:var(--muted);text-decoration:none;white-space:nowrap}
.fixture code{color:inherit}
.fixture:hover{color:var(--ours);text-decoration:underline}
code{font-family:var(--mono);font-size:.9em;background:var(--panel-2);padding:1px 5px;border-radius:4px}
.compare{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden}
/* Slider: godot underneath fills the box; ours overlays it, clipped from the
   LEFT by --split so the left band shows godot and the right band shows ours —
   which is what the corner tags say. */
.stage{position:relative;user-select:none;touch-action:none;background:var(--panel-2);--split:50%}
.stage img{display:block;width:100%;height:auto}
.stage .img-ours{position:absolute;inset:0;width:100%;height:100%;clip-path:inset(0 0 0 var(--split))}
.stage.sbs{display:grid;grid-template-columns:1fr 1fr;gap:2px}
.stage.sbs .img-ours{position:static;width:100%;height:auto;clip-path:none}
.stage.sbs .handle{display:none}
.handle{position:absolute;top:0;bottom:0;left:var(--split);width:2px;margin-left:-1px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.4);cursor:ew-resize}
.handle::after{content:"";position:absolute;top:50%;left:50%;width:28px;height:28px;transform:translate(-50%,-50%);border-radius:50%;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.4)}
.tag{position:absolute;top:8px;font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:#fff;padding:3px 7px;border-radius:5px}
.tag.g{left:8px;background:var(--godot)}.tag.o{right:8px;background:var(--ours)}
.stage.sbs .tag.o{right:auto;left:calc(50% + 8px)}
.modes{display:flex;gap:6px;padding:10px 12px;border-top:1px solid var(--line)}
.modes button{font:inherit;font-size:12.5px;border:1px solid var(--line);background:var(--panel-2);color:var(--ink);border-radius:7px;padding:5px 11px;cursor:pointer}
.modes button[aria-pressed=true]{background:var(--ours);border-color:var(--ours);color:#fff}
.prose{margin-top:22px}
.prose h3{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:26px 0 10px}
.prose p{margin:0 0 12px;max-width:70ch}
.prose ul{margin:0 0 12px;padding-left:20px;max-width:70ch}
.prose li{margin:0 0 5px}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin:0 0 12px}
table{border-collapse:collapse;width:100%;font-size:14px;min-width:440px}
th,td{text-align:left;padding:8px 13px;border-bottom:1px solid var(--line)}
th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}
td{font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:0}
@media (max-width:720px){body{grid-template-columns:1fr}.side{position:static;height:auto;border-right:0;border-bottom:1px solid var(--line)}}
`;

const JS = String.raw`
const items=[...document.querySelectorAll('.nav-item')];
const sheets=[...document.querySelectorAll('.sheet')];
function show(type){
  sheets.forEach(s=>s.hidden=s.dataset.type!==type);
  items.forEach(b=>b.setAttribute('aria-current',String(b.dataset.type===type)));
  const active=sheets.find(s=>s.dataset.type===type);
  if(active) initCompare(active);
  location.hash=encodeURIComponent(type);
}
items.forEach(b=>b.addEventListener('click',()=>show(b.dataset.type)));
document.getElementById('search').addEventListener('input',e=>{
  const q=e.target.value.toLowerCase();
  items.forEach(b=>{b.style.display=b.dataset.type.toLowerCase().includes(q)?'':'none';});
  document.querySelectorAll('.nav-group').forEach(g=>{
    g.style.display=[...g.querySelectorAll('.nav-item')].some(b=>b.style.display!=='none')?'':'none';
  });
});
function initCompare(sheet){
  const stage=sheet.querySelector('.stage');
  if(!stage)return; // a no-visual sheet has no compare widget
  const handle=sheet.querySelector('.handle');
  if(stage.dataset.wired)return; stage.dataset.wired='1';
  // clip-path is a % of the element, so a single --split drives the clip and the
  // handle with no width bookkeeping — and nothing to break in side-by-side.
  const set=x=>{const r=stage.getBoundingClientRect();
    const p=Math.min(100,Math.max(0,((x-r.left)/r.width)*100));
    stage.style.setProperty('--split',p+'%');};
  let drag=false;
  handle.addEventListener('pointerdown',e=>{drag=true;handle.setPointerCapture(e.pointerId);});
  stage.addEventListener('pointermove',e=>{if(drag)set(e.clientX);});
  addEventListener('pointerup',()=>{drag=false;});
  sheet.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{
    sheet.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
    stage.classList.toggle('sbs',btn.dataset.mode==='sbs');
  }));
}
const initial=decodeURIComponent(location.hash.slice(1))||FIRST;
if(initial)show(initial);
`;

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(SHEETS_DIR)) throw new Error(`No sheets at ${SHEETS_DIR}`);
  const files = readdirSync(SHEETS_DIR).filter((f) => f.endsWith('.md'));
  if (files.length === 0) throw new Error('No sheets to build');

  const sheets = files.map((f) => parseSheet(readFileSync(join(SHEETS_DIR, f), 'utf8'), f));
  const { html, missing } = build(sheets, args.inline, args.fragment);

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, html);
  console.log(`[gallery] ${sheets.length} sheet(s) → ${args.out}`);
  if (missing.length) {
    console.error(`[gallery] ${missing.length} sheet(s) reference a MISSING image:`);
    for (const m of missing) console.error(`  ${m}`);
    process.exitCode = 1;
  }
}

main();
