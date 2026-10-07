/**
 * Expected values come from `light_update_directional_shadow`
 * (`servers/rendering/renderer_rd/renderer_canvas_render_rd.cpp:1132-1209`) and the occluder cull
 * in `renderer_viewport.cpp:563-640`, worked by hand for a square view.
 */

import { describe, it, expect } from 'vitest';
import { SHADOW_MAP_BINS, SHADOW_MAP_FAR } from './shadowPolarMap';
import { buildDirectionalShadowMap, type DirectionalShadowView, type Quad2 } from './directionalShadowMap';
import {
  OCCLUDER_CULL_DISABLED,
  OCCLUDER_CULL_CLOCKWISE,
  OCCLUDER_CULL_COUNTER_CLOCKWISE,
  type OccluderCullMode,
  type ShadowCasterEdges,
} from './shadowVolumes';

/**
 * A 1000 px square view, the light travelling straight down (previewer -Y). The centre is
 * (500, 500) and the half extent along the light 500, so with no `max_distance` the map starts
 * at the top edge (500, 1000), runs 1000 deep, and spans the 1414.2 px diagonal across.
 */
const SQUARE: Quad2 = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];

/** The camera shows the viewport exactly, unless a test says otherwise. */
function squareView(
  maxDistance = 0,
  direction = { x: 0, y: -1 },
  screen: Quad2 = SQUARE
): DirectionalShadowView {
  return { clip: SQUARE, screen, direction, maxDistance };
}

function segment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cullMode: OccluderCullMode = OCCLUDER_CULL_DISABLED
): ShadowCasterEdges {
  return { segments: [ax, ay, bx, by], cullMode };
}

/** The bin whose centre the across coordinate `x` of `squareView` lands in. */
function binAt(x: number): number {
  return Math.floor((0.5 + (x - 500) / (1000 * Math.SQRT2)) * SHADOW_MAP_BINS);
}

describe('buildDirectionalShadowMap: the projection', () => {
  it('stores depth from the map origin over z_far, the band one view deep', () => {
    // An edge 400 px below the top edge: depth 400 of a 1000 px z_far.
    const { bins } = buildDirectionalShadowMap(squareView(), [segment(400, 600, 600, 600)]);
    expect(bins[binAt(500)]).toBeCloseTo(0.4, 6);
  });

  it('spans the view diagonal across, so a 200 px edge fills 200 / 1414.2 of the bins', () => {
    const { bins } = buildDirectionalShadowMap(squareView(), [segment(400, 600, 600, 600)]);
    // u(400) = 0.5 - 100 / 1414.21 = 0.42929, so bin 879 (centre 879.5) is the first covered.
    expect(bins[878]).toBe(SHADOW_MAP_FAR);
    expect(bins[879]).toBeCloseTo(0.4, 6);
    expect(bins[1168]).toBeCloseTo(0.4, 6);
    expect(bins[1169]).toBe(SHADOW_MAP_FAR);
  });

  it('starts the band max_distance upstream of the view and deepens z_far by it', () => {
    // from = centre - dir * (500 + 1000) = (500, 2000), z_far = 2 * 500 + 1000 = 2000.
    const { bins } = buildDirectionalShadowMap(squareView(1000), [segment(400, 600, 600, 600)]);
    expect(bins[binAt(500)]).toBeCloseTo(1400 / 2000, 6);
  });

  it('keeps the nearest edge where two cover one bin', () => {
    const { bins } = buildDirectionalShadowMap(squareView(), [
      segment(400, 300, 600, 300),
      segment(400, 600, 600, 600),
    ]);
    expect(bins[binAt(500)]).toBeCloseTo(0.4, 6);
  });

  it('interpolates depth along a slanted edge', () => {
    // Depth runs 0.2 at x = 400 to 0.6 at x = 600, so 0.4 at the centre.
    const { bins } = buildDirectionalShadowMap(squareView(), [segment(400, 800, 600, 400)]);
    expect(bins[binAt(500)]).toBeCloseTo(0.4, 2);
  });

  it('clips geometry upstream of the map origin, as the orthographic near plane does', () => {
    const { bins } = buildDirectionalShadowMap(squareView(1000), [segment(400, 2100, 600, 2100)]);
    expect(bins[binAt(500)]).toBe(SHADOW_MAP_FAR);
  });

  it('maps a quad position in NDC to (u, depth) through the returned transform', () => {
    // NDC (0, 0.2) is world (500, 600) in the square view: the centre column, 400 px deep.
    const { ndcToShadow } = buildDirectionalShadowMap(squareView(), []);
    const [m00, m01, m02, m10, m11, m12] = ndcToShadow;
    expect(m00 * 0 + m01 * 0.2 + m02).toBeCloseTo(0.5, 12);
    expect(m10 * 0 + m11 * 0.2 + m12).toBeCloseTo(0.4, 12);
  });

  it('spans the viewport, not what the camera shows, which only moves the NDC lookup', () => {
    // A camera showing x -1000..2000: NDC 0 is still world x 500, the viewport's centre column.
    const wide: Quad2 = [
      { x: -1000, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: 1000 },
      { x: -1000, y: 1000 },
    ];
    const { bins, ndcToShadow } = buildDirectionalShadowMap(squareView(0, { x: 0, y: -1 }, wide), [
      segment(400, 600, 600, 600),
    ]);
    expect(bins[879]).toBeCloseTo(0.4, 6);
    expect(bins[1168]).toBeCloseTo(0.4, 6);
    // NDC x 1 is world x 2000, 1500 px right of the centre over the 1414.2 px diagonal.
    expect(ndcToShadow[0] + ndcToShadow[2]).toBeCloseTo(0.5 + 1500 / (1000 * Math.SQRT2), 12);
  });

  it('rotates with the light: a light travelling +X measures depth from the left edge', () => {
    const view = squareView(0, { x: 1, y: 0 });
    const { bins, ndcToShadow } = buildDirectionalShadowMap(view, [segment(300, 400, 300, 600)]);
    // World (300, 500) is NDC (-0.4, 0).
    const u = ndcToShadow[0] * -0.4 + ndcToShadow[2];
    expect(ndcToShadow[3] * -0.4 + ndcToShadow[5]).toBeCloseTo(0.3, 12);
    expect(bins[Math.floor(u * SHADOW_MAP_BINS)]).toBeCloseTo(0.3, 6);
  });
});

