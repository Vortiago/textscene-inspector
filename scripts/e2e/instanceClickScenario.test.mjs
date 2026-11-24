import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import {
  checkInstanceClick,
  LISTED_ROWS,
  LOCKED_PICK,
  OPEN_PICK,
  redBoxCentres,
} from './instanceClickScenario.mjs';

/** A 10x4 PNG, black but for the red pixels at `points`. */
function pngWithRedAt(points) {
  const png = new PNG({ width: 10, height: 4 });
  png.data.fill(0);
  for (const [x, y] of points) png.data.set([255, 0, 0, 255], (y * 10 + x) * 4);
  return PNG.sync.write(png);
}

describe('redBoxCentres', () => {
  it('gives the centre of the red pixels on each side of their span', () => {
    const centres = redBoxCentres(
      pngWithRedAt([
        [0, 0],
        [2, 2],
        [7, 1],
        [9, 3],
      ])
    );

    expect(centres).toEqual({ left: { x: 1, y: 1 }, right: { x: 8, y: 2 } });
  });

  it('gives null for an image with no red pixel', () => {
    expect(redBoxCentres(pngWithRedAt([]))).toBeNull();
  });
});

const CENTRES = { left: { x: 1, y: 1 }, right: { x: 8, y: 2 } };

function failuresOf(run) {
  const gate = fakeGate();
  checkInstanceClick(gate, { centres: CENTRES, rows: LISTED_ROWS, diagnostics: CLEAN_LOAD, ...run });
  return gate.failures;
}

describe('checkInstanceClick', () => {
  it('passes the instance for a locked instance and the mesh for an editable one', () => {
    expect(failuresOf({ onLocked: [LOCKED_PICK], onOpen: [OPEN_PICK] })).toEqual([]);
  });

  it('fails a click on a locked instance that selects the mesh inside it', () => {
    expect(failuresOf({ onLocked: ['Root/Locked/Mesh'], onOpen: [OPEN_PICK] })).toEqual([
      "[instance click] a click on the locked instance's mesh selects [Root/Locked/Mesh], expected [Root/Locked]",
    ]);
  });

  it('fails a click on an editable instance that selects the instance', () => {
    expect(failuresOf({ onLocked: [LOCKED_PICK], onOpen: ['Root/Open'] })).toEqual([
      "[instance click] a click on the editable instance's mesh selects [Root/Open], expected [Root/Open/Mesh]",
    ]);
  });

  it('fails a tree that lists the inside of the locked instance', () => {
    const rows = ['Root', 'Root/Locked', 'Root/Locked/Mesh', 'Root/Open', 'Root/Open/Mesh'];

    expect(failuresOf({ onLocked: [LOCKED_PICK], onOpen: [OPEN_PICK], rows })).toEqual([
      '[instance click] the scene tree lists [Root, Root/Locked, Root/Locked/Mesh, Root/Open, Root/Open/Mesh], ' +
        'expected [Root, Root/Locked, Root/Open, Root/Open/Mesh] (missing: [], extra: [Root/Locked/Mesh])',
    ]);
  });

  it('fails a view that draws no box', () => {
    expect(failuresOf({ centres: null })).toEqual([
      '[instance click] the view draws no red box, so no click was made',
    ]);
  });
});
