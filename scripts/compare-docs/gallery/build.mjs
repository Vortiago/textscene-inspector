/**
 * Assembles the panels: the hand-authored sheets, a "not implemented" card for
 * every Godot node without one, and the shared-notes panel, sorted and grouped.
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
  // Section sheets resolve their images per section. A legacy sheet uses the
  // single `image:` frontmatter pair.
  const resolved = sections.map((s) => {
    const godot = imageSrc(s.image, 'godot', inlineImages);
    const ours = imageSrc(s.image, 'ours', inlineImages);
    if (!godot || !ours) missing.push(`${meta.type} › ${s.title} (${s.image})`);
    return { ...s, godot, ours, html: renderBody(s.body) };
  });
  // The frontmatter pair and the section markers are both sources. A sheet
  // with `image:` and sections shows its own pair above them: for a
  // whole-scene sheet that overview is the subject.
  let godot = null;
  let ours = null;
  if (meta.image) {
    godot = imageSrc(meta.image, 'godot', inlineImages);
    ours = imageSrc(meta.image, 'ours', inlineImages);
    // A declared `image:` with no files is reported as missing, and the corpus
    // test fails. No `image:` at all is a sheet not captured yet: a placeholder.
    if (meta.visual !== 'false' && (!godot || !ours)) {
      missing.push(`${meta.type} (${meta.image})`);
    }
  }
  // A node's nav badge rolls up to its worst section. A legacy sheet takes its
  // status from frontmatter and defaults to `unreviewed`, never `done`.
  const status = sectioned
    ? rollupStatus(resolved.map((s) => s.status))
    : STATUS_ORDER.includes(meta.status)
      ? meta.status
      : DEFAULT_STATUS;
  return {
    ...BLANK_PANEL,
    type: meta.type,
    // Generated and verified by `pnpm nodes:catalog`, never hand-written.
    docs: catalogByType.get(meta.type)?.docs ?? '',
    source: catalogByType.get(meta.type)?.source ?? '',
    category: CATEGORY_ORDER.includes(meta.category) ? meta.category : 'Other',
    // A node with no visual output sets `visual: false` and gets a "no visual
    // output" note, not an empty image pair.
    visual: meta.visual !== 'false',
    fixture: meta.fixture ?? '',
    // Optional: a Camera3D path to look through on open (`?camera=`), so the
    // live link opens the same view as the captured image.
    camera: meta.camera ?? '',
    rendersAs: meta.renders_as ?? '',
    group: groupFor(meta.type, CATEGORY_ORDER.includes(meta.category) ? meta.category : 'Other', meta.group),
    status,
    sectioned,
    sections: resolved,
    // Only a sectioned sheet has an intro apart from its body. For a legacy
    // sheet `intro` and `html` both hold the whole body.
    introHtml: sectioned ? renderBody(intro) : '',
    trailingHtml: renderBody(trailing ?? ''),
    godot,
    ours,
    html: renderBody(sectioned ? '' : body),
  };
}

export function build(sheets, inlineImages, fragment) {
  const missing = [];
  // A declared `<!-- compare: … -->` marker the section scan never consumed.
  // Its own list keeps it apart from a missing `image:` in the summary.
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

  // Every Godot node the previewer does not support becomes a "Not
  // implemented" sheet. A hand-authored sheet always wins.
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
      // An unsupported node draws nothing, but the linter still reaches it
      // through universal rules, matchers and inherited validators.
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
