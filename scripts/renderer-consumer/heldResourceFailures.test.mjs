import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { heldResourceFailures } from './heldResourceFailures.mjs';

function pngOf(rgba) {
  const png = new PNG({ width: 2, height: 2 });
  for (let at = 0; at < png.data.length; at += 4) png.data.set(rgba, at);
  return PNG.sync.write(png).toString('base64');
}

const BLUE = pngOf([0, 0, 255, 255]);
const MAGENTA = pngOf([255, 0, 255, 255]);

const PASSING = {
  writtenSpherePng: BLUE,
  authoredSpherePng: BLUE,
  writtenMaterialPng: BLUE,
  authoredNoMeshPng: BLUE,
};

describe('heldResourceFailures', () => {
  it('passes where each write draws the frame of its file', () => {
    expect(heldResourceFailures(PASSING)).toEqual([]);
  });

  it('names a written sphere that draws another frame', () => {
    const [failure] = heldResourceFailures({ ...PASSING, writtenSpherePng: MAGENTA });
    expect(failure).toMatch(/^held resource: a write of a held sphere/);
  });

  it('names a written material that draws another frame than no mesh', () => {
    const [failure] = heldResourceFailures({ ...PASSING, writtenMaterialPng: MAGENTA });
    expect(failure).toMatch(/^held resource: a write of a held material/);
  });
});
