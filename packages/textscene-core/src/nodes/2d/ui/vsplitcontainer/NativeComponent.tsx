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
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { SPLIT_CONTAINER_ICONS } from '../../../../r3f/controls/native/themeIcons';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { useCanvasItemTint, WHITE_MODULATE, type RGBA } from '../../../../r3f/canvasItemModulate';
import { useProjectSettings } from '../../../../r3f/contexts/ProjectSettingsContext';
import { hasFlag, isSortableControl, SIZE_EXPAND, SIZE_FILL } from '../shared/fitChildInRect';
import {
  computeSplitDraggerPosition,
  isSplitGrabberVisible,
  resolveSplitSeparation,
  splitGrabberIconRect,
  type SplitAxisChild,
} from '../shared/splitContainerSolver';
import type { SplitContainerProperties } from '../shared/splitContainer';
import type { ControlProperties } from '../control/types';

/** `vsplitter.svg`'s own authored size (`native/themeIcons.ts`) — 48px across the split axis, 8px along it. */
const ICON_SIZE = { x: 48, y: 8 };

const DEFAULT_SIZE_FLAGS = SIZE_FILL;
const DEFAULT_STRETCH_RATIO = 1;

/** A sortable child's split-axis inputs, read from its OWN `custom_minimum_size` — see `hsplitcontainer/NativeComponent.tsx`'s module doc for why that (not the full combined minimum) is what a Native painter can reach. */
function axisChildFromCustomMinimumSize(node: SolveNode, vertical: boolean): SplitAxisChild {
  const props = node.node.properties as ControlProperties;
  const minSize = (vertical ? props.customMinimumSize?.y : props.customMinimumSize?.x) ?? 0;
  const flags = (vertical ? props.sizeFlagsVertical : props.sizeFlagsHorizontal) ?? DEFAULT_SIZE_FLAGS;
  const stretchRatio = props.sizeFlagsStretchRatio ?? DEFAULT_STRETCH_RATIO;
  return { minSize, expands: hasFlag(flags, SIZE_EXPAND) && stretchRatio > 0, stretchRatio };
}

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

export function VSplitContainerNative({ solveNode, rect, renderOrder }: NativeControlComponentProps) {
  const props = solveNode.node.properties as SplitContainerProperties;
  const { themeScale } = useProjectSettings();
  const theme = useMemo(() => nativeTheme(themeScale), [themeScale]);

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
