import { useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import type { TscnNode } from '../../parser/types.js';
import type { SubViewportProperties } from '../../nodes/viewport/subviewport/types.js';
import { useViewportTexture } from '../contexts/ViewportTextureContext.js';
import { ROOT_VIEWPORT_PATH } from './rootViewportNode.js';
import { presentRootTarget } from './presentRootTarget.js';

/** A priority of its own takes the frame from R3F's own render, after every viewport pass. */
const PRESENT_PRIORITY = 1;

/** Shows the target the root viewport's pass publishes, and keeps it sampled so the pass renders. */
export function RootViewportPresenter({ root }: { root: TscnNode }) {
  const entry = useViewportTexture(ROOT_VIEWPORT_PATH);
  useEffect(() => entry?.plain.retain(), [entry]);
  const { size, transparent_bg: isTransparent } = root.properties as SubViewportProperties;
  useFrame(({ gl }) => {
    presentRootTarget(gl, entry?.plain.texture ?? null, entry?.size ?? size, isTransparent);
  }, PRESENT_PRIORITY);
  return null;
}
