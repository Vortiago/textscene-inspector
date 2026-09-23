/**
 * `Separator::get_minimum_size` (`scene/gui/separator.cpp:33-41`), shared by `HSeparator` and
 * `VSeparator`: each subclass constructor fixes `orientation`, which is never serialised.
 */

import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { SeparatorOrientation } from './styleBoxLine';

/**
 * `Size2 ms(3, 3)` with the cross axis replaced by the `separation` constant (`separator.cpp:34-39`).
 * The `3` is a bare C++ literal, never scaled. `theme.separation` is `Math.round(4 * scale)`, the
 * formula `default_theme.cpp` uses for the separators' own `separation` (`default_theme.cpp:1068-1069`),
 * a distinct constant that shares BoxContainer's literal `4`.
 */
export function separatorMinimumSize(orientation: SeparatorOrientation): MinimumSizeFn {
  return (n, ctx): Vec2 => {
    const separation = n.constants.separation ?? ctx.theme.separation;
    return orientation === 'vertical' ? { x: separation, y: 3 } : { x: 3, y: separation };
  };
}
