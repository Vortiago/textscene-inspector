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
 * subtype. `buildSolveTree.ts`'s `styleBoxes` map only ever resolves
 * `StyleBoxFlat`/`StyleBoxEmpty` (`native/parseStyleBox.ts`), so:
 *  - a `StyleBoxFlat`/`StyleBoxEmpty` override reaches `solveNode.styleBoxes.
 *    separator` and wins, drawn as a plain `<StyleBoxQuad>` across the node's
 *    whole rect (an `Empty` one already draws nothing there — no vertices).
 *  - a `StyleBoxLine` override — the type the default theme itself uses — is
 *    absent from that map, so it is resolved HERE instead, from
 *    `solveNode.resources` (never `useSceneResources()`: a node reached
 *    through an instanced sub-scene names ids from THAT scene's pool).
 *  - neither resolves: the default theme's own `separator` StyleBoxLine
 *    (`styleBoxLine.ts`'s `defaultSeparatorStyleBoxLine`).
 *
 * Tint: the walker's `tint` prop, multiplied into the StyleBoxLine's `color`
 * in sRGB before the single sRGB→linear conversion — the one-colour shortcut
 * `ColorRect` uses, valid here because a StyleBoxLine (unlike a StyleBoxFlat)
 * carries only one base colour.
 */
import { useMemo } from 'react';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import type { ControlProperties } from '../control/types';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { StyleBoxQuad } from '../../../../r3f/controls/native/StyleBoxQuad';
import { multiplyModulate } from '../../../../r3f/canvasItemModulate';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import {
  parseStyleBoxLine,
  defaultSeparatorStyleBoxLine,
  type SeparatorOrientation,
} from './styleBoxLine';
import { separatorLineDrawRect } from './styleBoxLineGeometry';

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
  const flatOverride = solveNode.styleBoxes.separator;
  const lineRef = painterView<ControlProperties>(solveNode).themeOverrideStyles?.separator;

  const lineBox = useMemo(
    () =>
      parseStyleBoxLine(lineRef, solveNode.resources.internalResources) ??
      defaultSeparatorStyleBoxLine(orientation, theme),
    [lineRef, solveNode.resources, orientation, theme]
  );
  const filled = useMemo(() => multiplyModulate(tint.own, lineBox.color), [tint.own, lineBox]);
  const color = useGodotLinearColor(filled);
  const draw = useMemo(
    () => separatorLineDrawRect(orientation, rect, lineBox),
    [orientation, rect, lineBox]
  );

  if (flatOverride) {
    return <StyleBoxQuad styleBox={flatOverride} color={tint.own} rect={rect} renderOrder={renderOrder} />;
  }

  return (
    <group position={[draw.x, -draw.y, 0]} renderOrder={renderOrder}>
      <ControlQuad width={draw.w} height={draw.h} color={color} opacity={filled.a} renderOrder={renderOrder} />
    </group>
  );
}
