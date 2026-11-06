/**
 * The lines of a TextMesh: the text shaped in its direction, language and override
 * (`primitive_meshes.cpp:3224-3240`), broken at `width` as `autowrap_mode` says, and justified under
 * `HORIZONTAL_ALIGNMENT_FILL` (`:3257-3304`). A TextMesh passes no trim
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
import { textBidiOptions } from '../../../r3f/controls/native/text/textBidiOptions';
import { justifyLinesToWidth } from '../../../r3f/controls/native/text/textJustify';
import {
  clampAutowrapMode,
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

/** An empty `language` takes `locale`, the project's `_get_locale()` (`primitive_meshes.cpp:3230`). */
export function shapeTextMeshLines(
  properties: TextMeshProperties,
  locale: string,
  metrics: FontMetrics
): TextMeshLines {
  const layout = shapeText(properties.text, {
    ...textBidiOptions(properties, locale),
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
    lines: isFill
      ? justifyLinesToWidth(layout.lines, properties.width, properties.justificationFlags)
      : layout.lines,
    baselineOffsetPx: layout.baselineOffsetPx,
    linePitchPx: layout.linePitchPx,
  };
}
