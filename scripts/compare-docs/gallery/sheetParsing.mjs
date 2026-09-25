/**
 * Reading a comparison sheet: its frontmatter, and the split between the intro
 * prose and the per-property comparison sections.
 */

import {
  COMPARE_MARKER_PATTERN,
  compareMarkerAttrs,
  parseFrontmatter,
} from '../sheetSources.mjs';

// Both from `sheetSources.mjs`'s one pattern. Unanchored finds a marker
// anywhere on a line, such as a stray one or one with junk after `-->`.
// Anchored asks whether a heading's next non-blank line is a section marker.
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
 * Splits a sheet body into intro prose and sections. A section is a `## Heading`
 * whose next non-blank line is a `<!-- compare: image=… status=… [fixture=…] -->`
 * marker, up to the next such heading. A legacy sheet has no marker and yields
 * an empty `sections`.
 */
export function parseSections(body) {
  const lines = body.split('\n');
  const sections = [];
  const intro = [];
  const trailing = [];
  let cur = null;
  let inTrailing = false;
  // A marker the loop does not consume as a section's own is orphaned, and its
  // image, status and prose would drop silently. That covers a marker under no
  // heading, one detached from its heading, and one with junk after `-->`.
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
      // Blank lines between a heading and its marker are ordinary Markdown.
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
      // A markerless `## Heading` after the sections, such as "## Known
      // limitations", is trailing content, not part of the last section.
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
