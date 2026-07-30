#!/usr/bin/env node
/**
 * Assemble the comparison sheets (`<slice>/comparison.md`, plus the sliceless
 * showcases under `docs/comparison/sheets/` — see sheetSources.mjs) and the
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
import {
  REPO_ROOT,
  collectSheetFiles,
  findImage,
  parseFrontmatter,
  sheetLabel,
} from './sheetSources.mjs';
import { renderCoverage as renderLintCoverage } from './lintCoverage.mjs';

const here = dirname(fileURLToPath(import.meta.url));

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
  const parsed = parseFrontmatter(text);
  if (!parsed) throw new Error(`${file}: missing frontmatter`);
  // `image` is required only for a single-pair sheet; a sheet built from
  // per-property `<!-- compare: ... -->` sections supplies its images there.
  for (const key of ['type', 'category']) {
    if (!parsed.meta[key]) throw new Error(`${file}: frontmatter missing "${key}"`);
  }
  return { meta: parsed.meta, body: parsed.body.trim() };
}

/**
 * Status vocabulary, worst-first — a node's nav badge rolls up to its worst
 * section. `done` (green) means genuinely faithful to Godot and is NEVER the
 * default: a sheet earns it only by an explicit `status=done`. Everything not
 * yet assessed against Godot reads `unreviewed` (grey), so the gallery never
 * over-claims parity. `unreviewed` outranks `done` in the rollup so a single
 * unchecked section keeps the whole node out of green.
 *
 * `linter-only` (blue) is the finished state for a node that draws nothing at
 * runtime — a Timer, a joint, an XR tracker. It is parsed and fully validated
 * and there is no render to assess, so it is not a gap the way `unimplemented`
 * is. It sits LAST because it is the weakest claim in a rollup: such a node has
 * a single sheet and no sections, so if it ever appears beside a real visual
 * assessment that assessment must win rather than be masked as "nothing to see".
 */
const STATUS_ORDER = ['unimplemented', 'limitation', 'unreviewed', 'done', 'linter-only'];
const DEFAULT_STATUS = 'unreviewed';
const STATUS_LABEL = {
  done: 'Done',
  limitation: 'Limitation',
  unimplemented: 'Not implemented',
  unreviewed: 'Unreviewed',
  'linter-only': 'Linter only',
};
const rollupStatus = (statuses) =>
  STATUS_ORDER.find((s) => statuses.includes(s)) ?? DEFAULT_STATUS;

/**
 * Split a sheet body into the intro prose and its per-property comparison
 * sections. A section is a `## Heading` immediately followed by a
 * `<!-- compare: image=… status=… [fixture=…] -->` marker; everything up to the
 * next such heading (or the end) is that section's prose. A sheet with no marker
 * is a legacy single-pair sheet and yields an empty `sections`.
 */