describe('buildDirectionalShadowMap: the occluder cull', () => {
  it('drops an occluder further upstream than max_distance', () => {
    const { bins } = buildDirectionalShadowMap(squareView(100), [segment(400, 1200, 600, 1200)]);
    expect(bins[binAt(500)]).toBe(SHADOW_MAP_FAR);
  });

  it('keeps an occluder within max_distance upstream of the view', () => {
    // from = (500, 1600), z_far 1600: depth 400 / 1600.
    const { bins } = buildDirectionalShadowMap(squareView(600), [segment(400, 1200, 600, 1200)]);
    expect(bins[binAt(500)]).toBeCloseTo(0.25, 6);
  });

  it('drops an occluder beside the view, outside the swept band', () => {
    const { bins } = buildDirectionalShadowMap(squareView(10000), [segment(1100, 600, 1300, 600)]);
    expect(bins.every((depth) => depth === SHADOW_MAP_FAR)).toBe(true);
  });
});

/**
 * Measured on Godot 4.6.3 with a light travelling down the screen over a clockwise (on screen)
 * square: under CULL_CLOCKWISE its inside is lit, so only the far edge casts, and under
 * CULL_COUNTER_CLOCKWISE its inside is shadowed. A PointLight2D takes the opposite pair.
 */
describe('buildDirectionalShadowMap: cull_mode', () => {
  // The previewer's Y-up form of that square: its top edge runs +X, its bottom edge -X.
  const top = (cullMode: OccluderCullMode) => segment(400, 600, 600, 600, cullMode);
  const bottom = (cullMode: OccluderCullMode) => segment(600, 400, 400, 400, cullMode);

  it('casts from the far edge alone under CULL_CLOCKWISE', () => {
    const { bins } = buildDirectionalShadowMap(squareView(), [
      top(OCCLUDER_CULL_CLOCKWISE),
      bottom(OCCLUDER_CULL_CLOCKWISE),
    ]);
    expect(bins[binAt(500)]).toBeCloseTo(0.6, 6);
  });

  it('casts from the near edge under CULL_COUNTER_CLOCKWISE', () => {
    const { bins } = buildDirectionalShadowMap(squareView(), [
      top(OCCLUDER_CULL_COUNTER_CLOCKWISE),
      bottom(OCCLUDER_CULL_COUNTER_CLOCKWISE),
    ]);
    expect(bins[binAt(500)]).toBeCloseTo(0.4, 6);
  });

  it('ignores an edge parallel to the light', () => {
    const { bins } = buildDirectionalShadowMap(squareView(), [segment(500, 300, 500, 700)]);
    expect(bins.every((depth) => depth === SHADOW_MAP_FAR)).toBe(true);
  });
});
