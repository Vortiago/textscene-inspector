/**
 * Mounted once inside each `<Canvas>`: it owns the canvas's tiled upload queue,
 * provides it to the consumers below, and advances it every frame at the pace the
 * GPU keeps up with (`gpuPacer.ts`).
 */

import { useEffect, useMemo, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TiledUploadContext } from './TiledUploadContext';
import { TiledUploadQueue } from './TiledUploadQueue';
import { GpuPacer } from './gpuPacer';
import { webglFence } from './webglFence';
import { webglUploadRenderer } from './webglUploadRenderer';

/**
 * Upload time a frame may spend, half of a 60 Hz frame. The other half stays for
 * the render, so a frame with bands in it still makes its vsync.
 */
export const FRAME_UPLOAD_BUDGET_MS = 8;

export function TiledUploadDriver({ children }: { children: ReactNode }) {
  const renderer = useThree((state) => state.gl);
  const pacer = useMemo(
    () => new GpuPacer(() => webglFence(renderer.getContext() as WebGL2RenderingContext)),
    [renderer]
  );
  const queue = useMemo(
    () => new TiledUploadQueue(webglUploadRenderer(renderer), undefined, pacer),
    [renderer, pacer]
  );
  useEffect(() => () => pacer.dispose(), [pacer]);
  useFrame(() => queue.tick(FRAME_UPLOAD_BUDGET_MS));
  return <TiledUploadContext.Provider value={queue}>{children}</TiledUploadContext.Provider>;
}
