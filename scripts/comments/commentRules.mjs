/** A tool reads these blocks whole: a licence and the stamp of a vendored or generated file. */
const TOOL_READ_BLOCK = /\bCopyright\b|SPDX-License-Identifier|@license|canonical source: |GENERATED/;

/** A tool reads these lines: lint, type and coverage directives, triple-slash references and regions. */
const DIRECTIVE_LINE =
  /^(?:eslint[- ]|globals? |@ts-|prettier-ignore|(?:c8|v8|istanbul) ignore|@vitest-environment|@jsx|\/ ?<reference|#(?:end)?region\b|webpack[A-Z]|@vite-ignore|[#@]__PURE__)/;

/** `#1913`, `PR 1921`, `issue 259`. `harfbuzz#1532` names an upstream project's issue, a citation. */
const WORK_REFERENCE = /(?<![\w&])#\d+\b|\b(?:PR|pull request|issue)s? #?\d+\b/i;

function stripMarkers(line) {
  return line
    .trim()
    .replace(/^(?:\/\/\/?|\/\*+|\*+(?!\/))\s?/, '')
    .replace(/\*+\/$/, '')
    .trim();
}

/** The lines before the first tag, without directives: what a reader reads as the comment. */
function proseLines(lines) {
  const texts = lines.map(stripMarkers);
  const firstTag = texts.findIndex((text) => text.startsWith('@') && !DIRECTIVE_LINE.test(text));
  const description = firstTag === -1 ? texts : texts.slice(0, firstTag);
  return description.filter((text) => text !== '' && !DIRECTIVE_LINE.test(text));
}

/**
 * The rules `block` breaks, each as `{ rule, message }`: `long-comment` past one line of `printWidth`
 * columns, `module-header` above a file's first code, `work-reference` for an issue or PR number.
 */
export function commentFindings(block, printWidth) {
  if (block.lines.some((line) => TOOL_READ_BLOCK.test(line))) return [];
  const prose = proseLines(block.lines);
  if (prose.length === 0) return [];
  const findings = [];
  const widest = Math.max(...block.endColumns);
  if (prose.length > 1 || widest > printWidth) {
    findings.push({
      rule: 'long-comment',
      message: `${prose.length} prose lines, widest ${widest} columns: a comment is one line of at most ${printWidth} columns`,
    });
  }
  if (block.isFileHeader) {
    findings.push({
      rule: 'module-header',
      message: 'a comment above the first code: the file name says what it holds',
    });
  }
  if (prose.some((text) => WORK_REFERENCE.test(text))) {
    findings.push({ rule: 'work-reference', message: 'an issue or PR number: git holds the history' });
  }
  return findings;
}
