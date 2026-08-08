/**
 * Reading a comparison sheet: its frontmatter, and the split between the intro
 * prose and the per-property comparison sections.
 */

import { parseFrontmatter } from '../sheetSources.mjs';
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
 * sections. A section is a `## Heading` immediately followed by a
 * `<!-- compare: image=… status=… [fixture=…] -->` marker; everything up to the
 * next such heading (or the end) is that section's prose. A sheet with no marker
 * is a legacy single-pair sheet and yields an empty `sections`.
 */
export function parseSections(body) {
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
