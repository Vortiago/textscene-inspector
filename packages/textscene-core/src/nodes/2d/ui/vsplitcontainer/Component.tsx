/**
 * `<VSplitContainer>` — the native (WebGL canvas) painter for
 * VSplitContainer. Identical reasoning to `hsplitcontainer/Component.tsx`
 * (read its module doc first, including the sealed-boundary channel) at
 * `vertical = true`: reads `sizeFlagsVertical`/`customMinimumSize.y` for the
 * split axis, and draws the `vsplitter` icon (48px along the container's
 * width, 8px along the split axis) instead of `hsplitter`.
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { SPLIT_CONTAINER_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { useNodeIcon } from '../../../../r3f/controls/native/useIconTexture';
import { isSortableControl } from '../shared/fitChildInRect';
import {
  axisChildFromCustomMinimumSize,
  computeSplitDraggerPositions,
  splitContainerBoundaryChannel,
  isSplitGrabberVisible,
  resolveSplitSeparation,
  splitGrabberIconRect,
  splitGrabberIconSize,
  splitGrabberThemeKey,
} from '../shared/splitContainerSolver';
import { splitOffsetsOf, type SplitContainerProperties } from '../shared/splitContainer';

export function VSplitContainer({ solveNode, tint, rect, theme, renderOrder, meta }: NativeControlComponentProps) {
  const props = painterView<SplitContainerProperties>(solveNode);

  // Decided BEFORE the icon hook, not after: hook order is fixed, so an early
  // return cannot skip the load. `autohide` defaults true, which makes the
  // grabber invisible in the common scene — decoding its image and holding a
  // GPU texture for a quad that never draws.
  const sortable = solveNode.children.filter(isSortableControl);
  const drawsGrabber =
    sortable.length >= 2 && isSplitGrabberVisible(props, solveNode.constants, theme.widgets.splitContainer);
  const themeKey = splitGrabberThemeKey(solveNode.node.type, true);
  const texture = useNodeIcon(drawsGrabber ? solveNode.icons[themeKey] : undefined, drawsGrabber ? SPLIT_CONTAINER_ICONS.vsplitter : null);

  if (!drawsGrabber || !texture) {
    return null;
  }

  const iconSize = splitGrabberIconSize(solveNode.node.type, true, solveNode.textureSlots);
  const separation = resolveSplitSeparation(props, solveNode.constants, {
    ...theme.widgets.splitContainer,
    grabberExtent: iconSize.y,
  });
  const cached = splitContainerBoundaryChannel.open(meta)?.draggerPositions;
  const draggerPositions =
    cached ??
    computeSplitDraggerPositions(
      rect.h,
      separation,
      sortable.map((c) => axisChildFromCustomMinimumSize(c, true)),
      splitOffsetsOf(props),
      props.collapsed === true,
      false
    );

  return (
    <>
      {draggerPositions.map((draggerPos, i) => {
        const iconRect = splitGrabberIconRect(
          true,
          { width: rect.w, height: rect.h },
          draggerPos,
          separation,
          iconSize
        );
        return (
          <CanvasItemGroup key={i} position={[iconRect.x, -iconRect.y, 0]} renderOrder={renderOrder}>
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
      })}
    </>
  );
}
