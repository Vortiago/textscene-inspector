import { describe, expect, it } from 'vitest';
import { statusFailures } from './statusFailures.mjs';

const SETTLED = { scriptedNodeCount: 0, hasCurrentCamera: false };

const PASSING = {
  statusSettled: SETTLED,
  settled: SETTLED,
  undrawn: [{ path: '/root/Root/Sign', meshTypes: ['FutureMesh'], isEmptyShape: false }],
  heardTextureBuild: true,
  settledAfterWrite: [null, SETTLED],
  idleCalls: 0,
  fps: 30,
  plain: { objects: 3, primitives: 4248, hasTimings: false },
  shadowed: { objects: 19, primitives: 4248, hasTimings: false },
};

describe('statusFailures', () => {
  it('finds nothing wrong with results that meet every check', () => {
    expect(statusFailures(PASSING)).toEqual([]);
  });

  it('names a status whose settled differs from the settled promise', () => {
    expect(statusFailures({ ...PASSING, statusSettled: null })[0]).toMatch(
      /^status: status\(\)\.settled once settled/
    );
  });

  it('names an undrawn list that misses the node', () => {
    expect(statusFailures({ ...PASSING, undrawn: [] })[0]).toMatch(/^status: status\(\)\.undrawn: expected/);
  });

  it('names a host that never heard the texture build', () => {
    expect(statusFailures({ ...PASSING, heardTextureBuild: false })).toEqual([
      'status: onStatusChange: expected a call that counts the NoiseTexture2D build, got none',
    ]);
  });

  it('names a write the host never heard turn the view pending', () => {
    expect(statusFailures({ ...PASSING, settledAfterWrite: [SETTLED] })[0]).toMatch(
      /^status: onStatusChange after a write: expected pending, then settled/
    );
  });

  it('names a call for each frame window', () => {
    expect(statusFailures({ ...PASSING, idleCalls: 4 })[0]).toMatch(
      /^status: onStatusChange calls of an idle view/
    );
  });

  it('names a view that measured no frame', () => {
    expect(statusFailures({ ...PASSING, fps: null })).toEqual([
      'status: status().frame: expected an FPS over 0, got null',
    ]);
  });

  it("names a counted scene whose numbers differ from Godot's monitor", () => {
    expect(statusFailures({ ...PASSING, plain: { ...PASSING.plain, objects: 4 } })[0]).toMatch(
      /^status: status\(\)\.frame of the counted scene: expected/
    );
  });

  it('names timings in a window of a view without show.performance', () => {
    expect(statusFailures({ ...PASSING, plain: { ...PASSING.plain, hasTimings: true } })).toHaveLength(1);
  });

  it('names shadow draws that the objects leave out', () => {
    expect(statusFailures({ ...PASSING, shadowed: { ...PASSING.shadowed, objects: 3 } })).toEqual([
      'status: objects with shadows: expected more than the 3 without, got 3',
    ]);
  });
});