function parseSections(body) {
  const lines = body.split('\n');
  const sections = [];
  const intro = [];
  const trailing = [];
  let cur = null;
  let inTrailing = false;
  for (let i = 0; i < lines.length; i++) {
    if (inTrailing) {
      trailing.push(lines[i]);
      continue;
    }
    const heading = /^##\s+(.*)$/.exec(lines[i]);
    const marker =
      heading && i + 1 < lines.length
        ? /^<!--\s*compare:\s*(.*?)\s*-->$/.exec(lines[i + 1].trim())
        : null;
    if (heading && marker) {
      const attrs = Object.fromEntries(
        marker[1].split(/\s+/).map((kv) => kv.split('='))
      );
      cur = {
        title: heading[1].trim(),
        image: attrs.image,
        status: STATUS_ORDER.includes(attrs.status) ? attrs.status : DEFAULT_STATUS,
        fixture: attrs.fixture ?? '',
        bodyLines: [],
      };
      sections.push(cur);
      i++; // consume the marker line
    } else if (heading && !marker && sections.length > 0) {
      // A markerless `## Heading` after the compare-sections (e.g. a sheet-level
      // "## Known limitations") is trailing content, not part of the last section.
      inTrailing = true;
      trailing.push(lines[i]);
    } else if (cur) {
      cur.bodyLines.push(lines[i]);
    } else {
      intro.push(lines[i]);
    }
  }
  return {
    intro: intro.join('\n').trim(),
    trailing: trailing.join('\n').trim(),
    sections: sections.map((s) => ({ ...s, body: s.bodyLines.join('\n').trim() })),
  };
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * `ADR-0025` in sheet prose becomes a link to the decision record.
 *
 * Absolute, not relative: sheets now live at varying depths inside the slice
 * tree, the gallery HTML resolves relative paths against its own location, and
 * the deployed /parity/ site has no docs/ directory at all. One generated
 * absolute URL is correct in all three places, so no sheet hand-writes one.
 */
const ADR_FILES = existsSync(join(REPO_ROOT, 'docs/adr'))
  ? readdirSync(join(REPO_ROOT, 'docs/adr')).filter((f) => f.endsWith('.md'))
  : [];
const ADR_BLOB = 'https://github.com/Vortiago/textscene-inspector/blob/main/docs/adr/';

function linkAdrs(html) {
  // Split on existing anchors and rewrite only outside them. Ordering alone does
  // not protect: `\bADR-\d{4}\b` matches an anchor's inner text just as happily
  // and would nest <a> inside <a>.
  return html
    .split(/(<a\b[^>]*>[\s\S]*?<\/a>)/g)
    .map((segment) =>
      segment.startsWith('<a')
        ? segment
        : segment.replace(/\bADR-(\d{4})\b/g, (whole, number) => {
            const file = ADR_FILES.find((f) => f.startsWith(`${number}-`));
            return file
              ? `<a class="adr" href="${ADR_BLOB}${file}" target="_blank" rel="noopener">${whole}</a>`
              : whole;
          })
    )
    .join('');
}

/** Inline Markdown: `code`, **bold**, and [text](href). Escapes first. */
function inline(text) {
  const html = escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // A sheet cites the shared-causes file by name; in the gallery that file is
    // the notes panel, so the citation becomes an in-page link to it rather than
    // a path the deployed site does not carry.
    .replace(
      /docs\/comparison\/README\.md/g,
      `<a class="adr" href="#${encodeURIComponent(NOTES_TYPE)}">${NOTES_TYPE}</a>`
    );
  return linkAdrs(html);
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
    // HTML comments are machine markers (`<!-- lint:begin … -->`), never content.
    // Without this they fall through to the paragraph branch and render escaped.
    if (/^<!--/.test(line.trim())) continue;
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
  const file = findImage(basename, side);
  if (!file) return null;
  const ext = file.endsWith('.gif') ? 'gif' : 'png';
  if (!inlineImages) return `images/${basename}-${side}.${ext}`;
  const mime = ext === 'gif' ? 'image/gif' : 'image/png';
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

const CATEGORY_ORDER = ['3D', '2D', 'Resources', 'Complex Scenes', 'Other'];

// The public previewer, deployed from main. Its `?fixture=<file>` deep link
// (useFixtureSelection.ts) opens directly on a scene, so each sheet can link to
// the very fixture it documents. A fixture added in this PR only resolves once
// it reaches main and the site redeploys — the sheets ship in the same PR.
const PREVIEW_URL = 'https://textscene-inspector.pages.dev/';

/**
 * One Godot-vs-ours comparison widget (slider + side-by-side toggle). Reused for
 * a legacy single-pair sheet and for every per-property section. A missing image
 * pair renders a placeholder rather than a broken widget.
 */
function compareStage(godot, ours, label) {
  if (!godot || !ours) {
    return `<div class="novisual">Comparison images not captured yet for ${escapeHtml(label)}.</div>`;
  }
  return `<div class="compare">
        <div class="stage">
          <img class="img-godot" src="${godot}" alt="Godot render of ${escapeHtml(label)}">
          <img class="img-ours" src="${ours}" alt="Our render of ${escapeHtml(label)}">
          <div class="handle"></div>
          <span class="tag g">Godot 4.6.3</span>
          <span class="tag o">Ours</span>
        </div>
        <div class="modes">
          <button data-mode="slider" aria-pressed="true">Slider</button>
          <button data-mode="sbs" aria-pressed="false">Side by side</button>
        </div>
      </div>`;
}

/**
 * The node catalog (`pnpm nodes:catalog`) maps every Godot node type to its
 * dimension and functional group and whether the previewer supports it. It lets
 * the gallery (a) group the nav by function and (b) list the not-yet-supported
 * nodes as their own "Not implemented" sheets instead of in a side document.
 */
function loadCatalog() {
  const file = join(here, 'node-catalog.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { nodes: [], resources: [] };
}

/**
 * Per-unsupported-node lint coverage, precomputed by `pnpm docs:lint-sections`.
 *
 * Read rather than computed: deciding whether a matcher rule reaches a node type
 * means EXECUTING its predicate, which needs the built linter — and this script
 * runs inside the web build before core is built. Absent file: the cards simply
 * omit the section.
 */
function loadLintCoverage() {
  const file = join(here, 'lint-coverage.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).unsupported ?? {} : {};
}

/** The nav entry holding the causes shared across sheets. */
const NOTES_TYPE = 'Reading these sheets';

/**
 * Every field the panel template reads. Each panel source spreads this and
 * overrides what it knows, so adding a field is one edit rather than three, and
 * a source that does not set it renders empty rather than `undefined`.
 */
const BLANK_PANEL = {
  docs: '',
  source: '',
  fixture: '',
  camera: '',
  rendersAs: '',
  group: '',
  status: DEFAULT_STATUS,
  visual: true,
  sectioned: false,
  sections: [],
  introHtml: '',
  trailingHtml: '',
  godot: null,
  ours: null,
  html: '',
};

/**
 * The explanatory sections of `docs/comparison/README.md`, as their own panel.
 *
 * A cause that spans sheets is written there once and each sheet points at it.
 * Only `index.html` and `images/` are deployed, so on the published site that
 * pointer would otherwise be a dead end: the canonical text unreachable from the
 * very page citing it. Carrying the sections into the gallery keeps the whole
 * thing self-contained, with no link out to a private repo.
 *
 * Everything from the first category heading onward is the repo-facing file
 * index, which the nav already supersedes.
 */
function loadSharedNotes() {
  const file = join(REPO_ROOT, 'docs/comparison/README.md');
  if (!existsSync(file)) return '';
  const body = readFileSync(file, 'utf8');
  const lines = body.split('\n');
  const firstCategory = lines.findIndex(
    (line) => line.startsWith('## ') && CATEGORY_ORDER.includes(line.slice(3))
  );
  const head = firstCategory === -1 ? lines : lines.slice(0, firstCategory);
  return head.join('\n').replace(/^#\s+.*$/m, '').trim();
}

function build(sheets, inlineImages, fragment) {
  const missing = [];
  const catalog = loadCatalog();
  const lintCoverage = loadLintCoverage();
  // Nodes and resources both carry `docs`/`source`; resources are absent from
  // ClassDB's node enumeration but their sheets want the same chips.
  const catalogByType = new Map(
    [...(catalog.nodes ?? []), ...(catalog.resources ?? []), ...(catalog.extras ?? [])].map((n) => [
      n.name,
      n,
    ])
  );
  // A node's functional group: from the catalog when it is a Godot node,
  // otherwise its own category (resources and complex scenes group by category).
  const groupFor = (type, category, metaGroup) =>
    catalogByType.get(type)?.group ?? metaGroup ?? category;
  const sheetNodes = sheets
    .map(({ meta, body }) => {
      const { intro, sections, trailing } = parseSections(body);
      const sectioned = sections.length > 0;
      // Section sheets resolve their images per section; a legacy sheet uses the
      // single `image:` frontmatter pair.
      const resolved = sections.map((s) => {
        const godot = imageSrc(s.image, 'godot', inlineImages);
        const ours = imageSrc(s.image, 'ours', inlineImages);
        if (!godot || !ours) missing.push(`${meta.type} › ${s.title} (${s.image})`);
        return { ...s, godot, ours, html: renderBody(s.body) };
      });
      // The frontmatter pair and the section markers are BOTH sources, never
      // either/or. A sheet that declares `image:` AND gains sections keeps its
      // own pair, shown above them: for a whole-scene sheet that overview IS
      // the subject, and the sections only decompose it. Dropping it when the
      // first section landed was silent — every other image still rendered.
      let godot = null;
      let ours = null;
      if (meta.image) {
        godot = imageSrc(meta.image, 'godot', inlineImages);
        ours = imageSrc(meta.image, 'ours', inlineImages);
        // A DECLARED `image:` whose files are absent is a broken reference and
        // fails the build. No `image:` at all is a sheet whose capture has not
        // been run yet (a freshly scaffolded slice) — that renders the
        // "not captured yet" placeholder instead of breaking every consumer.
        if (meta.visual !== 'false' && (!godot || !ours)) {
          missing.push(`${meta.type} (${meta.image})`);
        }
      }
      // A node's nav badge rolls up to its worst section; a legacy sheet takes
      // its status from frontmatter and defaults to `unreviewed` (never `done`)
      // so a sheet that predates the status system does not falsely read green.
      const status = sectioned
        ? rollupStatus(resolved.map((s) => s.status))
        : STATUS_ORDER.includes(meta.status)
          ? meta.status
          : DEFAULT_STATUS;
      return {
        ...BLANK_PANEL,
        type: meta.type,
        // Godot's own class reference and engine source, generated and verified
        // by `pnpm nodes:catalog` — never hand-written into a sheet.
        docs: catalogByType.get(meta.type)?.docs ?? '',
        source: catalogByType.get(meta.type)?.source ?? '',
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
        group: groupFor(meta.type, CATEGORY_ORDER.includes(meta.category) ? meta.category : 'Other', meta.group),
        status,
        sectioned,
        sections: resolved,
        // Only a SECTIONED sheet has an intro distinct from its body. For a
        // legacy sheet parseSections puts the whole body in `intro`, and `html`
        // holds it too — rendering both printed every legacy sheet twice.
        introHtml: sectioned ? renderBody(intro) : '',
        trailingHtml: renderBody(trailing ?? ''),
        godot,
        ours,
        html: renderBody(sectioned ? '' : body),
      };
    });

  // Every Godot node the previewer does NOT support yet becomes its own
  // "Not implemented" sheet, so the whole node surface lives in one gallery
  // rather than a side document. A hand-authored sheet always wins.
  const sheetTypes = new Set(sheetNodes.map((n) => n.type));
  const unimplemented = catalog.nodes
    .filter((n) => !n.supported && !sheetTypes.has(n.name))
    .map((n) => ({
      ...BLANK_PANEL,
      type: n.name,
      docs: n.docs ?? '',
      source: n.source ?? '',
      category: CATEGORY_ORDER.includes(n.category) ? n.category : 'Other',
      group: n.group,
      status: 'unimplemented',
      unimplemented: true,
      // An unsupported node draws nothing, but the linter still has something to
      // say about it — a universal rule, a type-family matcher, inherited
      // validators — and that is the only real content these cards carry.
      html: lintCoverage[n.name]
        ? renderBody(`## Linting\n\n${renderLintCoverage(n.name, lintCoverage[n.name])}`)
        : '',
    }));

  const sharedNotes = loadSharedNotes();
  const notesPanel = sharedNotes
    ? [
        {
          ...BLANK_PANEL,
          type: NOTES_TYPE,
          notes: true,
          category: 'Other',
          group: NOTES_TYPE,
          visual: false,
          html: renderBody(sharedNotes),
        },
      ]
    : [];

  const nodes = [
    ...notesPanel,
    ...[...sheetNodes, ...unimplemented].sort((a, b) => a.type.localeCompare(b.type)),
  ];

  // Nav is two levels: a category divider (3D / 2D / Resources / …) then a
  // sub-group per function (Lighting, Physics, UI, …). A category whose only
  // group is itself (Resources, Complex Scenes) shows no redundant sub-head.
  const nav = CATEGORY_ORDER.map((category) => {
    const inCat = nodes.filter((n) => n.category === category);
    if (!inCat.length) return '';
    const byGroup = new Map();
    for (const n of inCat) {
      if (!byGroup.has(n.group)) byGroup.set(n.group, []);
      byGroup.get(n.group).push(n);
    }
    const groupNames = [...byGroup.keys()].sort();
    const bare = groupNames.length === 1 && groupNames[0] === category;
    const groupsHtml = groupNames
      .map(
        (gname) =>
          `<div class="nav-group">${bare ? '' : `<div class="nav-head">${escapeHtml(gname)}</div>`}${byGroup
            .get(gname)
            .map(
              (n) =>
                `<button class="nav-item" data-type="${n.type}" data-status="${n.status}"><span class="st st-${n.status}" title="${STATUS_LABEL[n.status]}"></span>${n.type}</button>`
            )
            .join('')}</div>`
      )
      .join('');
    return `<div class="nav-cat">${escapeHtml(category)}</div>${groupsHtml}`;
  }).join('');

  const panels = nodes
    .map(
      (n) => `
    <article class="sheet" data-type="${n.type}" hidden>
      <header class="sheet-head">
        <h2>${escapeHtml(n.type)}</h2>
        ${n.rendersAs ? `<span class="renders">renders as ${inline(n.rendersAs)}</span>` : ''}
        ${n.docs ? `<a class="reflink" href="${n.docs}" target="_blank" rel="noopener" title="Godot class reference for ${escapeHtml(n.type)}">docs ↗</a>` : ''}
        ${n.source ? `<a class="reflink" href="${n.source}" target="_blank" rel="noopener" title="Godot engine source for ${escapeHtml(n.type)}">source ↗</a>` : ''}
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
        ${n.notes ? '' : `<span class="status st-${n.status}">${STATUS_LABEL[n.status]}</span>`}
      </header>
      ${n.sectioned || n.notes ? '' : `<div class="status-note st-${n.status}"></div>`}
      ${n.introHtml ? `<div class="prose intro">${n.introHtml}</div>` : ''}
      ${
        n.notes
          ? `<div class="prose">${n.html}</div>`
          : n.unimplemented
          ? `<div class="novisual">Not yet implemented — the previewer renders this as a transform-only fallback (children still show, the node itself draws nothing). In Godot it is a <strong>${escapeHtml(
              n.group
            )}</strong> node.</div>${n.html ? `<div class="prose">${n.html}</div>` : ''}`
          : n.sectioned
            ? `${
                // The whole-scene pair, when the sheet declares one, above the
                // sections that break it down.
                n.visual && n.godot && n.ours ? compareStage(n.godot, n.ours, n.type) : ''
              }` +
              n.sections
                .map(
                  (s) => `
      <section class="prop">
        <div class="prop-head"><h3>${escapeHtml(s.title)}</h3><span class="status st-${
          s.status
        }">${STATUS_LABEL[s.status]}</span></div>
        ${compareStage(s.godot, s.ours, s.title)}
        <div class="prose">${s.html}</div>
      </section>`
                )
                .join('') +
              (n.trailingHtml ? `<div class="prose">${n.trailingHtml}</div>` : '')
            : `${
                n.visual
                  ? compareStage(n.godot, n.ours, n.type)
                  : `<div class="novisual">No visual output — this node draws nothing to compare.</div>`
              }
      <div class="prose">${n.html}</div>`
      }
    </article>`
    )
    .join('');

  // Land on a real (implemented) sheet, not the first injected "not implemented" node.
  const firstType = (nodes.find((n) => !n.unimplemented && !n.notes) ?? nodes[0])?.type;
  return { html: page(nav, panels, firstType, fragment), missing };
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
  --line:#dde1e8; --godot:#b07430; --ours:#37729e; --ok:#2f8158; --warn:#b4553a; --err:#a23b3b;
  /* Finished, but draws nothing. Distinct from --ours, which means "our render". */
  --novis:#4a6f8f;
  --mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0e1014; --panel:#161a20; --panel-2:#1d222b; --ink:#e6e9ee; --muted:#98a1af;
  --line:#272d38; --godot:#d69b58; --ours:#69a8d6; --ok:#57b085; --warn:#e07a5f; --err:#e06a6a;
  --novis:#7fa6c4;
}}
:root[data-theme=dark]{--bg:#0e1014;--panel:#161a20;--panel-2:#1d222b;--ink:#e6e9ee;--muted:#98a1af;--line:#272d38;--godot:#d69b58;--ours:#69a8d6;--ok:#57b085;--warn:#e07a5f;--err:#e06a6a;--novis:#7fa6c4}
:root[data-theme=light]{--bg:#f5f6f8;--panel:#fff;--panel-2:#eceef2;--ink:#161a20;--muted:#5c6470;--line:#dde1e8;--godot:#b07430;--ours:#37729e;--ok:#2f8158;--warn:#b4553a;--err:#a23b3b;--novis:#4a6f8f}
*{box-sizing:border-box}
body{margin:0;display:grid;grid-template-columns:264px 1fr;min-height:100vh;background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.6}
.side{border-right:1px solid var(--line);background:var(--panel);padding:18px 14px;position:sticky;top:0;height:100vh;overflow-y:auto}
.brand{display:flex;align-items:center;gap:8px;font-weight:650;font-size:15px;letter-spacing:-.01em;margin-bottom:14px}
.dot{width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,var(--godot),var(--ours))}
#search{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel-2);color:var(--ink);font:inherit;font-size:13px;margin-bottom:12px}
#search:focus{outline:2px solid var(--ours);outline-offset:1px}
.nav-cat{font-size:12px;font-weight:700;letter-spacing:-.01em;color:var(--ink);margin:18px 0 6px;padding:0 8px 4px;border-bottom:1px solid var(--line)}
.nav-cat:first-child{margin-top:0}
.nav-group{margin-bottom:8px}
.nav-head{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);padding:0 8px 5px}
.nav-item{display:block;width:100%;text-align:left;border:0;background:none;color:var(--ink);font:inherit;font-size:13.5px;padding:5px 8px;border-radius:6px;cursor:pointer}
.nav-item:hover{background:var(--panel-2)}
.nav-item[aria-current=true]{background:var(--ours);color:#fff}
.nav-item.novis{color:var(--muted)}
.nav-item.novis::after{content:"○";float:right;font-size:10px;line-height:1.6;opacity:.6}
/* Status: a small nav dot (.st) and a header/section chip (.status). */
.st{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;vertical-align:middle}
.st-done{background:var(--ok)}.st-limitation{background:var(--warn)}.st-unimplemented{background:var(--err)}
.st-unreviewed{background:var(--muted);opacity:.55}.st-linter-only{background:var(--novis)}
.status{font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:3px 9px;border-radius:20px;color:#fff;white-space:nowrap}
.status.st-done{background:var(--ok)}.status.st-limitation{background:var(--warn)}.status.st-unimplemented{background:var(--err)}
.status.st-unreviewed{background:none;color:var(--muted);border:1px solid var(--line)}
.status.st-linter-only{background:var(--novis)}
.sheet-head .status{margin-left:auto}
.status-note{height:3px;border-radius:3px;margin:-6px 0 20px}
.status-note.st-done{background:var(--ok)}.status-note.st-limitation{background:var(--warn)}.status-note.st-unimplemented{background:var(--err)}
.status-note.st-unreviewed{background:var(--line)}.status-note.st-linter-only{background:var(--novis)}
.prop{border-top:1px solid var(--line);padding-top:24px;margin-top:30px}
.prop:first-of-type{border-top:0;padding-top:4px;margin-top:8px}
.prop-head{display:flex;align-items:center;gap:12px;margin:0 0 14px}
.prop-head h3{margin:0;font-size:18px;letter-spacing:-.01em;text-transform:none;color:var(--ink)}
.prop .prose{margin-top:16px}
.prose.intro{margin-top:0;margin-bottom:4px}
.novisual{background:var(--panel-2);border:1px dashed var(--line);border-radius:12px;padding:26px;text-align:center;color:var(--muted);font-size:14px}
main{padding:28px clamp(16px,4vw,48px)}
.sheet{max-width:900px;margin:0 auto}
.sheet-head{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:18px}
.sheet-head h2{margin:0;font-size:26px;letter-spacing:-.02em}
.renders{color:var(--muted);font-size:14px}
/* Godot reference chips — generated from the node catalog, never hand-written
   into a sheet. Godot-toned to read as "the engine's side" of the comparison. */
.reflink{font-family:var(--mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;text-decoration:none;color:var(--godot);border:1px solid var(--godot);border-radius:20px;padding:2px 9px;white-space:nowrap;opacity:.85}
.reflink:hover{background:var(--godot);color:var(--panel);opacity:1}
/* Inline ADR citation in prose, linked by the generator (never hand-written). */
.adr{color:var(--ours);text-decoration:none;border-bottom:1px dotted currentColor}
.adr:hover{border-bottom-style:solid}
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
  // Hide a category divider when every group under it (its siblings up to the
  // next divider) is filtered out.
  document.querySelectorAll('.nav-cat').forEach(cat=>{
    let any=false;
    for(let el=cat.nextElementSibling; el && !el.classList.contains('nav-cat'); el=el.nextElementSibling){
      if(el.style.display!=='none') any=true;
    }
    cat.style.display=any?'':'none';
  });
});
function initCompare(sheet){
  // A sectioned sheet has many independent compare widgets; wire each on its own
  // so a slider drag or a side-by-side toggle only touches its own stage.
  sheet.querySelectorAll('.compare').forEach(compare=>{
    const stage=compare.querySelector('.stage');
    if(!stage||stage.dataset.wired)return; stage.dataset.wired='1';
    const handle=compare.querySelector('.handle');
    // clip-path is a % of the element, so a single --split drives the clip and the
    // handle with no width bookkeeping — and nothing to break in side-by-side.
    const set=x=>{const r=stage.getBoundingClientRect();
      const p=Math.min(100,Math.max(0,((x-r.left)/r.width)*100));
      stage.style.setProperty('--split',p+'%');};
    let drag=false;
    handle.addEventListener('pointerdown',e=>{drag=true;handle.setPointerCapture(e.pointerId);});
    stage.addEventListener('pointermove',e=>{if(drag)set(e.clientX);});
    addEventListener('pointerup',()=>{drag=false;});
    compare.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{
      compare.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
      stage.classList.toggle('sbs',btn.dataset.mode==='sbs');
    }));
  });
}
const initial=decodeURIComponent(location.hash.slice(1))||FIRST;
if(initial)show(initial);
// Prose links to another panel (a sheet citing the shared-causes notes) navigate
// by hash, and the back button does too. Without this the URL changes and the
// page does not.
addEventListener('hashchange',()=>{
  const type=decodeURIComponent(location.hash.slice(1));
  if(type&&sheets.some(s=>s.dataset.type===type))show(type);
});
`;

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = collectSheetFiles();
  if (files.length === 0) throw new Error('No sheets to build');

  const sheets = files.map((f) => parseSheet(readFileSync(f, 'utf8'), sheetLabel(f)));

  // Two sheets claiming one `type` would render two <article data-type=X> and the
  // nav's show() would unhide both. Only reachable now that sheets come from
  // several roots (a half-finished move, a revert, a sheet added the old way).
  const seen = new Map();
  for (let i = 0; i < sheets.length; i++) {
    const { type } = sheets[i].meta;
    if (seen.has(type)) {
      throw new Error(
        `Duplicate sheet type "${type}": ${seen.get(type)} and ${sheetLabel(files[i])}`
      );
    }
    seen.set(type, sheetLabel(files[i]));
  }
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
