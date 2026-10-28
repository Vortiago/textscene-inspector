/**
 * A DirectionalLight2D's shadow map, and how the light quad reaches it. The map depends on the
 * light's direction, Godot's `clip_rect` from the canvas it lights
 * (`renderer_canvas_render_rd.cpp:1140-1146`), the canvas scale and `max_distance`. The stage's
 * clip never moves, so a pan only moves the quad's NDC lookup. A SubViewport's Camera2D moves its
 * clip, and the map follows it, as Godot rebuilds the map each frame. One step of the pass that
 * hosts the light builds both, once its camera is framed.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  buildDirectionalShadowMap,
  ndcToShadowTransform,
  type Affine2,
  type DirectionalShadowView,
} from './directionalShadowMap';
import { createDirectionalShadowTexture, writeDirectionalShadowMap } from './directionalLightQuad';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import type { Quad2, ShadowCasterEdges } from './shadowVolumes';
import { useCanvasLighting2D, type LightPassStep } from './lightPassContext';
import type { CanvasClip } from './lightPassHost';
import type { Rect2 } from '../../godot/math/rect2';
import type { Vector2 } from '../../godot/math/vector.js';

/** Reused by every sample, which reads it before the next one writes it. */
const scratch = new THREE.Vector3();

/** `rect` as the corners in NDC order. */
function rectQuad({ x, y, w, h }: Rect2): Quad2 {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

/**
 * The light node's Godot +Y axis, into `scratch`. Godot's +Y is the previewer's -Y, and
 * `transformDirection` normalises, as `renderer_viewport.cpp:567` does.
 */
function readLightDirection(anchor: THREE.Object3D): THREE.Vector3 {
  return scratch.set(0, -1, 0).transformDirection(anchor.matrixWorld);
}

/** The quad of each clip a host hands out, so a still canvas hands the map build the same quad. */
const clipQuads = new WeakMap<CanvasClip, Quad2>();

function quadOfClip(clip: CanvasClip): Quad2 {
  let quad = clipQuads.get(clip);
  if (!quad) clipQuads.set(clip, (quad = rectQuad(clip.rect)));
  return quad;
}

/**
 * The view for the light whose node is `anchor`, over `clip`. It returns `previous` itself while
 * nothing changed, and compares before allocating: a still light is the common frame.
 */
function readShadowView(
  anchor: THREE.Object3D,
  clip: CanvasClip,
  maxDistance: number,
  previous: DirectionalShadowView | null
): DirectionalShadowView {
  anchor.updateWorldMatrix(true, false);
  const { x, y } = readLightDirection(anchor);
  const quad = quadOfClip(clip);
  if (
    previous?.clip === quad &&
    previous.scale === clip.scale &&
    previous.maxDistance === maxDistance &&
    previous.direction.x === x &&
    previous.direction.y === y
  ) {
    return previous;
  }
  return { clip: quad, direction: { x, y }, maxDistance, scale: clip.scale };
}

/** Reused by every frame's lookup, which reads it before the next one writes it. */
const screen: [Vector2, Vector2, Vector2, Vector2] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

/** The map the last step built, and what it was built from. */
interface BuiltMap {
  readonly view: DirectionalShadowView;
  readonly casters: readonly ShadowCasterEdges[];
  readonly worldToShadow: Affine2;
}

/** The four NDC corners, in the order `ndcToShadowTransform` names them. */
const NDC_CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/** The quad's NDC position to `(u, depth)` for a map with `worldToShadow`, from `camera`. */
function writeNdcToShadow(matrix: THREE.Matrix3, camera: THREE.Camera, worldToShadow: Affine2): void {
  const [m00, m01, m02, m10, m11, m12] = ndcToShadowTransform(readScreen(camera), worldToShadow);
  matrix.set(m00, m01, m02, m10, m11, m12, 0, 0, 1);
}

/** What the camera shows, into `screen`. */
function readScreen(camera: THREE.Camera): Quad2 {
  camera.updateMatrixWorld();
  NDC_CORNERS.forEach(([x, y], index) => {
    scratch.set(x, y, 0).unproject(camera);
    Object.assign(screen[index]!, { x: scratch.x, y: scratch.y });
  });
  return screen;
}

/** What a light's quad samples: the map, and the lookup from its NDC position into it. */
export interface DirectionalShadowSampler {
  readonly map: THREE.DataTexture;
  readonly ndcToShadow: THREE.Matrix3;
}

/** The shadow map of the light whose node is `anchor`, and what a quad needs to sample it. */
export function useDirectionalShadow(
  anchor: THREE.Object3D | null,
  casters: readonly ShadowCasterEdges[],
  maxDistance: number
): DirectionalShadowSampler {
  const { registerPassStep } = useCanvasLighting2D();
  const [sampler] = useState<DirectionalShadowSampler>(() => ({
    map: createDirectionalShadowTexture(),
    ndcToShadow: new THREE.Matrix3(),
  }));
  useDisposeOnRelease(sampler.map);
  const built = useRef<BuiltMap | null>(null);

  // One step builds the map and writes the lookup, so the two never describe different clips. The
  // lookup holds the identity until the first map.
  const step = useCallback<LightPassStep>(
    (camera, clip) => {
      if (!anchor?.parent || casters.length === 0) {
        built.current = null;
        return;
      }
      const view = readShadowView(anchor, clip, maxDistance, built.current?.view ?? null);
      if (built.current?.view !== view || built.current.casters !== casters) {
        const { bins, worldToShadow } = buildDirectionalShadowMap(view, casters);
        writeDirectionalShadowMap(sampler.map, bins);
        built.current = { view, casters, worldToShadow };
      }
      writeNdcToShadow(sampler.ndcToShadow, camera, built.current.worldToShadow);
    },
    [anchor, casters, maxDistance, sampler]
  );
  useLayoutEffect(() => registerPassStep(step), [registerPassStep, step]);

  return sampler;
}
