/**
 * `<HSplitContainer>` — the native (WebGL canvas) painter for
 * HSplitContainer. A SplitContainer draws no chrome of its own beyond the
 * grabber icon: `split_bar_background` (`default_theme.cpp:1275-1277`) is an
 * EMPTY stylebox that draws nothing, and the split boundary itself is pure
 * layout — produced by `shared/splitContainerSolver.ts`'s `ContainerLayoutFn`,
 * not drawn here. `ControlCanvasWalker` positions the two children as
 * siblings at the rects that function already computed; this component only
 * ever draws the (usually invisible — see below) icon between them.
 *
 * The icon's own position depends on where the two children's boundary
 * landed. This reads `meta` (`ContainerLayoutResult.meta`, from this type's
 * registered `ContainerLayoutFn` — `shared/splitContainerSolver.ts`'s
 * `makeSplitContainerLayout`, `SplitContainerLayoutMeta`) — the EXACT
 * `computed_split_offset` the solver already computed from each sortable
 * child's full recursive `combined_minimum_size`, not a recomputation from a
 * narrower subset of the inputs.
 *
 * Falls back to recomputing via the SAME `computeSplitDraggerPosition` the
 * solver calls, fed by each sortable child's OWN `custom_minimum_size`
 * rather than the full `combined_minimum_size`, ONLY when `meta` is not a
 * usable `SplitContainerLayoutMeta` (a hand-built test props object). That
 * gap is real but bounded, and today invisible everywhere:
 * `isSplitGrabberVisible` is false for every scene that does not override
 * `theme_override_constants/autohide` to `0` (its own doc — verified against
 * `pnpm ref:godot` on `unit-split-container.tscn`: the gap between every
 * row's two ColorRects reads back the plain backdrop colour, never the
 * grabber's gray). So the only pixels the FALLBACK could ever mis-place are
 * the (already invisible by default) icon's own — the two ACTUAL child
 * rects are always exact regardless, computed by the registered solver with
 * full `combined_minimum_size` access.
 *
 * Tint follows `ColorRect`/`TextureRect`'s rule: `modulate` is
 * already folded into the ambient `Modulate2DContext` by the walker, so this
 * calls `useCanvasItemTint` with `modulate: WHITE_MODULATE` and only this
 * node's own `self_modulate`.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { SPLIT_CONTAINER_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useIconTexture } from '../../../../r3f/controls/native/useIconTexture';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import { isSortableControl } from '../shared/fitChildInRect';
import {
  axisChildFromCustomMinimumSize,
  computeSplitDraggerPosition,
  isSplitContainerLayoutMeta,
  isSplitGrabberVisible,
  resolveSplitSeparation,
  splitGrabberIconRect,
} from '../shared/splitContainerSolver';
import type { SplitContainerProperties } from '../shared/splitContainer';

/** `hsplitter.svg`'s own authored size (`native/themeIcons.ts`) — 8px along the split axis, 48px across it. */
const ICON_SIZE = { x: 8, y: 48 };

export function HSplitContainer({ solveNode, rect, theme, renderOrder, meta }: NativeControlComponentProps) {
  const props = solveNode.node.properties as SplitContainerProperties;

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });
  const texture = useIconTexture(SPLIT_CONTAINER_ICONS.hsplitter);

  // `_resort` hides every dragger outright below two valid children
  // (`split_container.cpp:714-724`), before `dragger_visibility`/`autohide`
  // are ever consulted — mirrored here rather than only in the layout, since
  // this painter has no rect to draw an icon between otherwise.
  const sortable = solveNode.children.filter(isSortableControl).slice(0, 2);
  if (sortable.length !== 2 || !isSplitGrabberVisible(props, theme.widgets.splitContainer)) {
    return null;
  }

  const separation = resolveSplitSeparation(props, theme.widgets.splitContainer);
  const [first, second] = sortable as [SolveNode, SolveNode];
  const cachedDraggerPos = isSplitContainerLayoutMeta(meta) ? meta.draggerPos : undefined;
  const draggerPos =
    cachedDraggerPos ??
    computeSplitDraggerPosition(
      rect.w,
      separation,
      axisChildFromCustomMinimumSize(first, false),
      axisChildFromCustomMinimumSize(second, false),
      props.splitOffset ?? 0,
      props.collapsed === true
    );
  const iconRect = splitGrabberIconRect(false, { width: rect.w, height: rect.h }, draggerPos, separation, ICON_SIZE);

  return (
    <group position={[iconRect.x, -iconRect.y, 0]}>
      <ControlQuad
        renderOrder={renderOrder}
        width={iconRect.w}
        height={iconRect.h}
        color={tint.color}
        opacity={tint.opacity}
        map={texture}
      />
    </group>
  );
}
