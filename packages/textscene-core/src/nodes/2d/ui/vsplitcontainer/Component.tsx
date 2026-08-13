/**
 * `<VSplitContainer>` — the native (WebGL canvas) painter for
 * VSplitContainer. Identical reasoning to `hsplitcontainer/Component.tsx`
 * (read its module doc first, including the `meta`/fallback split) at
 * `vertical = true`: reads `sizeFlagsVertical`/`customMinimumSize.y` for the
 * split axis, and draws the `vsplitter` icon (48px along the container's
 * width, 8px along the split axis) instead of `hsplitter`.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { SPLIT_CONTAINER_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useOptionalIconTexture } from '../../../../r3f/controls/native/useIconTexture';
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

/** `vsplitter.svg`'s own authored size (`native/themeIcons.ts`) — 48px across the split axis, 8px along it. */
const ICON_SIZE = { x: 48, y: 8 };

export function VSplitContainer({ solveNode, rect, theme, renderOrder, meta }: NativeControlComponentProps) {
  const props = solveNode.node.properties as SplitContainerProperties;

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });

  // Decided BEFORE the icon hook, not after: hook order is fixed, so an early
  // return cannot skip the load. `autohide` defaults true, which makes the
  // grabber invisible in the common scene — decoding its image and holding a
  // GPU texture for a quad that never draws.
  const sortable = solveNode.children.filter(isSortableControl).slice(0, 2);
  const drawsGrabber =
    sortable.length === 2 && isSplitGrabberVisible(props, theme.widgets.splitContainer);
  const texture = useOptionalIconTexture(drawsGrabber ? SPLIT_CONTAINER_ICONS.vsplitter : null);

  if (!drawsGrabber || !texture) {
    return null;
  }

  const separation = resolveSplitSeparation(props, theme.widgets.splitContainer);
  const [first, second] = sortable as [SolveNode, SolveNode];
  const cachedDraggerPos = isSplitContainerLayoutMeta(meta) ? meta.draggerPos : undefined;
  const draggerPos =
    cachedDraggerPos ??
    computeSplitDraggerPosition(
      rect.h,
      separation,
      axisChildFromCustomMinimumSize(first, true),
      axisChildFromCustomMinimumSize(second, true),
      props.splitOffset ?? 0,
      props.collapsed === true
    );
  const iconRect = splitGrabberIconRect(true, { width: rect.w, height: rect.h }, draggerPos, separation, ICON_SIZE);

  return (
    <CanvasItemGroup position={[iconRect.x, -iconRect.y, 0]}>
      <ControlQuad
        renderOrder={renderOrder}
        width={iconRect.w}
        height={iconRect.h}
        color={tint.color}
        opacity={tint.opacity}
        map={texture}
      />
    </CanvasItemGroup>
  );
}
