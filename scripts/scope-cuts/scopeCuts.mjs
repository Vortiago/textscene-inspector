/**
 * The scope cuts of a Markdown text that name no owner. A scope cut is a line that puts work off:
 * an item of an "Out of scope" list, or a sentence with one of the words in `PUTS_WORK_OFF`. It
 * reads text only, so a document, a pull request body and an issue body go through the same rule.
 */

import { isSheetPath } from '../compare-docs/sheetProse.mjs';

/** The words that put work off. "later" and "stays" alone are left out: the ADRs use them for time and place. */
const PUTS_WORK_OFF =
  /\bout of scope\b|\bnot (?:yet )?filed\b|\bfollow-?ups?\b|\bhost inputs?\b|\bdeferred\b|\ba later (?:and separate )?(?:issue|slice|pull request|PR|project)\b/i;

/** An issue number, the link of an issue, or "no issue:" with the reason that follows it. */
const NAMES_CUT_OWNER = /#\d+|\/issues\/\d+|\bno issue: \S/i;

/** What a command prints when it fails on a cut. */
export const UNOWNED_CUT_HINT =
  'A scope cut has no owner: write an issue number, or "no issue:" with the reason, in its line.';

/** The label or heading that opens a list of cuts: "## Out of scope", "**Out of scope:**". */
const OPENS_CUT_LIST = /^(?:#{1,6}\s+)?\**out of scope\b[^:*]*:?\**:?$/i;

const FENCE = /^\s*(```|~~~)/;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const CODE_SPAN = /`[^`]*`/g;
const HEADING = /^#{1,6}\s/;
const LIST_ITEM = /^(\s*)(?:[-*+]|\d+\.)\s+/;
const TABLE_ROW = /^\s*\|/;

/**
 * Whether the scope cut rule reads the file at `path`: a Markdown document of the repository root
 * or under `docs/`. A comparison sheet is left out, because the limit lines of a sheet take their
 * owner from the pull request body.
 */
export function isScopeCutDocument(path) {
  const isAtRootOrUnderDocs = !path.includes('/') || path.startsWith('docs/');
  return path.endsWith('.md') && isAtRootOrUnderDocs && !isSheetPath(path);
}

/** A comment keeps its line count and loses its text, so each line after it keeps its number. */
const withoutHtmlComments = (markdown) =>
  markdown.replace(HTML_COMMENT, (comment) => '\n'.repeat(comment.split('\n').length - 1));

/**
 * The lines of `markdown` with each fenced code block emptied. A fence ends only on the marker
 * that opened it, so a `~~~` line inside a block of three backticks is code.
 */
function proseLines(markdown) {
  let openFence = null;
  return withoutHtmlComments(markdown)
    .split('\n')
    .map((text) => {
      const fence = FENCE.exec(text)?.[1];
      if (openFence === null && fence === undefined) return text;
      if (openFence === null) openFence = fence;
      else if (fence === openFence) openFence = null;
      return '';
    });
}

/** @returns {'heading' | 'item' | 'paragraph'} a table row reads as a paragraph of one line. */
function kindOf(text) {
  if (HEADING.test(text)) return 'heading';
  return LIST_ITEM.test(text) ? 'item' : 'paragraph';
}

const indentOf = (itemLine) => LIST_ITEM.exec(itemLine)[1].length;

const standsAlone = (text) => HEADING.test(text) || TABLE_ROW.test(text);

/** A line continues the open block when it is plain text, or an item nested below the open item. */
function continuesBlock(open, text) {
  if (!open || standsAlone(text) || standsAlone(open.lines[0])) return false;
  if (!LIST_ITEM.test(text)) return true;
  return open.kind === 'item' && indentOf(text) > indentOf(open.lines[0]);
}

/**
 * @typedef {object} Block
 * @property {'heading' | 'item' | 'paragraph'} kind
 * @property {number} line - the 1-based line the block starts on.
 * @property {string[]} lines
 */

/**
 * The blocks of `markdown`: a heading, a list item with the lines and the nested items that
 * continue it, or a paragraph. A blank line ends a block.
 *
 * @returns {Block[]}
 */
function blocksOf(markdown) {
  const blocks = [];
  let open = null;
  proseLines(markdown).forEach((text, index) => {
    if (text.trim() === '') {
      open = null;
    } else if (continuesBlock(open, text)) {
      open.lines.push(text);
    } else {
      open = { kind: kindOf(text), line: index + 1, lines: [text] };
      blocks.push(open);
    }
  });
  return blocks;
}

const opensCutList = ({ kind }, prose) => kind !== 'item' && OPENS_CUT_LIST.test(prose.trim());

/** A label such as "**Acceptance criteria:**": the next part of a brief, which ends the list before it. */
const isLabel = ({ kind, lines }) =>
  kind === 'heading' || (kind === 'paragraph' && lines[0].startsWith('**'));

/**
 * Each scope cut of `markdown` that names no owner, by the line it starts on. The owner of a cut is
 * an issue number, an issue link or "no issue:" with a reason, anywhere in its list item or paragraph.
 *
 * @param {string} markdown
 * @returns {{ line: number, text: string }[]}
 */
export function unownedScopeCuts(markdown) {
  const unowned = [];
  let isInCutList = false;
  for (const block of blocksOf(markdown)) {
    const text = block.lines.join(' ');
    // A code span holds a name, not a plan, so the words of a cut are read outside it. An owner counts inside it too.
    const prose = text.replace(CODE_SPAN, '');
    if (opensCutList(block, prose)) {
      isInCutList = true;
      continue;
    }
    if (isLabel(block)) isInCutList = false;
    const isCut = (isInCutList && block.kind === 'item') || PUTS_WORK_OFF.test(prose);
    if (isCut && !NAMES_CUT_OWNER.test(text)) unowned.push({ line: block.line, text: block.lines[0].trim() });
  }
  return unowned;
}
