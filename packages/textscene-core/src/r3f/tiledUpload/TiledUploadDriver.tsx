/**
 * Mounted once inside each `<Canvas>`: it owns the canvas's tiled upload queue,
 * provides it to the consumers below, and advances it every frame.
 */

import { useMemo, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TiledUploadContext } from './TiledUploadContext';
import { TiledUploadQueue } from './TiledUploadQueue';

/**
 * Upload time a frame may spend, half of a 60 Hz frame. The other half stays for
 * the render, so a frame with bands in it still makes its vsync.
 */
export const FRAME_UPLOAD_BUDGET_MS = 8;

export function TiledUploadDriver({ children }: { children: ReactNode }) {
  const renderer = useThree((state) => state.gl);
  const queue = useMemo(() => new TiledUploadQueue(renderer), [renderer]);
  useFrame(() => queue.tick(FRAME_UPLOAD_BUDGET_MS));
  return <TiledUploadContext.Provider value={queue}>{children}</TiledUploadContext.Provider>;
}
