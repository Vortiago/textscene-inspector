import { describe, expect, it } from 'vitest';
import {
  PositionalShadowAtlas,
  omniShadowCubeSize,
  type PositionalShadowRequest,
} from './positionalShadowAtlas';
import { ROOT_POSITIONAL_SHADOW_ATLAS } from '../../scene/viewport';

const spot = (owner: string, coverage = 1): PositionalShadowRequest<string> => ({
  owner,
  isOmni: false,
  coverage,
});
const omni = (owner: string, coverage = 1): PositionalShadowRequest<string> => ({
  owner,
  isOmni: true,
  coverage,
});

/** A root atlas after one render of `requests` at tick 0. */
function rootAfter(requests: PositionalShadowRequest<string>[]): PositionalShadowAtlas<string> {
  const atlas = new PositionalShadowAtlas<string>(ROOT_POSITIONAL_SHADOW_ATLAS);
  atlas.allocate(requests, 0);
  return atlas;
}

/** The slot of a lone spot light that covers `coverage` of the screen. */
const loneSlot = (coverage: number) => slotSizeOf(rootAfter([spot('lamp', coverage)]), 'lamp');

/** The side of the slot `owner` holds, or null for none. */
const slotSizeOf = (atlas: PositionalShadowAtlas<string>, owner: string) => atlas.slot(owner)?.size ?? null;

/**
 * How long a slot stays with its light before the atlas may move it
 * (`servers/rendering/renderer_rd/storage_rd/light_storage.h:383`).
 */
const REALLOC_TOLERANCE_MSEC = 500;

