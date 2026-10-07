/**
 * Godot's DirectionalLight2D shadow map, a 1D depth buffer under a parallel projection, built on
 * the CPU. `light_update_directional_shadow` (`renderer_canvas_render_rd.cpp:1132-1209`) lays the
 * map across the viewport's diagonal and measures depth along the light from a line `max_distance`
 * upstream of the viewport, so it is not a special case of the polar map around a point.
 */

/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { SHADOW_MAP_BINS, SHADOW_MAP_FAR } from './shadowPolarMap';
import {
  OCCLUDER_CULL_CLOCKWISE,
  OCCLUDER_CULL_COUNTER_CLOCKWISE,
  type OccluderCullMode,
  type ShadowCasterEdges,
} from './shadowVolumes';

export interface Point2 {
  readonly x: number;
  readonly y: number;
}

/** Four corners in order around a parallelogram. */
export type Quad2 = readonly [Point2, Point2, Point2, Point2];

/** What the map is built from, all in the previewer's 2D world space (Y up). */
export interface DirectionalShadowView {
  /**
   * Godot's `clip_rect`, the game viewport's rect (`renderer_viewport.cpp:390`), which the map
   * spans and the occluder cull sweeps. It is the project viewport, not what the editor shows.
   */
  readonly clip: Quad2;
  /** What the camera shows, the corners at NDC (-1, -1), (1, -1), (1, 1) and (-1, 1). */
  readonly screen: Quad2;
  /** The unit direction the light travels: the light node's Godot +Y axis. */
  readonly direction: Point2;
  /** `DirectionalLight2D.max_distance` in world units: how far upstream an occluder still casts. */
  readonly maxDistance: number;
}

export interface DirectionalShadowMap {
  /** `SHADOW_MAP_BINS` depths over `z_far`, `SHADOW_MAP_FAR` where nothing casts. */
  readonly bins: Float32Array;
  /**
   * A full-screen quad's NDC position to `(u, depth)`, as a row-major 2×3 affine: `u` addresses
   * `bins`, and `depth` is what a fragment compares against the bin. It is Godot's
   * `shadow.directional_xform` (`:1209`) after the screen's NDC-to-world map.
   */
  readonly ndcToShadow: Affine2;
}

/** A row-major 2×3 affine. */
type Affine2 = readonly [number, number, number, number, number, number];

function dot(a: Point2, b: Point2): number {
  return a.x * b.x + a.y * b.y;
}

/** `light_update_directional_shadow`'s frame, from `:1138-1148` and `:1205-1209`. */
function directionalShadowTransform(view: DirectionalShadowView): Affine2 {
  const { clip: corners, direction, maxDistance } = view;
  const center = {
    x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
    y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
  };
  const centerAlong = dot(direction, center);
  let toEdge = 0;
  let halfSize = 0;
  for (const corner of corners) {
    toEdge = Math.max(toEdge, Math.abs(dot(direction, corner) - centerAlong));
    halfSize = Math.max(halfSize, Math.hypot(corner.x - center.x, corner.y - center.y));
  }

  const reach = toEdge + maxDistance;
  const origin = { x: center.x - direction.x * reach, y: center.y - direction.y * reach };
  const zFar = toEdge * 2 + maxDistance;
  // Godot's `-light_dir.orthogonal()` (`:1154`), carried into the Y-up world: u runs the same way.
  const across = { x: -direction.y, y: direction.x };
  const uScale = 1 / (halfSize * 2);
  return [
    across.x * uScale,
    across.y * uScale,
    0.5 - dot(across, origin) * uScale,
    direction.x / zFar,
    direction.y / zFar,
    -dot(direction, origin) / zFar,
  ];
}

/** `worldToShadow` after the affine that carries NDC onto the screen's corners. */
function ndcToShadowTransform(corners: Quad2, worldToShadow: Affine2): Affine2 {
  const [c0, c1, , c3] = corners;
  const ex = { x: (c1.x - c0.x) / 2, y: (c1.y - c0.y) / 2 };
  const ey = { x: (c3.x - c0.x) / 2, y: (c3.y - c0.y) / 2 };
  const origin = { x: c0.x + ex.x + ey.x, y: c0.y + ex.y + ey.y };
  const [m00, m01, m02, m10, m11, m12] = worldToShadow;
  return [
    m00 * ex.x + m01 * ex.y,
    m00 * ey.x + m01 * ey.y,
    m00 * origin.x + m01 * origin.y + m02,
    m10 * ex.x + m11 * ex.y,
    m10 * ey.x + m11 * ey.y,
    m10 * origin.x + m11 * origin.y + m12,
  ];
}

