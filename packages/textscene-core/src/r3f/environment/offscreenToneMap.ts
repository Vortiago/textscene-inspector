/**
 * A SubViewport's tonemap pass (`toneMapPass.ts`), mounted in the world the viewport draws, with the
 * camera, the exposure and the Environment the pass draws that world through.
 */

import { useLayoutEffect, useMemo, type MutableRefObject } from 'react';
import { useToneMapPass, type ToneMapPass, type ToneMapPassOptions } from './toneMapPass';
import { usePassToneMap } from './passToneMap';
import type { Environment } from './sceneEnvironment';
import { useOptionalExposureFactor, usePassCameraPath } from './worldExposure';

export interface OffscreenToneMap extends ToneMapPass {
  /** The path of the camera the pass draws through, null for none. */
  cameraPath: string | null;
  /** The exposure factor the pass draws its world at, null for none. */
  exposure: number | null;
  /** The Environment the pass draws its world with (`drawWith`). */
  environment: Environment | null;
}

type OffscreenToneMapOptions = ToneMapPassOptions & { target: NonNullable<ToneMapPassOptions['target']> };

/**
 * Mounts the world buffer and the tonemap pass of one offscreen viewport in the world it sits in,
 * and hands them to `stage` while it stays mounted. A pass in a portal of its own world mounts it
 * inside the portal. It reads the camera, the exposure and the auto exposure of the attributes around
 * it (`ViewportPassAttributes`), and the Environment the pass draws with (`ViewportPassEnvironment`).
 *
 * @canonical Godot's tonemap pass into a render target
 */
export function OffscreenToneMapStage({
  stage,
  ...options
}: OffscreenToneMapOptions & { stage: MutableRefObject<OffscreenToneMap | null> }): null {
  const toneMap = useOffscreenToneMap(options);
  useLayoutEffect(() => {
    stage.current = toneMap;
    return () => {
      if (stage.current === toneMap) stage.current = null;
    };
  }, [stage, toneMap]);
  return null;
}

function useOffscreenToneMap(options: OffscreenToneMapOptions): OffscreenToneMap {
  const pass = useToneMapPass(options);
  const exposure = useOptionalExposureFactor();
  const cameraPath = usePassCameraPath();
  const environment = usePassToneMap().settings;
  return useMemo(
    () => ({ ...pass, cameraPath, exposure, environment }),
    [pass, cameraPath, exposure, environment]
  );
}
