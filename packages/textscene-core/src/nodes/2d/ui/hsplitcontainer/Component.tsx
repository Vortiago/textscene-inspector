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
 * landed, which is a **solve handoff** channel
 * (`shared/splitContainerSolver.ts`'s `splitContainerBoundaryChannel`): the
 * EXACT `computed_split_offset` the registered `ContainerLayoutFn` computed
 * from each sortable child's full recursive `combined_minimum_size`, which
 * no painter can reach. Opening it compares the channel by reference, so a
 * value of the right shape from anywhere else does not pass.
 *
 * Falls back to recomputing via the SAME `computeSplitDraggerPosition` the
 * solver calls, fed by each sortable child's OWN `custom_minimum_size`
 * rather than the full `combined_minimum_size`, only when no sealed boundary
 * arrives — which in a real solve never happens, since the layout seals one
 * unconditionally. That gap is real but bounded, and today invisible
 * everywhere: `isSplitGrabberVisible` is false for every scene that does not
 * override `theme_override_constants/autohide` to `0` (its own doc —
 * verified against `pnpm ref:godot` on a probe scene: the gap between every
 * row's two ColorRects reads back the plain backdrop colour, never the
 * grabber's gray). So the only pixels the FALLBACK could ever mis-place are
 * the (already invisible by default) icon's own — the two ACTUAL child
 * rects are always exact regardless, computed by the registered solver with
 * full `combined_minimum_size` access.
 *
 * Tint: the walker's `tint` prop — `self_modulate` already folded onto the
 * inherited `modulate`.
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

  // `_resort` hides every dragger outright below two valid children
  // (`split_container.cpp:714-724`), before `dragger_visibility`/`autohide`
  // are ever consulted — mirrored here rather than only in the layout, since
  // this painter has no rect to draw an icon between otherwise.
  //
  // Decided BEFORE the icon hook, not after: hook order is fixed, so an early
  // return cannot skip the load. `autohide` defaults true, which makes the
  // grabber invisible in the common scene — decoding its image and holding a
  // GPU texture for a quad that never draws.
  const sortable = solveNode.children.filter(isSortableControl);
  const drawsGrabber =
    sortable.length >= 2 && isSplitGrabberVisible(props, solveNode.constants, theme.widgets.splitContainer);
  const themeKey = splitGrabberThemeKey(solveNode.node.type, false);
  const texture = useNodeIcon(drawsGrabber ? solveNode.icons[themeKey] : undefined, drawsGrabber ? SPLIT_CONTAINER_ICONS.hsplitter : null);

  if (!drawsGrabber || !texture) {
    return null;
  }

  const iconSize = splitGrabberIconSize(solveNode.node.type, false, solveNode.textureSlots);
  // `grabberExtent` overridden with the (possibly themed) icon's own width —
  // the SAME override `shared/splitContainerSolver.ts`'s `separationOf` makes
  // for the registered solver, so the drawn icon lands exactly on the
  // boundary the layout actually computed.
  const separation = resolveSplitSeparation(props, solveNode.constants, {
    ...theme.widgets.splitContainer,
    grabberExtent: iconSize.x,
  });
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
