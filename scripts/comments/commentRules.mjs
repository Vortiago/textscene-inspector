/** A tool reads these blocks whole: a licence and the stamp of a vendored copy. */
const TOOL_READ_BLOCK = /\bCopyright\b|SPDX-License-Identifier|@license|canonical source: /;

/** A tool reads these lines: lint, type and coverage directives, triple-slash references and regions. */
const DIRECTIVE_LINE =
  /^(?:eslint[- ]|globals? |@ts-|prettier-ignore|(?:istanbul|c8|v8) ignore\b|@vitest-environment|@jsx|\/ ?<reference|#(?:end)?region\b|webpack[A-Z]|@vite-ignore|[#@]__PURE__)/;

/** A bare `#n`, or `PR n` or `issue n`. Six digits are a `#000000` colour, `project#n` an upstream cite. */
const WORK_REFERENCE = /(?<![\w&])#\d{1,5}\b|\b(?:PR|pull request|issue)s? #?\d+\b/i;

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
  const firstTag = texts.findIndex(({ text }) => text.startsWith('@') && !DIRECTIVE_LINE.test(text));
  const description = firstTag === -1 ? texts : texts.slice(0, firstTag);
  return description.filter(({ text }) => text !== '' && !DIRECTIVE_LINE.test(text));
}

/** The rules `block` breaks, each as `{ rule, message }`, with `printWidth` as the widest line. */
export function commentFindings(block, printWidth) {
  if (block.lines.some((line) => TOOL_READ_BLOCK.test(line))) return [];
  const prose = proseLines(block.lines);
  if (prose.length === 0) return [];
  const widest = Math.max(...prose.map(({ index }) => block.widths[index]));
  const findings = [];
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
  if (prose.some(({ text }) => WORK_REFERENCE.test(text))) {
    findings.push({ rule: 'work-reference', message: 'an issue or PR number: git holds the history' });
  }
  return findings;
}