const names = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i}`);

describe('PositionalShadowAtlas, quadrant subdivision', () => {
  /** The slot side a lone full-screen spot light takes when the atlas's only quadrant holds `shadows`. */
  function quadrantSlot(shadows: number): number | null {
    const atlas = new PositionalShadowAtlas<string>({ size: 4096, quadrantShadows: [shadows] });
    atlas.allocate([spot('lamp')], 0);
    return slotSizeOf(atlas, 'lamp');
  }

  it('splits a quadrant into the square root of a count that is a power of four', () => {
    // A quadrant is 2048 texels: 4 shadows split it 2 by 2, 64 shadows 8 by 8.
    expect(quadrantSlot(4)).toBe(1024);
    expect(quadrantSlot(64)).toBe(256);
  });

  it('rounds a count up to a power of four first (edge case)', () => {
    // 5 rounds up to 16, split 4 by 4. 2 rounds up to 4, split 2 by 2.
    expect(quadrantSlot(5)).toBe(512);
    expect(quadrantSlot(2)).toBe(1024);
  });

  it('leaves a quadrant of no shadows unused (error case)', () => {
    expect(quadrantSlot(0)).toBeNull();
  });
});

describe('PositionalShadowAtlas, one light', () => {
  it('gives a light that fills the screen the largest slot, a quarter of the atlas side', () => {
    expect(loneSlot(1)).toBe(ROOT_POSITIONAL_SHADOW_ATLAS.size / 4);
  });

  it('gives each coverage the smallest slot that holds its rounded-up share of a quadrant', () => {
    // A quadrant is 2048 texels: 0.3 asks for 614, rounded up to 1024, 0.2 for 409, 0.1 for 204.
    expect(loneSlot(0.3)).toBe(1024);
    expect(loneSlot(0.2)).toBe(512);
    expect(loneSlot(0.1)).toBe(256);
  });

  it('truncates the ask to whole texels before it rounds up (edge case)', () => {
    // 0.25 asks for exactly 512, and 0.2501 for 512.2, truncated to 512. 0.2505 asks for 513.
    expect(loneSlot(0.25)).toBe(512);
    expect(loneSlot(0.2501)).toBe(512);
    expect(loneSlot(0.2505)).toBe(1024);
  });

  it('gives a tiny light the smallest slot, and caps a huge one at the largest (edge case)', () => {
    expect(loneSlot(0)).toBe(256);
    expect(loneSlot(40)).toBe(1024);
  });

  it('gives a non-finite or negative coverage a defined slot (error case)', () => {
    expect(loneSlot(Number.NaN)).toBe(256);
    expect(loneSlot(-1)).toBe(256);
    expect(loneSlot(Number.POSITIVE_INFINITY)).toBe(1024);
  });

  it('gives no slot in an atlas of size zero (error case)', () => {
    const atlas = new PositionalShadowAtlas<string>({ size: 0, quadrantShadows: [4, 4, 16, 64] });
    atlas.allocate([spot('lamp')], 0);
    expect(slotSizeOf(atlas, 'lamp')).toBeNull();
  });

  it('gives no slot to a light that never asked (edge case)', () => {
    expect(slotSizeOf(rootAfter([]), 'lamp')).toBeNull();
  });
});

describe('PositionalShadowAtlas, a full quadrant', () => {
  it('moves the ninth spot light to a smaller slot, in the order the lights ask', () => {
    const lights = names('spot', 9);
    const atlas = rootAfter(lights.map((name) => spot(name)));
    expect(lights.slice(0, 8).map((name) => slotSizeOf(atlas, name))).toEqual(Array(8).fill(1024));
    expect(slotSizeOf(atlas, 'spot8')).toBe(512);
  });

  it('gives an omni light two slots, so the fifth omni light takes a smaller slot', () => {
    const lights = names('omni', 5);
    const atlas = rootAfter(lights.map((name) => omni(name)));
    expect(lights.slice(0, 4).map((name) => slotSizeOf(atlas, name))).toEqual(Array(4).fill(1024));
    expect(slotSizeOf(atlas, 'omni4')).toBe(512);
  });

  it('fills the 1024 quadrants with omni pairs before a spot light can take one (edge case)', () => {
    const atlas = rootAfter([...names('omni', 4).map((name) => omni(name)), spot('spot')]);
    expect(slotSizeOf(atlas, 'spot')).toBe(512);
  });

  it('gives a light no slot once every quadrant that holds it is full (error case)', () => {
    const atlas = new PositionalShadowAtlas<string>({ size: 4096, quadrantShadows: [1, 0, 0, 0] });
    atlas.allocate([spot('first'), spot('second')], 0);
    expect(slotSizeOf(atlas, 'first')).toBe(2048);
    expect(slotSizeOf(atlas, 'second')).toBeNull();
  });

  it('never gives an omni light the last slot of a quadrant alone (edge case)', () => {
    const atlas = new PositionalShadowAtlas<string>({ size: 4096, quadrantShadows: [1, 0, 0, 0] });
    atlas.allocate([omni('lamp')], 0);
    expect(slotSizeOf(atlas, 'lamp')).toBeNull();
  });

  it('keeps the slots from render to render while the scene holds still', () => {
    const requests = names('spot', 9).map((name) => spot(name));
    const atlas = rootAfter(requests);
    atlas.allocate(requests, REALLOC_TOLERANCE_MSEC * 10);
    expect(slotSizeOf(atlas, 'spot0')).toBe(1024);
    expect(slotSizeOf(atlas, 'spot8')).toBe(512);
  });
});

describe('PositionalShadowAtlas, reallocation', () => {
  const later = REALLOC_TOLERANCE_MSEC + 1;

  it('moves a light up into the slot of a light the render no longer sees, once both are old enough', () => {
    const atlas = rootAfter(names('spot', 9).map((name) => spot(name)));
    atlas.allocate(
      names('spot', 9)
        .filter((name) => name !== 'spot0')
        .map((name) => spot(name)),
      later
    );
    expect(slotSizeOf(atlas, 'spot8')).toBe(1024);
    expect(slotSizeOf(atlas, 'spot0')).toBeNull();
  });

  it('keeps a light in its slot within the tolerance (edge case)', () => {
    const atlas = rootAfter(names('spot', 9).map((name) => spot(name)));
    atlas.allocate(
      names('spot', 9)
        .filter((name) => name !== 'spot0')
        .map((name) => spot(name)),
      REALLOC_TOLERANCE_MSEC
    );
    expect(slotSizeOf(atlas, 'spot8')).toBe(512);
    expect(slotSizeOf(atlas, 'spot0')).toBe(1024);
  });

  it('moves a light whose coverage shrank to a smaller slot once the tolerance passes', () => {
    const atlas = rootAfter([spot('lamp', 1)]);
    atlas.allocate([spot('lamp', 0.1)], later);
    expect(slotSizeOf(atlas, 'lamp')).toBe(256);
  });

  it('frees a released light’s slot for the next light (edge case)', () => {
    const lights = names('spot', 9).map((name) => spot(name));
    const atlas = rootAfter(lights.slice(0, 8));
    atlas.release('spot0');
    atlas.allocate(lights.slice(1), 0);
    expect(slotSizeOf(atlas, 'spot8')).toBe(1024);
    expect([...atlas.ownersHoldingSlots()]).not.toContain('spot0');
  });

  it('takes nothing from a light seen in the same render, however old its slot (error case)', () => {
    const lights = names('spot', 9).map((name) => spot(name));
    const atlas = rootAfter(lights);
    atlas.allocate(lights, later);
    expect(slotSizeOf(atlas, 'spot8')).toBe(512);
  });
});

describe('omniShadowCubeSize', () => {
  it('renders each cube face at half the slot', () => {
    expect(omniShadowCubeSize(1024)).toBe(512);
  });

  it('halves the smallest slot too (edge case)', () => {
    expect(omniShadowCubeSize(256)).toBe(128);
  });

  it('passes a non-finite slot through (error case)', () => {
    expect(omniShadowCubeSize(Number.NaN)).toBeNaN();
  });
});

describe('PositionalShadowAtlas.slot', () => {
  it('places a spot light’s slot in the most subdivided quadrant it fits, in texels', () => {
    // The root's third quadrant (16 shadows) sits at (0, 2048), and its fourth (64) at (2048, 2048).
    const atlas = rootAfter([spot('lamp', 0.2)]);
    expect(atlas.slot('lamp')).toEqual({ x: 0, y: 2048, size: 512, paraboloidStep: null });
  });

  it('gives an omni light its second paraboloid in the next slot along the row', () => {
    // The root takes a 1024 pair from its second quadrant first, at (2048, 0).
    const atlas = rootAfter([omni('lamp')]);
    expect(atlas.slot('lamp')).toEqual({ x: 2048, y: 0, size: 1024, paraboloidStep: [1, 0] });
  });

  it('wraps an omni light’s second paraboloid to the next row after a row’s last slot (edge case)', () => {
    const atlas = new PositionalShadowAtlas<string>({ size: 4096, quadrantShadows: [4, 0, 0, 0] });
    atlas.allocate([spot('first'), omni('lamp')], 0);
    expect(atlas.slot('lamp')).toEqual({ x: 1024, y: 0, size: 1024, paraboloidStep: [-1, 1] });
  });

  it('is null for a light without a slot (error case)', () => {
    expect(rootAfter([]).slot('lamp')).toBeNull();
  });

  it('answers with the same slot on every render while the light keeps it', () => {
    const atlas = rootAfter([spot('lamp')]);
    const held = atlas.slot('lamp');
    atlas.allocate([spot('lamp')], 1);
    expect(atlas.slot('lamp')).toBe(held);
  });

  it('lays the slot out again once the light moves (edge case)', () => {
    const atlas = rootAfter([spot('lamp', 1)]);
    const held = atlas.slot('lamp');
    atlas.allocate([spot('lamp', 0.1)], REALLOC_TOLERANCE_MSEC + 1);
    expect(atlas.slot('lamp')).not.toBe(held);
    expect(atlas.slot('lamp')?.size).toBe(256);
  });
});

describe('PositionalShadowAtlas.ownersHoldingSlots', () => {
  it('lets the caller release each light it visits', () => {
    const atlas = rootAfter(names('spot', 3).map((name) => spot(name)));
    for (const owner of atlas.ownersHoldingSlots()) atlas.release(owner);
    expect([...atlas.ownersHoldingSlots()]).toEqual([]);
    expect(atlas.slot('spot2')).toBeNull();
  });
});
