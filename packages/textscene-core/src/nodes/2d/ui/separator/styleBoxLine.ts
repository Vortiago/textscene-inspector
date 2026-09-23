/**
 * `Separator`'s orientation and default-theme StyleBoxLine. The generic `StyleBoxLineData` parse
 * is `native/styleBoxLine.ts`, since any Control's stylebox slot can name a StyleBoxLine.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { StyleBoxLineData } from '../../../../r3f/controls/native/styleBoxLine';
import type { ControlColor } from '../control/types';
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';

export type SeparatorOrientation = 'horizontal' | 'vertical';

/** `style_separator_color` (`default_theme.cpp:124`): `Color(0.5, 0.5, 0.5)`. */
const DEFAULT_SEPARATOR_LINE_COLOR: ControlColor = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

/**
 * The default `separator` StyleBoxLine (`default_theme.cpp:734-740,1063-1064`): `separator_horizontal`
 * and its `duplicate()` `separator_vertical` (`set_vertical(true)`, transposed margins). The
 * along-axis margin is `default_margin` (`default_theme.cpp:31`), the one `Math.round(4 * scale)`
 * that `fill_default_theme` computes and `ScaledGodotTheme.contentMargin` also reads.
 */
export function defaultSeparatorStyleBoxLine(
  orientation: SeparatorOrientation,
  theme: NativeTheme
): StyleBoxLineData {
  const margin = theme.contentMargin;
  const vertical = orientation === 'vertical';
  return {
    color: DEFAULT_SEPARATOR_LINE_COLOR,
    // `set_thickness(Math::round(scale))` (`default_theme.cpp:735`): `ScaledGodotTheme.scale` is
    // the raw, unrounded project scale.
    thickness: Math.round(theme.scale),
    vertical,
    growBegin: 1,
    growEnd: 1,
    margin: vertical
      ? { left: 0, top: margin, right: 0, bottom: margin }
      : { left: margin, top: 0, right: margin, bottom: 0 },
  };
}
