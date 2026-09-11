/**
 * `SeparatorChrome` — shared painter for `HSeparator`/`VSeparator`, one
 * component parameterised by orientation because both are literally the same
 * draw (`Separator::_notification(NOTIFICATION_DRAW)`,
 * `scene/gui/separator.cpp:43-60`): `Separator::orientation` is fixed by
 * each subclass's constructor (`separator.cpp:71-73`), not a serialised
 * property — it has no `ADD_PROPERTY` call at all, so a `.tscn` can never set
 * it. Wrapped by `hseparator/Component.tsx`/`vseparator/Component.tsx`,
 * mirroring `PanelChrome`'s shared-chrome shape.
 *
 * A `theme_override_styles/separator` StyleBox slot accepts any StyleBox
 * subtype, and `buildSolveTree.ts`'s `resolveStyleBoxes` now resolves all
 * four (`native/parseStyleBox.ts`'s `ResolvedStyleBox`) into
 * `solveNode.styleBoxes.separator` — so this painter reads that ONE slot for
 * every kind, never resolving a StyleBoxLine override itself. Absent an
 * override, `separator`'s own default theme StyleBoxLine
 * (`styleBoxLine.ts`'s `defaultSeparatorStyleBoxLine`) is wrapped into the
 * same shape (`styleBoxLineBox`) so both paths feed `<StyleBoxQuad>`
 * identically.
 *
 * `separatorPlacementRect` (`separator.cpp:47-56`) is what Separator hands
 * `style->draw()` — a sub-rect centred on the CROSS axis by the resolved
 * box's own margin, whatever kind it is — and `<StyleBoxQuad>` then applies
 * whichever kind's OWN further draw transform on top (a StyleBoxLine's own
 * grow/thicken, `native/styleBoxLineGeometry.ts`'s `styleBoxLineDrawRect`).
 *
 * Tint: the walker's `tint` prop, handed straight to `<StyleBoxQuad>`'s
 * `color` prop — that component composes it into whichever kind's own base
 * colour(s), in sRGB, before its single sRGB→linear conversion.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { styleBoxLineBox, type ResolvedStyleBox } from '../../../../r3f/controls/native/parseStyleBox';
import { defaultSeparatorStyleBoxLine, type SeparatorOrientation } from './styleBoxLine';
import { separatorPlacementRect } from './separatorPlacement';

export interface SeparatorChromeProps extends NativeControlComponentProps {
  orientation: SeparatorOrientation;
}

export function SeparatorChrome({
  orientation,
  solveNode,
  tint,
  rect,
  theme,
  renderOrder,
}: SeparatorChromeProps) {
  const override = solveNode.styleBoxes.separator;
  const box: ResolvedStyleBox = useMemo(
    () => override ?? styleBoxLineBox(defaultSeparatorStyleBoxLine(orientation, theme)),
    [override, orientation, theme]
  );
  const placed = useMemo(() => separatorPlacementRect(orientation, rect, box), [orientation, rect, box]);

  // `<StyleBoxQuad>` reads only its `rect` prop's SIZE, never its x/y (every
  // other caller draws at its own local (0,0)) — so `placed`'s own offset is
  // applied here, the same way this painter's DEFAULT-theme path always has,
  // and `<StyleBoxQuad>` gets a zero-origin box the same size as `placed`.
  // `renderOrder` is set here too, matching `<StyleBoxQuad>`'s own inner
  // group — three reads a drawn mesh's place in the canvas from its NEAREST
  // enclosing group's `renderOrder` (`canvasPaintOrder.ts`), which is that
  // inner one, not this one; kept in step anyway so this group is never the
  // stray ancestor a future refactor trusts by mistake.
  return (
    <group position={[placed.x, -placed.y, 0]} renderOrder={renderOrder}>
      <StyleBoxQuad
        styleBox={box}
        color={tint.own}
        rect={{ x: 0, y: 0, w: placed.w, h: placed.h }}
        renderOrder={renderOrder}
      />
    </group>
  );
}
