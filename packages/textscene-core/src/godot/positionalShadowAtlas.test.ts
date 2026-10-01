import { describe, expect, it } from 'vitest';
import {
  POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT,
  POSITIONAL_SHADOW_REALLOC_TOLERANCE_MSEC,
  PositionalShadowAtlas,
  ROOT_POSITIONAL_SHADOW_ATLAS,
  VIEWPORT_POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT,
  omniShadowCubeSize,
  omniShadowKernelAngle,
  positionalShadowQuadrantSubdivision,
  viewportPositionalShadowAtlas,
  type PositionalShadowRequest,
} from './positionalShadowAtlas';

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
const loneSlot = (coverage: number) => rootAfter([spot('lamp', coverage)]).slotSize('lamp');

const names = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${i}`);

describe('viewportPositionalShadowAtlas', () => {
  it('reads the authored size and quadrant subdivisions', () => {
    expect(viewportPositionalShadowAtlas(4096, [1, 2, 3, 6])).toEqual({
      size: 4096,
      quadrantShadows: [1, 4, 16, 1024],
    });
  });

  it('keeps the Viewport defaults where the scene authors nothing (edge case)', () => {
    expect(viewportPositionalShadowAtlas(undefined, [])).toEqual({
      size: VIEWPORT_POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT,
      quadrantShadows: [4, 4, 16, 64],
    });
  });

  it('keeps the default for a value the setter refuses (error case)', () => {
    expect(viewportPositionalShadowAtlas(-1, [7, -1, 2.5, undefined])).toEqual({
      size: VIEWPORT_POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT,
      quadrantShadows: [4, 4, 16, 64],
    });
  });
});

describe('positionalShadowQuadrantSubdivision', () => {
  it('takes the square root of a count that is a power of four', () => {
    expect(positionalShadowQuadrantSubdivision(4)).toBe(2);
    expect(positionalShadowQuadrantSubdivision(64)).toBe(8);
  });

  it('rounds a count up to a power of four first (edge case)', () => {
    expect(positionalShadowQuadrantSubdivision(5)).toBe(4);
    expect(positionalShadowQuadrantSubdivision(2)).toBe(2);
  });

  it('leaves a quadrant of no shadows unused (error case)', () => {
    expect(positionalShadowQuadrantSubdivision(0)).toBe(0);
  });
});

describe('PositionalShadowAtlas, one light', () => {
  it('gives a light that fills the screen the largest slot, a quarter of the atlas side', () => {
    expect(loneSlot(1)).toBe(POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT / 4);
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
    expect(atlas.slotSize('lamp')).toBeNull();
  });

  it('gives no slot to a light that never asked (edge case)', () => {
    expect(rootAfter([]).slotSize('lamp')).toBeNull();
  });
});

describe('PositionalShadowAtlas, a full quadrant', () => {
  it('moves the ninth spot light to a smaller slot, in the order the lights ask', () => {
    const lights = names('spot', 9);
    const atlas = rootAfter(lights.map((name) => spot(name)));
    expect(lights.slice(0, 8).map((name) => atlas.slotSize(name))).toEqual(Array(8).fill(1024));
    expect(atlas.slotSize('spot8')).toBe(512);
  });

  it('gives an omni light two slots, so the fifth omni light takes a smaller slot', () => {
    const lights = names('omni', 5);
    const atlas = rootAfter(lights.map((name) => omni(name)));
    expect(lights.slice(0, 4).map((name) => atlas.slotSize(name))).toEqual(Array(4).fill(1024));
    expect(atlas.slotSize('omni4')).toBe(512);
  });

  it('fills the 1024 quadrants with omni pairs before a spot light can take one (edge case)', () => {
    const atlas = rootAfter([...names('omni', 4).map((name) => omni(name)), spot('spot')]);
    expect(atlas.slotSize('spot')).toBe(512);
  });

  it('gives a light no slot once every quadrant that holds it is full (error case)', () => {
    const atlas = new PositionalShadowAtlas<string>({ size: 4096, quadrantShadows: [1, 0, 0, 0] });
    atlas.allocate([spot('first'), spot('second')], 0);
    expect(atlas.slotSize('first')).toBe(2048);
    expect(atlas.slotSize('second')).toBeNull();
  });

  it('never gives an omni light the last slot of a quadrant alone (edge case)', () => {
    const atlas = new PositionalShadowAtlas<string>({ size: 4096, quadrantShadows: [1, 0, 0, 0] });
    atlas.allocate([omni('lamp')], 0);
    expect(atlas.slotSize('lamp')).toBeNull();
  });

  it('keeps the slots from render to render while the scene holds still', () => {
    const requests = names('spot', 9).map((name) => spot(name));
    const atlas = rootAfter(requests);
    atlas.allocate(requests, POSITIONAL_SHADOW_REALLOC_TOLERANCE_MSEC * 10);
    expect(atlas.slotSize('spot0')).toBe(1024);
    expect(atlas.slotSize('spot8')).toBe(512);
  });
});

describe('PositionalShadowAtlas, reallocation', () => {
  const later = POSITIONAL_SHADOW_REALLOC_TOLERANCE_MSEC + 1;

  it('moves a light up into the slot of a light the render no longer sees, once both are old enough', () => {
    const atlas = rootAfter(names('spot', 9).map((name) => spot(name)));
    atlas.allocate(
      names('spot', 9)
        .filter((name) => name !== 'spot0')
        .map((name) => spot(name)),
      later
    );
    expect(atlas.slotSize('spot8')).toBe(1024);
    expect(atlas.slotSize('spot0')).toBeNull();
  });

  it('keeps a light in its slot within the tolerance (edge case)', () => {
    const atlas = rootAfter(names('spot', 9).map((name) => spot(name)));
    atlas.allocate(
      names('spot', 9)
        .filter((name) => name !== 'spot0')
        .map((name) => spot(name)),
      POSITIONAL_SHADOW_REALLOC_TOLERANCE_MSEC
    );
    expect(atlas.slotSize('spot8')).toBe(512);
    expect(atlas.slotSize('spot0')).toBe(1024);
  });

  it('moves a light whose coverage shrank to a smaller slot once the tolerance passes', () => {
    const atlas = rootAfter([spot('lamp', 1)]);
    atlas.allocate([spot('lamp', 0.1)], later);
    expect(atlas.slotSize('lamp')).toBe(256);
  });

  it('frees a released light’s slot for the next light (edge case)', () => {
    const lights = names('spot', 9).map((name) => spot(name));
    const atlas = rootAfter(lights.slice(0, 8));
    atlas.release('spot0');
    atlas.allocate(lights.slice(1), 0);
    expect(atlas.slotSize('spot8')).toBe(1024);
    expect(atlas.ownersHoldingSlots()).not.toContain('spot0');
  });

  it('takes nothing from a light seen in the same render, however old its slot (error case)', () => {
    const lights = names('spot', 9).map((name) => spot(name));
    const atlas = rootAfter(lights);
    atlas.allocate(lights, later);
    expect(atlas.slotSize('spot8')).toBe(512);
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

describe('omniShadowKernelAngle', () => {
  it('spreads the default soft shadow scale over the inset paraboloid of the largest slot', () => {
    expect(omniShadowKernelAngle(2, 1024)).toBeCloseTo(4 / 1022, 12);
  });

  it('widens as the slot shrinks', () => {
    expect(omniShadowKernelAngle(2, 256)).toBeGreaterThan(omniShadowKernelAngle(2, 1024) * 4);
  });

  it('is zero for a light with no blur (edge case)', () => {
    expect(omniShadowKernelAngle(0, 1024)).toBe(0);
  });

  it('passes a non-finite scale through (error case)', () => {
    expect(omniShadowKernelAngle(Number.NaN, 1024)).toBeNaN();
  });
});
