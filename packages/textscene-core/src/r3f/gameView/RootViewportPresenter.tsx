import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
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

/** Retains the root target, so its pass renders, and draws it in the window fitted to the pane. */
export function RootViewportPresenter({
  projectWindow,
  isTransparent,
}: {
  projectWindow: RootWindow;
  isTransparent: boolean;
}) {
  const entry = useViewportTexture(ROOT_VIEWPORT_PATH);
  useEffect(() => entry?.plain.retain(), [entry]);
  const target = entry?.plain.texture ?? null;
  const texture = useTextureView(target, useBlitSampler(target, projectWindow));
  useFrame(({ gl }) => {
    presentRootTarget(gl, texture, projectWindow, isTransparent);
  }, PRESENT_PRIORITY);
  return null;
}

/** Only where the window scales the target: at 1:1 nearest reads the same texels, and no copy is made. */
function useBlitSampler(target: THREE.Texture | null, projectWindow: RootWindow): ViewSampler | null {
  const { targetSize, drawRect } = projectWindow;
  const scalesTarget = drawRect.w !== targetSize.x || drawRect.h !== targetSize.y;
  // The target's own space: the view reads the bytes the window shows as the target does.
  const colorSpace = (target?.colorSpace ?? THREE.NoColorSpace) as THREE.ColorSpace;
  return useMemo(
    () => (scalesTarget ? { colorSpace, filter: BLIT_FILTER, wrap: THREE.ClampToEdgeWrapping } : null),
    [scalesTarget, colorSpace]
  );
}
