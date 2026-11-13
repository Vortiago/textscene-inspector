/**
 * `Separator::get_minimum_size` (`scene/gui/separator.cpp:33-41`), shared by `HSeparator` and
 * `VSeparator`: each subclass constructor fixes `orientation`, which is never serialised.
 */

import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import { requiredThemeItem } from '../../../../r3f/controls/native/themeItems';
import type { SeparatorOrientation } from './orientation';
import type { Vector2 } from '../../../../godot/math/vector';

/**
 * `Size2 ms(3, 3)` with the cross axis replaced by the `separation` constant (`separator.cpp:34-39`).
 * The `3` is a bare C++ literal, never scaled.
 */
export function separatorMinimumSize(orientation: SeparatorOrientation): MinimumSizeFn {
  return (n): Vector2 => {
    const separation = requiredThemeItem(n.constants, 'separation');
    return orientation === 'vertical' ? { x: separation, y: 3 } : { x: 3, y: separation };
  };
}
