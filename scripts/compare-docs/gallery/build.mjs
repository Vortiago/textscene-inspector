/**
 * Assembling the panels: the hand-authored sheets, the injected "not
 * implemented" cards for every Godot node without one, and the shared-notes
 * panel — sorted, grouped, and handed to the page.
 */

import { renderBody } from './markdown.mjs';
import { renderCoverage as renderLintCoverage } from '../lintCoverage.mjs';
import { renderNav } from './nav.mjs';
import { page } from './page.mjs';
import { BLANK_PANEL, renderPanels } from './panels.mjs';
import { imageSrc, loadCatalog, loadLintCoverage, loadSharedNotes } from './sources.mjs';
import { parseSections } from './sheetParsing.mjs';
import {
  CATEGORY_ORDER,
  DEFAULT_STATUS,
  NOTES_TYPE,
  STATUS_ORDER,
  rollupStatus,
} from './vocabulary.mjs';

/** One hand-authored sheet as a panel, with its images and rolled-up status resolved. */
function sheetPanel(
  { meta, body },
  { catalogByType, groupFor, inlineImages, missing, orphanedMarkers }
) {
  const { intro, sections, trailing, orphaned } = parseSections(body);
  for (const marker of orphaned) {
    orphanedMarkers.push(`${meta.type}: orphaned compare marker ${marker}`);
  }
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
}

export function build(sheets, inlineImages, fragment) {
  const missing = [];
  // A DECLARED `<!-- compare: … -->` marker the section scan never consumed —
  // same failure shape as a declared `image:` with no files on disk, reported
  // through its own list so the two are never confused in the summary.
  const orphanedMarkers = [];
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
  const sheetNodes = sheets.map((sheet) =>
    sheetPanel(sheet, { catalogByType, groupFor, inlineImages, missing, orphanedMarkers })
  );

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

  // Land on a real (implemented) sheet, not the first injected "not implemented" node.
  const firstType = (nodes.find((n) => !n.unimplemented && !n.notes) ?? nodes[0])?.type;
  return {
    html: page(renderNav(nodes), renderPanels(nodes), firstType, fragment),
    missing,
    orphanedMarkers,
  };
}
