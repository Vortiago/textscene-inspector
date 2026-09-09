#!/usr/bin/env node
/**
 * Assemble the comparison sheets (`<slice>/comparison.md`, plus the sliceless
 * showcases under `docs/comparison/sheets/` — see sheetSources.mjs) and the
 * screenshots under `docs/comparison/images/` into one browsable HTML gallery:
 * Godot beside our renderer, per node type, under a drag-slider.
 *
 *   node scripts/compare-docs/build-gallery.mjs                # -> docs/comparison/index.html, images referenced
 *   node scripts/compare-docs/build-gallery.mjs --check        # fail if the committed copy is stale
 *   node scripts/compare-docs/build-gallery.mjs --inline --out /tmp/gallery.html   # self-contained (artifact/preview)
 *
 * The committed copy is what `docs/comparison/README.md` sends a reader to, and
 * nothing else regenerates it — the web build stages its own into `dist/`. So
 * `--check` is the only thing standing between it and the sheets it was built
 * from; `pnpm validate` and CI run it.
 *
 * The sheets carry only content (see SHEET-STANDARD.md); everything visual is
 * decided here, so re-styling the gallery never touches a sheet and refreshing
 * the screenshots (`capture.mjs`) never touches one either.
 *
 * `--inline` base64-embeds every image so the file stands alone under an
 * artifact's strict CSP; the default references `images/…` for the committed,
 * website-served copy.
 *
 * The generator lives in `gallery/`: `build` assembles the panels, `panels` and
 * `nav` render them, `markdown` renders sheet prose, `sheetParsing` reads a
 * sheet, `sources` loads the catalog and screenshots, `vocabulary` holds the
 * status/category words, and `page`/`styles`/`client` are the document itself.
 */

import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { REPO_ROOT, collectSheetFiles, sheetLabel } from './sheetSources.mjs';
import { build } from './gallery/build.mjs';
import { parseSheet } from './gallery/sheetParsing.mjs';

function parseArgs(argv) {
  const args = {
    inline: false,
    fragment: false,
    check: false,
    out: join(REPO_ROOT, 'docs/comparison/index.html'),
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--inline') args.inline = true;
    else if (argv[i] === '--fragment') args.fragment = true;
    else if (argv[i] === '--check') args.check = true;
    else if (argv[i] === '--out') args.out = argv[++i];
    else throw new Error(`Unknown flag ${argv[i]}`);
  }
  return args;
}

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
  const { html, missing, orphanedMarkers } = build(sheets, args.inline, args.fragment);

  const rel = relative(REPO_ROOT, args.out);
  const where = rel && !rel.startsWith('..') ? rel : args.out;
  if (args.check) {
    const current = existsSync(args.out) ? readFileSync(args.out, 'utf8') : null;
    if (current === html) {
      console.log(`[gallery] ${where} is up to date (${sheets.length} sheet(s)).`);
    } else {
      console.error(`[gallery] ${where} is STALE — run \`pnpm docs:gallery\`.`);
      process.exitCode = 1;
    }
  } else {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, html);
    console.log(`[gallery] ${sheets.length} sheet(s) → ${args.out}`);
  }
  if (missing.length) {
    console.warn(`[gallery] ${missing.length} sheet(s) reference a MISSING image:`);
    for (const m of missing) console.warn(`  ${m}`);
    console.warn('[gallery] run the capture for these; the corpus test fails until they exist');
  }
  if (orphanedMarkers.length) {
    console.error(`[gallery] ${orphanedMarkers.length} sheet(s) carry an orphaned compare marker:`);
    for (const m of orphanedMarkers) console.error(`  ${m}`);
    process.exitCode = 1;
  }
}

// Guarded so importing this module (e.g. from a test) never runs the CLI as an
// import side effect — only invoking it directly does.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
