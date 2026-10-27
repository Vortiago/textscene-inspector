/**
 * The lines of a TextMesh: the shaped text broken at `width` as `autowrap_mode` says, and justified
 * under `HORIZONTAL_ALIGNMENT_FILL` (`primitive_meshes.cpp:3257-3304`). A TextMesh passes no trim
 * flag to the line breaker, so it keeps the spaces at the edge of a line, unlike a Label.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { HorizontalAlignment } from '../../../godot/math/alignment';
import { AutowrapMode } from '../../../godot/text/textServerEnums';
import type { FontMetrics } from '../../../r3f/controls/native/text/fontMetrics';
import { fitLineToWidth, justifyToLineIndex } from '../../../r3f/controls/native/text/textJustify';
import {
  clampAutowrapMode,
  shapedTextSizeWidthPx,
  shapeText,
  type TextLineLayout,
} from '../../../r3f/controls/native/text/textLayout';
import type { TextMeshProperties } from './types';

/** No `BREAK_TRIM_*` bit (`primitive_meshes.cpp:3268-3282`). */
const NO_TRIM_FLAGS = 0;

export interface TextMeshLines {
  lines: readonly TextLineLayout[];
  /** From the top of a line to its baseline, in font px. */
  baselineOffsetPx: number;
  /** One line's height with `line_spacing`, in font px. */
  linePitchPx: number;
}

/** The width a justified line grows or shrinks to: `width`, else the widest line (`:3284-3304`). */
function justificationWidthPx(width: number, lines: readonly TextLineLayout[]): number {
  if (width > 0) return width;
  return Math.max(0, ...lines.map((line) => shapedTextSizeWidthPx(line.widthPx)));
}

function justified(lines: readonly TextLineLayout[], properties: TextMeshProperties): TextLineLayout[] {
  const toLine = justifyToLineIndex(lines, properties.justificationFlags);
  const widthPx = justificationWidthPx(properties.width, lines);
  return lines.map((line, i) =>
    i < toLine
      ? fitLineToWidth(line, widthPx, properties.justificationFlags, { fontSizePx: properties.fontSize }).line
      : line
  );
}

export function shapeTextMeshLines(properties: TextMeshProperties, metrics: FontMetrics): TextMeshLines {
  const layout = shapeText(properties.text, {
    fontSizePx: properties.fontSize,
    boxWidthPx: properties.width,
    autowrapMode: clampAutowrapMode(properties.autowrapMode, AutowrapMode.AUTOWRAP_OFF),
    uppercase: properties.isUppercase,
    lineSpacingPx: properties.lineSpacing,
    autowrapTrimFlags: NO_TRIM_FLAGS,
    fontMetrics: metrics,
  });
  const isFill = properties.horizontalAlignment === HorizontalAlignment.HORIZONTAL_ALIGNMENT_FILL;
  return {
    lines: isFill ? justified(layout.lines, properties) : layout.lines,
    baselineOffsetPx: layout.baselineOffsetPx,
    linePitchPx: layout.linePitchPx,
  };
}
