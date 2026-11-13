/**
 * The scope cuts of a Markdown text that name no owner. A scope cut is a line that puts work off:
 * an item of an "Out of scope" list, or a sentence with one of the words in `PUTS_WORK_OFF`. It
 * reads text only, so a document, a pull request body and an issue body go through the same rule.
 */

/** The words that put work off. "later" and "stays" alone are left out: the ADRs use them for time and place. */
const PUTS_WORK_OFF =
  /\bout of scope\b|\bnot (?:yet )?filed\b|\bfollow-?ups?\b|\bhost inputs?\b|\bdeferred\b|\ba later (?:and separate )?(?:issue|slice|pull request|PR|project)\b/i;

/** An issue number, the link of an issue, or "no issue:" with the reason that follows it. */
const NAMES_OWNER = /#\d+|\/issues\/\d+|\bno issue: \S/i;

/** The label or heading that opens a list of cuts: "## Out of scope", "**Out of scope:**". */
const OPENS_CUT_LIST = /^(?:#{1,6}\s+)?\**out of scope\b[^:*]*:?\**:?$/i;

const FENCE = /^\s*(?:```|~~~)/;
const CODE_SPAN = /`[^`]*`/g;
const HEADING = /^#{1,6}\s/;
const LIST_ITEM = /^(\s*)(?:[-*+]|\d+\.)\s+/;
const TABLE_ROW = /^\s*\|/;

const indentOf = (line) => LIST_ITEM.exec(line)[1].length;

/**
 * @typedef {object} Block
 * @property {'heading' | 'item' | 'row' | 'paragraph'} kind
 * @property {number} line - the 1-based line the block starts on.
 * @property {string[]} lines
 */

/**
 * The blocks of `markdown`: a heading, a table row, a list item with the lines and the nested items
 * that continue it, or a paragraph. The lines of a fenced code block belong to no block.
 *
 * @returns {Block[]}
 */
function blocksOf(markdown) {
  const blocks = [];
  let open = null;
  let isInFence = false;
  const start = (kind, text, index) => {
    open = { kind, line: index + 1, lines: [text] };
    blocks.push(open);
  };
  markdown.split('\n').forEach((text, index) => {
    if (FENCE.test(text)) {
      isInFence = !isInFence;
      open = null;
    } else if (isInFence) {
      return;
    } else if (text.trim() === '') {
      open = null;
    } else if (HEADING.test(text) || TABLE_ROW.test(text)) {
      start(HEADING.test(text) ? 'heading' : 'row', text, index);
      open = null;
    } else if (LIST_ITEM.test(text) && !(open?.kind === 'item' && indentOf(text) > indentOf(open.lines[0]))) {
      start('item', text, index);
    } else if (open) {
      open.lines.push(text);
    } else {
      start('paragraph', text, index);
    }
  });
  return blocks;
}

const proseOf = ({ lines }) => lines.join(' ').replace(CODE_SPAN, '');

const opensCutList = (block) => block.kind !== 'item' && OPENS_CUT_LIST.test(proseOf(block).trim());

/** A label such as "**Acceptance criteria:**": the next part of a brief, which ends the list before it. */
const isLabel = (block) =>
  block.kind === 'heading' || (block.kind === 'paragraph' && block.lines[0].startsWith('**'));

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
    if (opensCutList(block)) {
      isInCutList = true;
      continue;
    }
    if (isLabel(block)) isInCutList = false;
    const isCut = (isInCutList && block.kind === 'item') || PUTS_WORK_OFF.test(proseOf(block));
    if (isCut && !NAMES_OWNER.test(block.lines.join(' '))) {
      unowned.push({ line: block.line, text: block.lines[0].trim() });
    }
  }
  return unowned;
}
