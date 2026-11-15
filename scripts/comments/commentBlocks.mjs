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
  return outsideJsxText(
    [...ranges.values()].sort((a, b) => a.pos - b.pos),
    jsxTexts
  );
}

/** Both lists are in source order, so one pass walks them together. */
function outsideJsxText(ranges, jsxTexts) {
  let next = 0;
  return ranges.filter((range) => {
    while (next < jsxTexts.length && jsxTexts[next].end <= range.pos) next++;
    return !(next < jsxTexts.length && jsxTexts[next].pos <= range.pos);
  });
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
 * Each comment block of `text`. `widths` holds the end column of each line, with the code before it.
 *
 * @canonical Read the comments of a source file
 */
export function commentBlocks(path, text) {
  const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, scriptKindOf(path));
  const firstStatement = sourceFile.statements[0];
  const firstCode = firstStatement?.getStart(sourceFile) ?? text.length;
  const opensWithImport = firstStatement?.kind === ts.SyntaxKind.ImportDeclaration;
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
      widths: lines.map((line, index) => (index === 0 ? startColumn : 0) + line.length),
      isFileHeader:
        group.end <= firstCode && (opensWithImport || isBlankLine(sourceLines, group.endLine + 1)),
    };
  });
}
