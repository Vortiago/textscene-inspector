/**
 * `Separator::get_minimum_size` (`scene/gui/separator.cpp:33-41`), shared by
 * `HSeparator`/`VSeparator` and parameterised by orientation exactly like
 * `Component.tsx`'s `SeparatorChrome` — `Separator::orientation` is fixed per
 * subclass constructor, never a serialised property (see that module's own
 * doc for the `ADD_PROPERTY` check).
 */

import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { MinimumSizeFn } from '../../../../r3f/controls/native/solverRegistry';
import type { SeparatorOrientation } from './styleBoxLine';

/**
 * `Size2 ms(3, 3)`, with the CROSS axis replaced by the `separation` theme
 * constant (`separator.cpp:34-39`). The `3` is a bare C++ literal, never
 * routed through the theme scale.
 *
 * `theme.separation` is `Math.round(4 * scale)` (`godotDefaultTheme.ts`'s
 * `ScaledGodotTheme.separation`) — the SAME formula `default_theme.cpp:
 * 1068-1069` computes for `HSeparator`/`VSeparator`'s own `separation`
 * (also `Math.round(4 * scale)`), a distinct theme constant that happens to
 * share BoxContainer's literal `4`.
 */
export function separatorMinimumSize(orientation: SeparatorOrientation): MinimumSizeFn {
  return (n, ctx): Vec2 => {
    const separation = n.constants.separation ?? ctx.theme.separation;
    return orientation === 'vertical' ? { x: separation, y: 3 } : { x: 3, y: separation };
  };
}
