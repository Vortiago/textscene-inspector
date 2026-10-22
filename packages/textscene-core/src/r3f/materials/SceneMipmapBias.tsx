/**
 * Hooks the canvas scene so each render of the main view samples at the root viewport's
 * `texture_mipmap_bias`. A SubViewport pass writes its own through `renderWithMipmapBias`.
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { observeSceneCamera } from '../sceneRenderCamera.js';
import { useProjectTextureMipmapBias } from './useProjectTextureMipmapBias.js';
import { writeMainViewMipmapBias } from './godotMipmapBias.js';

/** Mounted once per canvas, for the canvas's own scene. */
export function SceneMipmapBias() {
  const scene = useThree((state) => state.scene);
  const rootBias = useProjectTextureMipmapBias();
  useEffect(() => observeSceneCamera(scene, () => writeMainViewMipmapBias(rootBias)), [scene, rootBias]);
  return null;
}
