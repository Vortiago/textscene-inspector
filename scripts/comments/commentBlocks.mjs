import ts from 'typescript';

const SCRIPT_KIND = { '.tsx': ts.ScriptKind.TSX, '.jsx': ts.ScriptKind.JSX, '.ts': ts.ScriptKind.TS };

function scriptKindOf(path) {
  const extension = /\.[^.]+$/.exec(path)?.[0] ?? '';
  return SCRIPT_KIND[extension] ?? ts.ScriptKind.JS;
}

/** The parser's comment ranges, not a regex: `//` inside a string, a regex or JSX text is no comment. */
function commentRanges(sourceFile) {
  const text = sourceFile.text;
  const ranges = new Map();
  const jsxTexts = [];
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.JsxText) jsxTexts.push(node);
    for (const range of ts.getLeadingCommentRanges(text, node.pos) ?? []) ranges.set(range.pos, range);
    for (const range of ts.getTrailingCommentRanges(text, node.end) ?? []) ranges.set(range.pos, range);
    for (const child of node.getChildren(sourceFile)) visit(child);
  };
  visit(sourceFile);
  const isInJsxText = (range) => jsxTexts.some((node) => range.pos >= node.pos && range.pos < node.end);
  const sorted = [...ranges.values()].sort((a, b) => a.pos - b.pos);
  return jsxTexts.length === 0 ? sorted : sorted.filter((range) => !isInJsxText(range));
}

function startsItsLine(text, pos) {
  return text.slice(text.lastIndexOf('\n', pos - 1) + 1, pos).trim() === '';
}

/** Own-line `//` comments on consecutive lines read as one block, as a reader sees them. */
function groupRanges(sourceFile, ranges) {
  const groups = [];
  for (const range of ranges) {
    const startLine = sourceFile.getLineAndCharacterOfPosition(range.pos).line;
    const endLine = sourceFile.getLineAndCharacterOfPosition(range.end).line;
    const ownLine = startsItsLine(sourceFile.text, range.pos);
    const last = groups.at(-1);
    const continuesLast =
      range.kind === ts.SyntaxKind.SingleLineCommentTrivia &&
      last?.kind === range.kind &&
      last.ownLine &&
      ownLine &&
      startLine === last.endLine + 1;
    if (continuesLast) {
      last.endLine = endLine;
      last.end = range.end;
    } else {
      groups.push({ kind: range.kind, ownLine, startLine, endLine, pos: range.pos, end: range.end });
    }
  }
  return groups;
}

function isBlankLine(lines, index) {
  return index >= lines.length || lines[index].trim() === '';
}

/**
 * Each comment block of `text`. `widestColumn` counts the code before a trailing comment.
 *
 * @canonical Read the comments of a source file
 */
export function commentBlocks(path, text) {
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, scriptKindOf(path));
  const firstCode = sourceFile.statements[0]?.getStart(sourceFile) ?? text.length;
  const sourceLines = text.split('\n');
  return groupRanges(sourceFile, commentRanges(sourceFile)).map((group) => {
    const lines = text
      .slice(group.pos, group.end)
      .split('\n')
      .map((line) => line.trimEnd());
    const startColumn = sourceFile.getLineAndCharacterOfPosition(group.pos).character;
    return {
      startLine: group.startLine + 1,
      endLine: group.endLine + 1,
      lines,
      widestColumn: Math.max(startColumn + lines[0].length, ...lines.slice(1).map((line) => line.length)),
      isFileHeader: group.end <= firstCode && isBlankLine(sourceLines, group.endLine + 1),
    };
  });
}
