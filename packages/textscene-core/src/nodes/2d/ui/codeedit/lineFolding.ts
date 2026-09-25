/**
 * `CodeEdit::can_fold_line` (`scene/gui/code_edit.cpp:1662-1735`) and its two code-region tests
 * (`:1990-2012`): what decides whether the fold gutter draws an arrow beside a line. Every input is
 * serialisable: `line_folding`, the delimiters, `indent_size` and the buffer.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import {
  buildDelimiterCache,
  buildDelimiters,
  codeRegionStrings,
  delimiterEndLine,
  delimiterStartLine,
  isLineInDelimiter,
  type Delimiter,
  type DelimiterCacheLine,
} from './delimiterRegions.js';

/** Everything `canFoldLine` needs for one CodeEdit, built once per buffer. */
export interface FoldContext {
  lines: readonly string[];
  delimiters: readonly Delimiter[];
  cache: readonly DelimiterCacheLine[];
  /** `code_region_start_string` / `code_region_end_string` (`code_edit.cpp:3186-3207`). */
  regionStart: string;
  regionEnd: string;
  /** `text.get_tab_size()`, which CodeEdit's `indent_size` forwards to (`code_edit.cpp:908-920`). Godot default 4. */
  tabSize: number;
}

/** Builds the per-buffer state `canFoldLine` reads. */
export function buildFoldContext(
  lines: readonly string[],
  comments: readonly string[] | undefined,
  strings: readonly string[] | undefined,
  tabSize: number
): FoldContext {
  const delimiters = buildDelimiters(comments, strings);
  const { start, end } = codeRegionStrings(delimiters);
  return {
    lines,
    delimiters,
    cache: buildDelimiterCache(lines, delimiters),
    regionStart: start,
    regionEnd: end,
    tabSize,
  };
}

/** `TextEdit::get_indent_level` (`text_edit.cpp:4145-4161`): tabs count as `tab_size`, and the last character is never counted. */
export function getIndentLevel(line: string, tabSize: number): number {
  let tabs = 0;
  let spaces = 0;
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i] === '\t') tabs++;
    else if (line[i] === ' ') spaces++;
    else break;
  }
  return tabs * tabSize + spaces;
}

/** `is_line_code_region_start` (`code_edit.cpp:1990-2000`): the first space-separated word of the trimmed line is the tag. */
export function isLineCodeRegionStart(ctx: FoldContext, line: number): boolean {
  return matchesRegionTag(ctx, line, ctx.regionStart);
}

/** `is_line_code_region_end` (`code_edit.cpp:2002-2012`). */
export function isLineCodeRegionEnd(ctx: FoldContext, line: number): boolean {
  return matchesRegionTag(ctx, line, ctx.regionEnd);
}

function matchesRegionTag(ctx: FoldContext, line: number, tag: string): boolean {
  if (ctx.regionStart.length === 0) return false;
  if (isInString(ctx, line) !== -1) return false;
  const first = (ctx.lines[line] ?? '').trim().split(' ')[0] ?? '';
  return first === tag;
}

/** `is_in_comment(line)`: `_is_in_delimiter` at no column (`code_edit.cpp:2068-2071`). */
export function isInComment(ctx: FoldContext, line: number): number {
  return isLineInDelimiter(ctx.lines, ctx.delimiters, ctx.cache, line, 'comment');
}

/** `is_in_string(line)` (`code_edit.cpp:2039-2042`). */
export function isInString(ctx: FoldContext, line: number): number {
  return isLineInDelimiter(ctx.lines, ctx.delimiters, ctx.cache, line, 'string');
}

/**
 * `CodeEdit::can_fold_line` (`code_edit.cpp:1662-1735`). No `.tscn` property folds a line, so
 * `_is_line_hidden` and `is_line_folded` are false and their two branches collapse away.
 */
export function canFoldLine(ctx: FoldContext, line: number, lineFoldingEnabled: boolean): boolean {
  if (!lineFoldingEnabled) return false;
  if (line + 1 >= ctx.lines.length || (ctx.lines[line] ?? '').trim().length === 0) return false;

  if (isLineCodeRegionEnd(ctx, line)) return false;
  if (isLineCodeRegionStart(ctx, line)) {
    let level = 0;
    for (let next = line + 1; next < ctx.lines.length; next++) {
      if (isLineCodeRegionEnd(ctx, next)) {
        level -= 1;
        if (level === -1) return true;
      }
      if (isLineCodeRegionStart(ctx, next)) level += 1;
    }
    return false;
  }

  const inComment = isInComment(ctx, line);
  const inString = inComment === -1 ? isInString(ctx, line) : -1;
  if (inString !== -1 || inComment !== -1) {
    const text = ctx.lines[line] ?? '';
    if (delimiterStartLine(ctx.lines, ctx.cache, ctx.delimiters, line, text.length) !== line) {
      return false;
    }
    const endLine = delimiterEndLine(ctx.lines, ctx.cache, ctx.delimiters, line, text.length);
    // No end line: the region runs to the end of the buffer.
    if (endLine === -1) return true;
    if (endLine === line) {
      // A block of single-line delimiters: this line must start it and it must
      // continue for at least one more.
      if (line - 1 >= 0 && continuesRegion(ctx, line - 1, inString, inComment)) return false;
      return continuesRegion(ctx, line + 1, inString, inComment);
    }
    return (
      (inString !== -1 && isInString(ctx, endLine) !== -1) ||
      (inComment !== -1 && isInComment(ctx, endLine) !== -1)
    );
  }

  const startIndent = getIndentLevel(ctx.lines[line] ?? '', ctx.tabSize);
  for (let i = line + 1; i < ctx.lines.length; i++) {
    if (
      isInString(ctx, i) !== -1 ||
      isInComment(ctx, i) !== -1 ||
      (ctx.lines[i] ?? '').trim().length === 0
    ) {
      continue;
    }
    return getIndentLevel(ctx.lines[i] ?? '', ctx.tabSize) > startIndent;
  }
  return false;
}

/** `(in_string != -1 && is_in_string(l) != -1) || (in_comment != -1 && is_in_comment(l) != -1 && !region tag)` (`code_edit.cpp:1714,1719`). */
function continuesRegion(ctx: FoldContext, line: number, inString: number, inComment: number): boolean {
  if (line < 0 || line >= ctx.lines.length) return false;
  if (inString !== -1) return isInString(ctx, line) !== -1;
  return (
    inComment !== -1 &&
    isInComment(ctx, line) !== -1 &&
    !isLineCodeRegionStart(ctx, line) &&
    !isLineCodeRegionEnd(ctx, line)
  );
}
