/**
 * The buffer of a composite CanvasGroup and the composite material that samples it, each held until
 * the group unmounts.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { CanvasColorSpace } from '../canvasColorSpace';
import { createCanvasFrame } from '../components/Canvas2DStage/canvasFrame';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { createCompositeMaterial } from './compositeMaterial';

type CanvasFrame = ReturnType<typeof createCanvasFrame>;

/** The group's buffer in the canvas's colour space, and the composite material that samples it. */
export function useCompositeBuffer(space: CanvasColorSpace): {
  buffer: CanvasFrame;
  compositeMaterial: THREE.ShaderMaterial;
} {
  const buffer = useMemo(() => createCanvasFrame(space), [space]);
  useDisposeOnRelease(buffer);
  const compositeMaterial = useMemo(() => createCompositeMaterial(buffer.texture), [buffer]);
  useDisposeOnRelease(compositeMaterial);
  return { buffer, compositeMaterial };
}
