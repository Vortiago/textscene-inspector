import { describe, expect, it } from 'vitest';
import { cameraFailures, REFUSED_MESSAGE } from './cameraFailures.mjs';

const PASSING = {
  overFromGameView: { 'Rig/Front': 0, Above: 0 },
  changedBetweenCameras: 9000,
  changedFromFreshEditor: 0,
  refused: REFUSED_MESSAGE,
};

const failuresOf = (results) => cameraFailures({ results: { ...PASSING, ...results }, errors: [] });

describe('cameraFailures', () => {
  it('passes a view that drew what the game draws through each camera', () => {
    expect(failuresOf({})).toEqual([]);
  });

  it('fails a view whose picture through a camera is not the game’s', () => {
    expect(failuresOf({ overFromGameView: { 'Rig/Front': 600, Above: 1200 } })).toHaveLength(1);
  });

  it('fails a view that did not move to the new camera', () => {
    expect(failuresOf({ changedBetweenCameras: 0 })).toEqual([
      'camera: a new camera: expected at least 2000 changed pixels, got 0',
    ]);
  });

  it('fails a null that left the editor camera off its start orbit', () => {
    expect(failuresOf({ changedFromFreshEditor: 300 })).toEqual([
      'camera: null: expected the frame of a fresh 3D mount, got 300 changed pixels',
    ]);
  });

  it('fails an update that took a MeshInstance3D', () => {
    expect(failuresOf({ refused: null })).toEqual([
      `camera: a MeshInstance3D: expected "${REFUSED_MESSAGE}", got null`,
    ]);
  });
});
