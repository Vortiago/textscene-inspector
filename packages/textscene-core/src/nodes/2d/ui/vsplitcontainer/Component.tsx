/**
 * `<VSplitContainer>`: the native (WebGL canvas) painter, `hsplitcontainer/Component.tsx` (read
 * its doc first, including the sealed-boundary channel) at `vertical = true`. It reads
 * `sizeFlagsVertical`/`customMinimumSize.y` for the split axis and draws the `vsplitter` icon
 * (48px along the container's width, 8px along the split axis).
 */
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterView } from '../../../../r3f/controls/native/solveTree';
import { PositionedIcon } from '../../../../r3f/controls/native/PositionedIcon';
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

export function VSplitContainer({
  solveNode,
  childTint,
  rect,
  theme,
  renderOrder,
  meta,
}: NativeControlComponentProps) {
  const props = painterView<SplitContainerProperties>(solveNode);

  // Decided before the icon hook: hook order is fixed, so an early return cannot skip the load.
  // `autohide` defaults true, so the grabber is invisible in the common scene, and loading it
  // would decode an image and hold a GPU texture for a quad that never draws.
  const sortable = solveNode.children.filter(isSortableControl);
  const drawsGrabber = sortable.length >= 2 && isSplitGrabberVisible(props, solveNode.constants);
  const themeKey = splitGrabberThemeKey(solveNode.node.type, true);
  const texture = useNodeIcon(
    drawsGrabber ? solveNode.icons[themeKey] : undefined,
    drawsGrabber ? SPLIT_CONTAINER_ICONS.vsplitter : null
  );

  if (!drawsGrabber || !texture) {
    return null;
  }

  const iconSize = splitGrabberIconSize(solveNode.node.type, true, solveNode.textureSlots, theme.scale);
  const separation = resolveSplitSeparation(props, solveNode.constants, iconSize.y);
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
          <PositionedIcon
            key={i}
            rect={iconRect}
            texture={texture}
            color={childTint.color}
            opacity={childTint.opacity}
            renderOrder={renderOrder}
            canvasKey={renderOrder}
          />
        );
      })}
    </>
  );
}
