/**
 * `<VSplitContainerNative>` — the native (WebGL canvas) painter for
 * VSplitContainer. Identical reasoning to `hsplitcontainer/NativeComponent.tsx`
 * (read its module doc first) at `vertical = true`: reads `sizeFlagsVertical`/
 * `customMinimumSize.y` for the split axis, and draws the `vsplitter` icon
 * (48px along the container's width, 8px along the split axis) instead of
 * `hsplitter`.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { NativeControlComponentProps } from '../../../../r3f/controls/ControlComponentRegistry';
import { ControlQuad } from '../../../../r3f/controls/native/controlQuad';
import { SPLIT_CONTAINER_ICONS } from '../../../../r3f/controls/native/themeIcons';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import { isSortableControl } from '../shared/fitChildInRect';
import {
  axisChildFromCustomMinimumSize,
  computeSplitDraggerPosition,
  isSplitGrabberVisible,
  resolveSplitSeparation,
  splitGrabberIconRect,
} from '../shared/splitContainerSolver';
import type { SplitContainerProperties } from '../shared/splitContainer';

/** `vsplitter.svg`'s own authored size (`native/themeIcons.ts`) — 48px across the split axis, 8px along it. */
const ICON_SIZE = { x: 48, y: 8 };

/** A stable `THREE.Texture` handle for a vendored `data:` SVG icon — see `hsplitcontainer/NativeComponent.tsx`'s identical helper for why nothing here gates on load completion. */
function useIconTexture(dataUrl: string): THREE.Texture {
  const texture = useMemo(() => {
    const tex = new THREE.TextureLoader().load(dataUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [dataUrl]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

export function VSplitContainerNative({ solveNode, rect, theme, renderOrder }: NativeControlComponentProps) {
  const props = solveNode.node.properties as SplitContainerProperties;

  const selfModulate: RGBA = props.selfModulate ?? WHITE_MODULATE;
  const tint = useCanvasItemTint({ modulate: WHITE_MODULATE, self_modulate: selfModulate });
  const texture = useIconTexture(SPLIT_CONTAINER_ICONS.vsplitter);

  const sortable = solveNode.children.filter(isSortableControl).slice(0, 2);
  if (sortable.length !== 2 || !isSplitGrabberVisible(props, theme.widgets.splitContainer)) {
    return null;
  }

  const separation = resolveSplitSeparation(props, theme.widgets.splitContainer);
  const [first, second] = sortable as [SolveNode, SolveNode];
  const draggerPos = computeSplitDraggerPosition(
    rect.h,
    separation,
    axisChildFromCustomMinimumSize(first, true),
    axisChildFromCustomMinimumSize(second, true),
    props.splitOffset ?? 0,
    props.collapsed === true
  );
  const iconRect = splitGrabberIconRect(true, { width: rect.w, height: rect.h }, draggerPos, separation, ICON_SIZE);

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
