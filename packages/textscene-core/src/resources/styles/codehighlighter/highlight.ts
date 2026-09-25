/**
 * `CodeHighlighter::_get_line_syntax_highlighting_impl`
 * (`scene/resources/syntax_highlighter.cpp:118-411`): a line scanner with no
 * grammar. Keywords are lookups at word boundaries, a number is a shape, and a
 * colour region is a literal delimiter match. A real lexer would draw a different picture.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { Color } from '../../../utils/colorParser';
import { colorEquals, DEFAULT_COLOR } from './decode';
import type { CodeHighlighterData } from './types';

/** `core/string/char_utils.h:113-114`. */
function isSymbol(ch: string | undefined): boolean {
  if (ch === undefined) return false;
  const code = ch.codePointAt(0) ?? 0;
  if (code === 0x5f) return false;
  return (
    (code >= 0x21 && code <= 0x2f) ||
    (code >= 0x3a && code <= 0x40) ||
    (code >= 0x5b && code <= 0x60) ||
    (code >= 0x7b && code <= 0x7e) ||
    code === 0x09 ||
    code === 0x20
  );
}
/** `core/string/char_utils.h:99`. */
function isDigit(ch: string | undefined): boolean {
  return ch !== undefined && ch >= '0' && ch <= '9';
}
/** `core/string/char_utils.h:103`. */
function isHexDigit(ch: string | undefined): boolean {
  return isDigit(ch) || (ch !== undefined && ((ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')));
}
/** `core/string/char_utils.h:111`. */
function isAsciiAlphabetChar(ch: string | undefined): boolean {
  return ch !== undefined && ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z'));
}

export interface CodeHighlighterColorSpan {
  /** Character index this span starts at, inclusive. */
  startIndex: number;
  /** Character index this span ends at, exclusive. */
  endIndex: number;
  color: Color;
}

interface DeltaEntry {
  index: number;
  color: Color;
}

/**
 * `syntax_highlighter.cpp:118-411`, transcribed 1:1: same variable roles, control
 * flow and index jumps (`j = line_length`, `j = from + …`). Returns the sparse
 * delta map, as Godot's `color_map` Dictionary.
 */
function scanLine(
  line: string,
  highlighter: CodeHighlighterData,
  fontColor: Color,
  regionAtLineStart: number
): { deltas: DeltaEntry[]; regionAtLineEnd: number } {
  const deltas: DeltaEntry[] = [];
  const lineLength = line.length;
  let regionAtLineEnd = -1;

  if (regionAtLineStart !== -1 && lineLength === 0) {
    regionAtLineEnd = regionAtLineStart;
  }

  let prevIsChar = false;
  let prevIsNumber = false;
  let inKeyword = false;
  let inWord = false;
  let inFunctionName = false;
  let inMemberVariable = false;
  let isHexNotation = false;
  let keywordColor: Color = DEFAULT_COLOR;
  // `Color prev_color;` (`:149`) default-constructs to opaque black
  // (`core/math/color.h:251-252`), not `font_color`.
  let prevColor: Color = DEFAULT_COLOR;
  let inRegion = regionAtLineStart;

  for (let j = 0; j < lineLength; j++) {
    let color: Color = fontColor;
    let isChar = !isSymbol(line[j]);
    let isASymbol = isSymbol(line[j]);
    let isNumber = isDigit(line[j]);

    if (isASymbol || inRegion !== -1) {
      let from = j;
      if (inRegion === -1) {
        while (from < lineLength) {
          if (line[from] === '\\') {
            from++;
            continue;
          }
          break;
        }
      }

      if (from !== lineLength) {
        if (inRegion === -1) {
          for (let c = 0; c < highlighter.colorRegions.length; c++) {
            const region = highlighter.colorRegions[c]!;
            const charsLeft = lineLength - from;
            if (charsLeft < region.startKey.length) continue;

            let startMatches = true;
            for (let k = 0; k < region.startKey.length; k++) {
              if (region.startKey[k] !== line[from + k]) {
                startMatches = false;
                break;
              }
            }
            if (!startMatches) continue;

            inRegion = c;
            from += region.startKey.length;

            if (region.endKey.length === 0 || region.lineOnly || from + region.endKey.length > lineLength) {
              if (
                from + region.endKey.length > lineLength &&
                (region.startKey === '"' || region.startKey === "'")
              ) {
                if (line.indexOf('\\', from) >= 0) break;
              }
              prevColor = region.color;
              deltas.push({ index: j, color: region.color });
              j = lineLength;
              if (!region.lineOnly) regionAtLineEnd = c;
            }
            break;
          }
          if (j === lineLength) continue;
        }

        if (inRegion !== -1) {
          const region = highlighter.colorRegions[inRegion]!;
          const isString = region.startKey === '"' || region.startKey === "'";
          const regionColor = region.color;
          prevColor = regionColor;
          deltas.push({ index: j, color: regionColor });

          let regionEndIndex = -1;
          for (; from < lineLength; from++) {
            if (lineLength - from < region.endKey.length) {
              if (!isString || line.indexOf('\\', from) < 0) break;
            }
            if (!isSymbol(line[from])) continue;
            if (line[from] === '\\') {
              if (isString) deltas.push({ index: from, color: highlighter.symbolColor });
              from++;
              if (isString) deltas.push({ index: from + 1, color: regionColor });
              continue;
            }
            regionEndIndex = from;
            for (let k = 0; k < region.endKey.length; k++) {
              if (region.endKey[k] !== line[from + k]) {
                regionEndIndex = -1;
                break;
              }
            }
            if (regionEndIndex !== -1) break;
          }

          j = from + (region.endKey.length - 1);
          if (regionEndIndex === -1) regionAtLineEnd = inRegion;
          inRegion = -1;
          prevIsChar = false;
          prevIsNumber = false;
          continue;
        }
      }
    }

    if (isHexNotation && (isHexDigit(line[j]) || isNumber)) {
      isNumber = true;
    } else {
      isHexNotation = false;
    }

    const ch = line[j];
    if (
      (ch === '.' || ch === 'x' || ch === 'X' || ch === '_' || ch === 'f' || ch === 'e' || ch === 'E') &&
      !inWord &&
      prevIsNumber &&
      !isNumber
    ) {
      isNumber = true;
      isASymbol = false;
      isChar = false;
      if ((ch === 'x' || ch === 'X') && line[j - 1] === '0') isHexNotation = true;
    }

    if (!inWord && (isAsciiAlphabetChar(ch) || ch === '_') && !isNumber) {
      inWord = true;
    }

    if ((inKeyword || inWord) && !isHexNotation) {
      isNumber = false;
    }

    if (isASymbol && ch !== '.' && inWord) {
      inWord = false;
    }

    if (!isChar) {
      inKeyword = false;
    }

    if (!inKeyword && isChar && !prevIsChar) {
      let to = j;
      while (to < lineLength && !isSymbol(line[to])) to++;
      const word = line.slice(j, to);
      let col: Color | undefined;
      if (highlighter.keywordColors.has(word)) {
        col = highlighter.keywordColors.get(word);
      } else if (highlighter.memberKeywordColors.has(word)) {
        col = highlighter.memberKeywordColors.get(word);
        for (let k = j - 1; k >= 0; k--) {
          if (line[k] === '.') {
            col = DEFAULT_COLOR; // member indexing not allowed
            break;
          } else if (line.charCodeAt(k) > 32) {
            break;
          }
        }
      }
      if (col !== undefined && !colorEquals(col, DEFAULT_COLOR)) {
        inKeyword = true;
        keywordColor = col;
      }
    }

    if (!inFunctionName && inWord && !inKeyword) {
      let k = j;
      while (k < lineLength && !isSymbol(line[k]) && line[k] !== '\t' && line[k] !== ' ') k++;
      while (k < lineLength && (line[k] === '\t' || line[k] === ' ')) k++;
      if (line[k] === '(') inFunctionName = true;
    }

    if (!inFunctionName && !inMemberVariable && !inKeyword && !isNumber && inWord) {
      let k = j;
      while (k > 0 && !isSymbol(line[k]) && line[k] !== '\t' && line[k] !== ' ') k--;
      if (line[k] === '.') inMemberVariable = true;
    }

    if (isASymbol) {
      inFunctionName = false;
      inMemberVariable = false;
    }

    if (inKeyword) {
      color = keywordColor;
    } else if (inMemberVariable) {
      color = highlighter.memberVariableColor;
    } else if (inFunctionName) {
      color = highlighter.functionColor;
    } else if (isASymbol) {
      color = highlighter.symbolColor;
    } else if (isNumber) {
      color = highlighter.numberColor;
    }

    prevIsChar = isChar;
    prevIsNumber = isNumber;

    if (!colorEquals(color, prevColor)) {
      prevColor = color;
      deltas.push({ index: j, color });
    }
  }

  return { deltas, regionAtLineEnd };
}

/**
 * Contiguous colour spans for a line. `text_edit.cpp:1349-1351,1664-1668`: the
 * drawing side starts at the font colour (`fontColor`) and takes the last
 * `color_map` entry at or before each glyph. Forward-filling the delta map once
 * reproduces that lookup.
 * @param regionAtLineStart The colour region open at the line start, as Godot's
 *   `color_region_cache` (`:131-152`) carries it into the next line. Godot walks back through
 *   uncached lines (`:133-144`). Callers here visit lines in order, so they pass the previous
 *   line's `regionAtLineEnd`.
 */
export function resolveLineColors(
  line: string,
  highlighter: CodeHighlighterData,
  fontColor: Color,
  regionAtLineStart = -1
): { spans: CodeHighlighterColorSpan[]; regionAtLineEnd: number } {
  const { deltas, regionAtLineEnd } = scanLine(line, highlighter, fontColor, regionAtLineStart);
  const spans: CodeHighlighterColorSpan[] = [];
  let cursor = 0;
  let currentColor = fontColor;
  for (const delta of deltas) {
    if (delta.index > cursor) {
      spans.push({ startIndex: cursor, endIndex: delta.index, color: currentColor });
    }
    currentColor = delta.color;
    cursor = delta.index;
  }
  if (cursor < line.length) {
    spans.push({ startIndex: cursor, endIndex: line.length, color: currentColor });
  }
  return { spans, regionAtLineEnd };
}
