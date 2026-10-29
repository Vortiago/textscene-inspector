/** An AtlasTexture's cell, cut out of a loaded sheet once, and out of a live target after each of its renders. */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resolveAtlasTexture } from './resolveAtlasTexture';
import { decodeAtlasTexture } from './decode';
import { publishLiveTargets } from '../../../r3f/liveTargets';
import { copiesFilledFrom } from '../../../r3f/liveTargets.testkit';
import { holdUntilReleased } from '../../../r3f/useDisposeOnRelease';
import { createCanvasTarget } from '../../../nodes/viewport/subviewport/offscreenViewport';

const CELL = { id: 'Cell', texture: decodeAtlasTexture({ region: 'Rect2(0, 0, 8, 4)' }) };

let withdrawals: (() => void)[] = [];
afterEach(() => {
  withdrawals.forEach((withdraw) => withdraw());
  withdrawals = [];
});

describe('resolveAtlasTexture', () => {
  it('cuts the cell out of a loaded sheet, kept by the procedural cache', () => {
    const sheet = new THREE.DataTexture(new Uint8Array(16 * 16 * 4), 16, 16);
    const resolution = resolveAtlasTexture(CELL, sheet, []);
    expect(resolution?.texture.image).toMatchObject({ width: 8, height: 4 });
    expect(resolution?.key).toEqual(expect.any(String));
  });

  it('cuts the cell out of a live target as a crop its pass refills, held by its reader', () => {
    const target = createCanvasTarget(16, 16, 'SubViewport');
    withdrawals.push(publishLiveTargets([target.texture], null, false));
    const resolution = resolveAtlasTexture(CELL, target.texture, [])!;
    withdrawals.push(holdUntilReleased(resolution.texture));
    expect([copiesFilledFrom(target.texture), resolution.key]).toEqual([[resolution.texture], null]);
  });
});
