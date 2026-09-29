/**
 * One driver per `<Canvas>`: it gives the canvas's consumers a queue over that
 * canvas's renderer, and advances the queue once per frame within its budget.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useContext } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TiledUploadContext, type TiledUploads } from './TiledUploadContext';
import { FRAME_UPLOAD_BUDGET_MS, TiledUploadDriver } from './TiledUploadDriver';
import { TiledUploadQueue } from './TiledUploadQueue';

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
    expect(tick).toHaveBeenCalledWith(FRAME_UPLOAD_BUDGET_MS);
  });
});
