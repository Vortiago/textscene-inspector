import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { TscnNode } from '../../parser/types.js';
import type { SubViewportProperties } from '../../nodes/viewport/subviewport/types.js';
import { CanvasItemTextureFilter } from '../../godot/scene/canvasItem.js';
import type { ViewSampler } from '../../resources/textures/textureView.js';
import { canvasItemFilterState } from '../canvasItemTextureSampler.js';
import { useViewportTexture } from '../contexts/ViewportTextureContext.js';
import { ROOT_VIEWPORT_PATH } from '../contexts/EnclosingViewportContext.js';
import { useTextureView } from '../useTextureView.js';
import { presentRootTarget } from './presentRootTarget.js';
import type { RootWindow } from './rootWindow.js';

/** A priority of its own takes the frame from R3F's own render, after every viewport pass. */
const PRESENT_PRIORITY = 1;

/** The screen blit's sampler (`rasterizer_gles3.cpp:440`, `renderer_compositor_rd.cpp:160`). */
const BLIT_FILTER = canvasItemFilterState(CanvasItemTextureFilter.NEAREST);

/**
 * Shows the target the root viewport's pass publishes in `window`, fitted to the pane, and keeps
 * it sampled so the pass renders.
 */
export function RootViewportPresenter({ root, window }: { root: TscnNode; window: RootWindow }) {
  const entry = useViewportTexture(ROOT_VIEWPORT_PATH);
  useEffect(() => entry?.plain.retain(), [entry]);
  const target = entry?.plain.texture ?? null;
  const texture = useTextureView(target, useBlitSampler(target, window));
  const { transparent_bg: isTransparent } = root.properties as SubViewportProperties;
  useFrame(({ gl }) => {
    presentRootTarget(gl, texture, window, isTransparent);
  }, PRESENT_PRIORITY);
  return null;
}

/**
 * The blit's nearest filter where the window scales the target, else none. Unscaled, nearest and
 * the target's own filter read the same texels, so a 1:1 window keeps the target and copies nothing.
 */
function useBlitSampler(target: THREE.Texture | null, window: RootWindow): ViewSampler | null {
  const { targetSize, drawRect } = window;
  const scalesTarget = drawRect.w !== targetSize.x || drawRect.h !== targetSize.y;
  // The target's own space: the view reads the bytes the window shows as the target does.
  const colorSpace = (target?.colorSpace ?? THREE.NoColorSpace) as THREE.ColorSpace;
  return useMemo(
    () => (scalesTarget ? { colorSpace, filter: BLIT_FILTER, wrap: THREE.ClampToEdgeWrapping } : null),
    [scalesTarget, colorSpace]
  );
}
