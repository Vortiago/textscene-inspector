/**
 * The strict Markdown subset the sheet standard permits, rendered to HTML.
 * Deliberately not a Markdown library: a sheet that reaches for anything not
 * handled here has left the standard, and should read oddly.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { isDivider, splitRow } from '../markdownTable.mjs';
import { REPO_ROOT } from '../sheetSources.mjs';
import { NOTES_TYPE } from './vocabulary.mjs';

export const escapeHtml = (s) =>
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
export function inline(text) {
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
export function renderBody(body) {
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
  // The generator's own splitter: a cell carrying an escaped `|` is one cell on
  // both sides, so a row cannot pass the sheet and still break the page.
  const cells = splitRow;
  const body = rows.filter((r) => !isDivider(r.trim()));
  const [head, ...rest] = body;
  const th = cells(head).map((c) => `<th>${inline(c)}</th>`).join('');
  const trs = rest
    .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="tablewrap"><table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></div>`;
}