/**
 * Does edge a→b cast under `cullMode`, for light travelling along `direction`? Measured on Godot
 * 4.6.3: a square clockwise on screen, lit from above, is lit inside under CULL_CLOCKWISE and
 * shadowed inside under CULL_COUNTER_CLOCKWISE, the reverse of a PointLight2D's `edgeCastsShadow`,
 * since `to_light_xform` (`:1150-1154`) is a reflection.
 */
function edgeCastsDirectionalShadow(
  direction: Point2,
  edgeX: number,
  edgeY: number,
  cullMode: OccluderCullMode
): boolean {
  const facing = direction.x * edgeY - direction.y * edgeX;
  if (!Number.isFinite(facing) || facing === 0) return false;
  if (cullMode === OCCLUDER_CULL_CLOCKWISE) return facing < 0;
  if (cullMode === OCCLUDER_CULL_COUNTER_CLOCKWISE) return facing > 0;
  return true;
}

/** The interval `points` cover along `axis`. */
function project(points: ArrayLike<number>, axis: Point2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    const along = axis.x * points[i]! + axis.y * points[i + 1]!;
    if (along < min) min = along;
    if (along > max) max = along;
  }
  return [min, max];
}

/**
 * Godot's occluder cull (`renderer_viewport.cpp:567-640`): keep an occluder whose bounds meet the
 * viewport swept `max_distance` upstream, toward the light. Both shapes are convex, so a separating
 * axis among the viewport's edges, the sweep's sides and the bounds' own axes decides it.
 */
function casterInSweptView(segments: ArrayLike<number>, view: DirectionalShadowView): boolean {
  if (segments.length < 4) return false;
  const [xMin, xMax] = project(segments, { x: 1, y: 0 });
  const [yMin, yMax] = project(segments, { x: 0, y: 1 });
  if (!Number.isFinite(xMin + xMax + yMin + yMax)) return false;
  const bounds = [xMin, yMin, xMax, yMin, xMax, yMax, xMin, yMax];

  const { clip: corners, direction, maxDistance } = view;
  const swept: number[] = [];
  for (const corner of corners) {
    swept.push(
      corner.x,
      corner.y,
      corner.x - direction.x * maxDistance,
      corner.y - direction.y * maxDistance
    );
  }

  const axes: Point2[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -direction.y, y: direction.x },
    { x: corners[0].y - corners[1].y, y: corners[1].x - corners[0].x },
    { x: corners[1].y - corners[2].y, y: corners[2].x - corners[1].x },
  ];
  return axes.every((axis) => {
    const [boundsMin, boundsMax] = project(bounds, axis);
    const [sweptMin, sweptMax] = project(swept, axis);
    return boundsMin <= sweptMax && boundsMax >= sweptMin;
  });
}

/**
 * The map for one light over the viewport. `casters` are world-space occluders already narrowed by
 * `shadow_item_cull_mask`. Each casting edge is rasterised at bin centres, keeping the nearest
 * depth (`canvas_occlusion.glsl`'s `depth / z_far`) and clipping what falls outside `[0, z_far]`.
 */
export function buildDirectionalShadowMap(
  view: DirectionalShadowView,
  casters: readonly ShadowCasterEdges[]
): DirectionalShadowMap {
  const worldToShadow = directionalShadowTransform(view);
  const bins = new Float32Array(SHADOW_MAP_BINS).fill(SHADOW_MAP_FAR);
  const [m00, m01, m02, m10, m11, m12] = worldToShadow;

  for (const { segments, cullMode } of casters) {
    if (!casterInSweptView(segments, view)) continue;
    for (let i = 0; i + 3 < segments.length; i += 4) {
      const ax = segments[i]!;
      const ay = segments[i + 1]!;
      const bx = segments[i + 2]!;
      const by = segments[i + 3]!;
      if (!edgeCastsDirectionalShadow(view.direction, bx - ax, by - ay, cullMode)) continue;

      const uA = (m00 * ax + m01 * ay + m02) * SHADOW_MAP_BINS;
      const uB = (m00 * bx + m01 * by + m02) * SHADOW_MAP_BINS;
      const depthA = m10 * ax + m11 * ay + m12;
      const depthB = m10 * bx + m11 * by + m12;
      const first = Math.max(0, Math.ceil(Math.min(uA, uB) - 0.5));
      const last = Math.min(SHADOW_MAP_BINS - 1, Math.floor(Math.max(uA, uB) - 0.5));

      for (let bin = first; bin <= last; bin += 1) {
        const t = (bin + 0.5 - uA) / (uB - uA);
        const depth = depthA + (depthB - depthA) * t;
        if (!(depth >= 0) || !(depth <= SHADOW_MAP_FAR)) continue;
        if (depth < bins[bin]!) bins[bin] = depth;
      }
    }
  }

  return { bins, ndcToShadow: ndcToShadowTransform(view.screen, worldToShadow) };
}
