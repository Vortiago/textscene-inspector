import { describe, expect, it } from 'vitest';
import { startCameraGesture } from './cameraGestures.mjs';

/** A page whose in-page script answers `isStarted`, as the driver does once it finds its element. */
const pageAnswering = (isStarted) => ({ evaluate: async () => isStarted });

describe('startCameraGesture', () => {
  it('starts a gesture whose element is on the page', async () => {
    expect(await startCameraGesture(pageAnswering(true), 'pan-2d')).toBeNull();
  });

  it('names the element it did not find', async () => {
    expect(await startCameraGesture(pageAnswering(false), 'orbit-3d')).toBe(
      'expected canvas to drive orbit-3d, found none'
    );
  });

  it('throws on a gesture it does not know (edge case)', async () => {
    await expect(startCameraGesture(pageAnswering(true), 'spin-2d')).rejects.toThrow(
      'expected one of pan-2d, zoom-2d, orbit-3d, pan-3d, zoom-3d, freelook-3d, got "spin-2d"'
    );
  });
});
