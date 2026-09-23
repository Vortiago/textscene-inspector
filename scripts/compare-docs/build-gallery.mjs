#!/usr/bin/env node
/**
 * Assembles the comparison sheets (`<slice>/comparison.md` and the sliceless showcases under
 * `docs/comparison/sheets/`, see sheetSources.mjs) and the screenshots under
 * `docs/comparison/images/` into one HTML gallery: Godot beside the previewer per node type,
 * under a drag-slider. Sheets carry only content (SHEET-STANDARD.md). Every visual choice is here.
 */

import { pathToFileURL } from 'node:url';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { REPO_ROOT, collectSheetFiles, sheetLabel } from './sheetSources.mjs';
// `gallery/`: `build` assembles the panels, `panels` and `nav` render them, `markdown` renders
// sheet prose, `sheetParsing` reads a sheet, `sources` loads the catalog and screenshots,
// `vocabulary` holds the status and category words, and `page`, `styles` and `client` are the page.
import { build } from './gallery/build.mjs';
import { parseSheet } from './gallery/sheetParsing.mjs';

// `--out <path>` sets the target, docs/comparison/index.html by default. `--inline` base64-embeds
// every image so the file stands alone under an artifact's strict CSP, as in
// `--inline --out /tmp/gallery.html`. Without it the page references `images/…`, for the
// committed, served copy.
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

  // Two sheets claiming one `type` would render two <article data-type=X>, and the nav's show()
  // would unhide both. Sheets come from several roots, so a half-finished move or a revert can
  // leave two.
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
    // Nothing else regenerates the committed copy `docs/comparison/README.md` links (the web
    // build stages its own into `dist/`), so `--check` guards it. `pnpm validate` and CI run it.
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

// Guarded so importing this module, from a test for example, never runs the CLI.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
