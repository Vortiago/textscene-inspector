/**
 * `<SplitContainer>`: the native painter for the base `SplitContainer` type. It follows
 * `hsplitcontainer/Component.tsx`, sealed-boundary channel included, but reads `vertical` from the
 * node, not the type. `tint` is the walker's, `self_modulate` folded onto `modulate`.
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
import { splitOffsetsOf } from '../shared/splitContainer';
import type { SplitContainerProperties } from './types';

/** `SplitContainer::vertical` (`split_container.h:96`). Godot default `false`. */
function verticalOf(props: SplitContainerProperties): boolean {
  return props.vertical ?? false;
}

export function SplitContainer({ solveNode, tint, rect, theme, renderOrder, meta }: NativeControlComponentProps) {
  const props = painterView<SplitContainerProperties>(solveNode);
  const vertical = verticalOf(props);

  // `_resort` hides every dragger below two valid children (`split_container.cpp:714-724`), before
  // `dragger_visibility` or `autohide` is read. The painter checks it too, since it has no rect
  // to draw an icon between otherwise.
  const sortable = solveNode.children.filter(isSortableControl);
  const drawsGrabber =
    sortable.length >= 2 && isSplitGrabberVisible(props, solveNode.constants, theme.widgets.splitContainer);
  const icon = vertical ? SPLIT_CONTAINER_ICONS.vsplitter : SPLIT_CONTAINER_ICONS.hsplitter;
  const themeKey = splitGrabberThemeKey(solveNode.node.type, vertical);
  const texture = useNodeIcon(drawsGrabber ? solveNode.icons[themeKey] : undefined, drawsGrabber ? icon : null);

  if (!drawsGrabber || !texture) {
    return null;
  }

  const iconSize = splitGrabberIconSize(solveNode.node.type, vertical, solveNode.textureSlots);
  const separation = resolveSplitSeparation(props, solveNode.constants, {
    ...theme.widgets.splitContainer,
    grabberExtent: vertical ? iconSize.y : iconSize.x,
  });
  const cached = splitContainerBoundaryChannel.open(meta)?.draggerPositions;
  const draggerPositions =
    cached ??
    computeSplitDraggerPositions(
      vertical ? rect.h : rect.w,
      separation,
      sortable.map((c) => axisChildFromCustomMinimumSize(c, vertical)),
      splitOffsetsOf(props),
      props.collapsed === true,
      solveNode.rtl && !vertical
    );

  return (
    <>
      {draggerPositions.map((draggerPos, i) => {
        const iconRect = splitGrabberIconRect(
          vertical,
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
