/** A tool reads these blocks whole: a licence and the stamp of a vendored copy. */
const TOOL_READ_BLOCK = /\bCopyright\b|SPDX-License-Identifier|@license|canonical source: /;

/** A tool reads these lines: lint, type and coverage directives, triple-slash references and regions. */
const DIRECTIVE_LINE =
  /^(?:eslint-(?:disable|enable)|eslint [\w@/-]+:|globals? [\w$]+(?:\s*:\s*\w+)?\s*(?:,|$)|@ts-|prettier-ignore|(?:istanbul|c8|v8) ignore\b|@vitest-environment|@jsx|\/ ?<reference|#(?:end)?region\b|webpack[A-Z]|@vite-ignore|[#@]__PURE__)/;

/** A bare `#n`, `PR n` or `issue n`. A colour is code in backticks, and `project#n` is an upstream cite. */
const WORK_REFERENCE = /(?<![\w&])#\d{1,5}\b|\b(?:PR|pull request|issue)s? #?\d+\b/i;

/** A JSDoc tag word, not a scoped package such as `@textscene/core`. */
const TAG_LINE = /^@[a-zA-Z]+(?![\w/.-])/;

const CODE_SPAN = /`[^`]*`/g;

function stripMarkers(line) {
  return line
    .trim()
    .replace(/^(?:\/\/\/?|\/\*+|\*+(?!\/))\s?/, '')
    .replace(/\*+\/$/, '')
    .trim();
}

/** The lines before the first tag, without directives: what a reader reads as the comment. */
function proseLines(lines) {
  const texts = lines.map((line, index) => ({ index, text: stripMarkers(line) }));
  const firstTag = texts.findIndex(({ text }) => TAG_LINE.test(text) && !DIRECTIVE_LINE.test(text));
  const description = firstTag === -1 ? texts : texts.slice(0, firstTag);
  return description.filter(({ text }) => text !== '' && !DIRECTIVE_LINE.test(text));
}

/** The rules `block` breaks, each as `{ rule, message }`, with `printWidth` as the widest line. */
export function commentFindings(block, printWidth) {
  if (block.lines.some((line) => TOOL_READ_BLOCK.test(line))) return [];
  const findings = [];
  if (block.lines.some((line) => WORK_REFERENCE.test(line.replace(CODE_SPAN, '')))) {
    findings.push({ rule: 'work-reference', message: 'an issue or PR number: git holds the history' });
  }
  const prose = proseLines(block.lines);
  if (prose.length === 0) return findings;
  const widest = Math.max(...prose.map(({ index }) => block.widths[index]));
  if (prose.length > 1 || widest > printWidth) {
    findings.push({
      rule: 'long-comment',
      message: `${prose.length} prose ${prose.length === 1 ? 'line' : 'lines'}, widest ${widest} columns: a comment is one line of at most ${printWidth} columns`,
    });
  }
  if (block.isFileHeader) {
    findings.push({
      rule: 'module-header',
      message: 'a comment above the first code: the file name says what it holds',
    });
  }
  return findings;
}
