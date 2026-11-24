import { useCallback, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasItemTextureFilter } from '../../godot/scene/canvasItem.js';
import type { ViewSampler } from '../../resources/textures/textureView.js';
import { canvasItemFilterState } from '../canvasItemTextureSampler.js';
import { useViewportTexture } from '../contexts/ViewportTextureContext.js';
import { ROOT_VIEWPORT_PATH } from '../contexts/EnclosingViewportContext.js';
import { useTextureView } from '../useTextureView.js';
import { presentRootTarget } from './presentRootTarget.js';
import { readWindowPixels } from './windowImage.js';
import type { RgbaImage } from '../../utils/encodePng.js';
import { magnifiesTarget, type RootWindow } from './rootWindow.js';

/** A priority of its own takes the frame from R3F's own render, after every viewport pass. */
const PRESENT_PRIORITY = 1;

/** The screen blit's sampler (`rasterizer_gles3.cpp:440`, `renderer_compositor_rd.cpp:160`). */
const BLIT_FILTER = canvasItemFilterState(CanvasItemTextureFilter.NEAREST);

/** Retains the root target, so its pass renders, and draws it in the window fitted to the pane. */
export function RootViewportPresenter({
  projectWindow,
  drawnWindow,
  isTransparent,
  onPresent,
}: {
  projectWindow: RootWindow;
  drawnWindow: RootWindow;
  isTransparent: boolean;
  /** Runs after each present, with the read of the whole window at its own size. */
  onPresent: (readWindow: () => RgbaImage) => void;
}) {
  const entry = useViewportTexture(ROOT_VIEWPORT_PATH);
  useEffect(() => entry?.plain.retain(), [entry]);
  const target = entry?.plain.texture ?? null;
  const texture = useTextureView(target, useBlitSampler(target, magnifiesTarget(projectWindow, drawnWindow)));
  const gl = useThree((state) => state.gl);
  const readWindow = useCallback(
    () => readWindowPixels(gl, texture, projectWindow, isTransparent),
    [gl, texture, projectWindow, isTransparent]
  );
  useFrame(() => {
    presentRootTarget(gl, texture, projectWindow, isTransparent);
    onPresent(readWindow);
  }, PRESENT_PRIORITY);
  return null;
}

/** Nearest only where the window magnifies the target. The pane's own scale keeps the linear filter. */
function useBlitSampler(target: THREE.Texture | null, scalesTarget: boolean): ViewSampler | null {
  // The target's own space: the view reads the bytes the window shows as the target does.
  const colorSpace = (target?.colorSpace ?? THREE.NoColorSpace) as THREE.ColorSpace;
  return useMemo(
    () => (scalesTarget ? { colorSpace, filter: BLIT_FILTER, wrap: THREE.ClampToEdgeWrapping } : null),
    [scalesTarget, colorSpace]
  );
}
