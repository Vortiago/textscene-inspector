/**
 * `SeparatorChrome`: the shared painter for `HSeparator`/`VSeparator`, parameterised by orientation.
 * Both run one draw (`Separator::_notification(NOTIFICATION_DRAW)`, `scene/gui/separator.cpp:43-60`),
 * and each subclass constructor fixes `orientation` (`separator.cpp:71-73`) with no `ADD_PROPERTY`,
 * so a `.tscn` can never set it.
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
  // `buildSolveTree.ts` resolves every StyleBox subtype into this one slot. Without an override,
  // the default StyleBoxLine is wrapped into the same shape (`styleBoxLineBox`).
  const override = solveNode.styleBoxes.separator;
  const box: ResolvedStyleBox = useMemo(
    () => override ?? styleBoxLineBox(defaultSeparatorStyleBoxLine(orientation, theme)),
    [override, orientation, theme]
  );
  // The rect Separator hands `style->draw()` (`separator.cpp:47-56`), centred on the cross axis by
  // the box's margin. `<StyleBoxQuad>` then applies the kind's own transform (`styleBoxLineDrawRect`).
  const placed = useMemo(() => separatorPlacementRect(orientation, rect, box), [orientation, rect, box]);

  // `<StyleBoxQuad>` reads only its `rect` size, so this group applies `placed`'s offset. Three reads
  // a mesh's canvas place from its nearest group (`canvasPaintOrder.ts`), the inner one, and this
  // `renderOrder` stays in step so no ancestor disagrees. `tint` composes into the box's colours in
  // sRGB before `<StyleBoxQuad>`'s one sRGB-to-linear conversion.
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
