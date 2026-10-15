/**
 * One driver per `<Canvas>`: it gives the canvas's consumers a queue over that
 * canvas's renderer, and advances the queue once per frame within its budget, at
 * the pace the GPU keeps up with.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useContext } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TiledUploadContext, type TiledUploads } from './TiledUploadContext';
import { TiledUploadDriver } from './TiledUploadDriver';
import { TiledUploadQueue } from './TiledUploadQueue';
import { GpuPacer } from './gpuPacer';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TiledUploadDriver', () => {
  it('gives the canvas a tiled upload queue', async () => {
    const seen: (TiledUploads | null)[] = [];
    function Probe(): null {
      seen.push(useContext(TiledUploadContext));
      return null;
    }
    await ReactThreeTestRenderer.create(
      <TiledUploadDriver>
        <Probe />
      </TiledUploadDriver>
    );

    expect(seen.at(-1)).toBeInstanceOf(TiledUploadQueue);
  });

  it('advances the queue once per frame, within the frame budget', async () => {
    const tick = vi.spyOn(TiledUploadQueue.prototype, 'tick');
    const renderer = await ReactThreeTestRenderer.create(<TiledUploadDriver>{null}</TiledUploadDriver>);
    tick.mockClear();
    await renderer.advanceFrames(3, 16);

    expect(tick).toHaveBeenCalledTimes(3);
    // Half of a 60 Hz frame, so a frame with bands in it still makes its vsync.
    expect(tick).toHaveBeenCalledWith(8);
  });

  it('paces the queue to the GPU', async () => {
    const allowance = vi.spyOn(GpuPacer.prototype, 'allowance');
    let queue: TiledUploads | null = null;
    function Probe(): null {
      queue = useContext(TiledUploadContext);
      return null;
    }
    const renderer = await ReactThreeTestRenderer.create(
      <TiledUploadDriver>
        <Probe />
      </TiledUploadDriver>
    );
    // One band more than the window, so the second frame still has rows to ask for.
    // The pacer keeps 4 bands of 128 rows on their way to the GPU at once.
    const rows = 128 * (4 + 1);
    queue!.enqueue(new THREE.DataTexture(new Uint8Array(4096 * rows * 4), 4096, rows));
    await renderer.advanceFrames(2, 16);

    expect(allowance).toHaveBeenCalledTimes(2);
  });

  it('releases its GPU fences when the canvas unmounts', async () => {
    const dispose = vi.spyOn(GpuPacer.prototype, 'dispose');
    const renderer = await ReactThreeTestRenderer.create(<TiledUploadDriver>{null}</TiledUploadDriver>);
    await renderer.unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
