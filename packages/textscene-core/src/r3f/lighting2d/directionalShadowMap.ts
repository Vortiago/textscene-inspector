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
  convexBoundsTest,
  edgeNormals,
  type OccluderCullMode,
  type Quad2,
  type ShadowCasterEdges,
} from './shadowVolumes';
import { normalizedVector2, type Vector2 } from '../../godot/math/vector.js';
import { OccluderPolygon2DCullMode } from '../../godot/scene/lightOccluder2d';

/** What the map is built from, all in the previewer's 2D world space (Y up). */
export interface DirectionalShadowView {
  /**
   * Godot's `clip_rect`, the game viewport's rect (`renderer_viewport.cpp:390`), which the map
   * spans and the occluder cull sweeps. It is the project viewport, not what the editor shows.
   */
  readonly clip: Quad2;
  /** The unit direction the light travels in the world: the light node's Godot +Y axis. */
  readonly direction: Vector2;
  /** `DirectionalLight2D.max_distance` in screen pixels: how far upstream an occluder still casts. */
  readonly maxDistance: number;
  /**
   * Screen pixels per world unit on each axis, the canvas transform's scale. Godot builds the map in
   * screen space, from the lights' and occluders' `xform_cache` (`renderer_viewport.cpp:497-503,567,624`), so a Camera2D
   * zoom changes the diagonal the map spans and the distance `maxDistance` reaches.
   */
  readonly scale: Vector2;
}

interface DirectionalShadowMap {
  /** `SHADOW_MAP_BINS` depths over `z_far`, `SHADOW_MAP_FAR` where nothing casts. */
  readonly bins: Float32Array;
  /**
   * World to `(u, depth)`: `u` addresses `bins`, and `depth` is what a fragment compares against
   * the bin. It is Godot's `shadow.directional_xform` (`:1209`).
   */
  readonly worldToShadow: Affine2;
}

/** A row-major 2×3 affine. */
export type Affine2 = readonly [number, number, number, number, number, number];

function dot(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y;
}

/** The clip corners and the light direction in screen pixels, where Godot builds the map. */
function inScreenPixels({ clip, direction, scale }: DirectionalShadowView): {
  corners: Vector2[];
  direction: Vector2;
} {
  return {
    corners: clip.map(({ x, y }) => ({ x: x * scale.x, y: y * scale.y })),
    direction: normalizedVector2({ x: direction.x * scale.x, y: direction.y * scale.y }),
  };
}

/** `light_update_directional_shadow`'s frame, from `:1138-1148` and `:1205-1209`. */
function directionalShadowTransform(view: DirectionalShadowView): Affine2 {
  const { corners, direction } = inScreenPixels(view);
  const { maxDistance } = view;
  const center = {
    x: (corners[0]!.x + corners[1]!.x + corners[2]!.x + corners[3]!.x) / 4,
    y: (corners[0]!.y + corners[1]!.y + corners[2]!.y + corners[3]!.y) / 4,
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
  const [m00, m01, m02, m10, m11, m12]: Affine2 = [
    across.x * uScale,
    across.y * uScale,
    0.5 - dot(across, origin) * uScale,
    direction.x / zFar,
    direction.y / zFar,
    -dot(direction, origin) / zFar,
  ];
  // From world coordinates, not pixels: the map reads the world a fragment sits in.
  const { x: scaleX, y: scaleY } = view.scale;
  return [m00 * scaleX, m01 * scaleY, m02, m10 * scaleX, m11 * scaleY, m12];
}

/**
 * A full-screen quad's NDC position to `(u, depth)`: `worldToShadow` after the affine that carries
 * NDC onto `screen`, the corners at NDC (-1, -1), (1, -1), (1, 1) and (-1, 1).
 */
export function ndcToShadowTransform(screen: Quad2, worldToShadow: Affine2): Affine2 {
  const [c0, c1, , c3] = screen;
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
  direction: Vector2,
  edgeX: number,
  edgeY: number,
  cullMode: OccluderCullMode
): boolean {
  const facing = direction.x * edgeY - direction.y * edgeX;
  if (!Number.isFinite(facing) || facing === 0) return false;
  if (cullMode === OccluderPolygon2DCullMode.CLOCKWISE) return facing < 0;
  if (cullMode === OccluderPolygon2DCullMode.COUNTER_CLOCKWISE) return facing > 0;
  return true;
}

/**
 * Godot's occluder cull (`renderer_viewport.cpp:567-631`): keep an occluder whose local bounds meet
 * the viewport swept `max_distance` upstream, toward the light. Godot maps the sweep into the
 * occluder's local space, which an affine map leaves equivalent to testing the bounds' world
 * parallelogram against the sweep. The sweep is `max_distance` screen pixels long, so in the world
 * its length and direction follow the canvas scale.
 */
function sweptViewTest(view: DirectionalShadowView): (bounds: Quad2) => boolean {
  const { clip: corners, direction, maxDistance, scale } = view;
  const reach = maxDistance / Math.hypot(direction.x * scale.x, direction.y * scale.y);
  const sweep = { x: direction.x * reach, y: direction.y * reach };
  const swept: number[] = [];
  for (const corner of corners) {
    swept.push(corner.x, corner.y, corner.x - sweep.x, corner.y - sweep.y);
  }
  return convexBoundsTest(swept, [...edgeNormals(corners), { x: -direction.y, y: direction.x }]);
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
  const casterInSweptView = sweptViewTest(view);
  const bins = new Float32Array(SHADOW_MAP_BINS).fill(SHADOW_MAP_FAR);
  const [m00, m01, m02, m10, m11, m12] = worldToShadow;

  for (const { segments, cullMode, bounds } of casters) {
    if (!casterInSweptView(bounds)) continue;
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

  return { bins, worldToShadow };
}
