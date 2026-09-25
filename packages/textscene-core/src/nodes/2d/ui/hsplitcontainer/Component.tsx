/**
 * `<HSplitContainer>`, the native (WebGL canvas) painter: it draws only the
 * grabber icon. `split_bar_background` (`default_theme.cpp:1275-1277`) is empty,
 * and `shared/splitContainerSolver.ts`'s `ContainerLayoutFn` places the children.
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

export function HSplitContainer({ solveNode, tint, rect, theme, renderOrder, meta }: NativeControlComponentProps) {
  const props = painterView<SplitContainerProperties>(solveNode);

  // `_resort` hides each dragger below two valid children (`split_container.cpp:714-724`),
  // before `dragger_visibility`/`autohide` apply.
  // Decided before the icon hook: `autohide` defaults true, and the hook order is
  // fixed, so this is what spares the common scene an image decode and a GPU texture.
  const sortable = solveNode.children.filter(isSortableControl);
  const drawsGrabber =
    sortable.length >= 2 && isSplitGrabberVisible(props, solveNode.constants, theme.widgets.splitContainer);
  const themeKey = splitGrabberThemeKey(solveNode.node.type, false);
  const texture = useNodeIcon(drawsGrabber ? solveNode.icons[themeKey] : undefined, drawsGrabber ? SPLIT_CONTAINER_ICONS.hsplitter : null);

  if (!drawsGrabber || !texture) {
    return null;
  }

  const iconSize = splitGrabberIconSize(solveNode.node.type, false, solveNode.textureSlots);
  // `grabberExtent` takes the icon's width, as `separationOf` in
  // `shared/splitContainerSolver.ts` does, so the icon lands on the solved boundary.
  const separation = resolveSplitSeparation(props, solveNode.constants, {
    ...theme.widgets.splitContainer,
    grabberExtent: iconSize.x,
  });
  // The solver hands over `computed_split_offset`, built from each child's full
  // `combined_minimum_size`, through a channel opened by reference. The fallback
  // reads only `custom_minimum_size`, but the layout always seals a boundary, and
  // only the grabber, hidden unless `autohide` is `0`, could land wrong.
  const cached = splitContainerBoundaryChannel.open(meta)?.draggerPositions;
  const draggerPositions =
    cached ??
    computeSplitDraggerPositions(
      rect.w,
      separation,
      sortable.map((c) => axisChildFromCustomMinimumSize(c, false)),
      splitOffsetsOf(props),
      props.collapsed === true,
      solveNode.rtl
    );

  return (
    <>
      {draggerPositions.map((draggerPos, i) => {
        const iconRect = splitGrabberIconRect(
          false,
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
