/**
 * Reading a comparison sheet: its frontmatter, and the split between the intro
 * prose and the per-property comparison sections.
 */

import {
  COMPARE_MARKER_PATTERN,
  compareMarkerAttrs,
  parseFrontmatter,
} from '../sheetSources.mjs';

// Both built from `sheetSources.mjs`'s ONE pattern. Unanchored finds a marker
// anywhere on a line — a stray one with no heading above it, or trailing junk
// after `-->`; anchored tests "is THIS heading's next non-blank line a
// section marker".
const COMPARE_MARKER_RE = new RegExp(COMPARE_MARKER_PATTERN);
const COMPARE_MARKER_LINE_RE = new RegExp(`^${COMPARE_MARKER_PATTERN}$`);
import { DEFAULT_STATUS, STATUS_ORDER } from './vocabulary.mjs';

/** Split a sheet into `--- key: value ---` frontmatter and the Markdown body. */
export function parseSheet(text, file) {
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
 * Split a sheet body into the intro prose and its per-property comparison
 * sections. A section is a `## Heading` followed — immediately, or after one or
 * more blank lines — by a `<!-- compare: image=… status=… [fixture=…] -->`
 * marker; everything up to the next such heading (or the end) is that section's
 * prose. A sheet with no marker is a legacy single-pair sheet and yields an
 * empty `sections`.
 */
export function parseSections(body) {
  const lines = body.split('\n');
  const sections = [];
  const intro = [];
  const trailing = [];
  let cur = null;
  let inTrailing = false;
  // A `<!-- compare: … -->` marker that never becomes a section is a broken
  // sheet: everything the loop below would have given it — its image, its
  // status, its prose — is silently dropped rather than rendered. Collected
  // here, in the same walk: any line carrying a marker that this loop does
  // NOT consume as a section's own marker is orphaned, whether it sits past a
  // heading it isn't attached to, under no heading at all, or carries junk
  // after its `-->` (which the anchored test below rejects).
  const orphaned = [];
  const recordIfOrphaned = (line) => {
    const stray = COMPARE_MARKER_RE.exec(line);
    if (stray) orphaned.push(stray[0]);
  };
  for (let i = 0; i < lines.length; i++) {
    if (inTrailing) {
      recordIfOrphaned(lines[i]);
      trailing.push(lines[i]);
      continue;
    }
    const heading = /^##\s+(.*)$/.exec(lines[i]);
    let marker = null;
    let markerLine = i;
    if (heading) {
      // A blank line between a heading and its marker is ordinary Markdown —
      // scan past any run of them for the marker before giving up.
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length) {
        const m = COMPARE_MARKER_LINE_RE.exec(lines[j].trim());
        if (m) {
          marker = m;
          markerLine = j;
        }
      }
    }
    if (heading && marker) {
      const attrs = compareMarkerAttrs(marker[1]);
      cur = {
        title: heading[1].trim(),
        image: attrs.image,
        status: STATUS_ORDER.includes(attrs.status) ? attrs.status : DEFAULT_STATUS,
        fixture: attrs.fixture ?? '',
        bodyLines: [],
      };
      sections.push(cur);
      i = markerLine; // consume through the marker line, skipped blanks included
    } else if (heading && !marker && sections.length > 0) {
      // A markerless `## Heading` after the compare-sections (e.g. a sheet-level
      // "## Known limitations") is trailing content, not part of the last section.
      inTrailing = true;
      recordIfOrphaned(lines[i]);
      trailing.push(lines[i]);
    } else if (cur) {
      recordIfOrphaned(lines[i]);
      cur.bodyLines.push(lines[i]);
    } else {
      recordIfOrphaned(lines[i]);
      intro.push(lines[i]);
    }
  }
  return {
    intro: intro.join('\n').trim(),
    trailing: trailing.join('\n').trim(),
    sections: sections.map((s) => ({ ...s, body: s.bodyLines.join('\n').trim() })),
    orphaned,
  };
}
