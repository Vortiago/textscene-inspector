/**
 * What a DirectionalLight2D's shadow map is built over, and how the light quad reaches it. The map
 * depends on the light's direction, Godot's `clip_rect` from the project viewport and
 * `max_distance`, so a pan or a zoom leaves it alone and only moves the quad's NDC lookup.
 */

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ndcToShadowTransform, type Affine2, type DirectionalShadowView } from './directionalShadowMap';
import type { Quad2 } from './shadowVolumes';
import { SHADOW_SNAPSHOT_PRIORITY } from './ShadowCasterStage';
import { useGameViewportRect } from '../gameViewportRect';
import type { Vector2 } from '../../nodes/base/node2d/types.js';
import type { Rect2 } from '../controls/native/rect';

/** Reused by every sample, which reads it before the next one writes it. */
const scratch = new THREE.Vector3();

/** The game viewport rect, at the canvas origin, in the Y-up world and NDC corner order. */
function viewportQuad({ w, h }: Pick<Rect2, 'w' | 'h'>): Quad2 {
  return [
    { x: 0, y: -h },
    { x: w, y: -h },
    { x: w, y: 0 },
    { x: 0, y: 0 },
  ];
}

/**
 * The light node's Godot +Y axis, into `scratch`. Godot's +Y is the previewer's -Y, and
 * `transformDirection` normalises, as `renderer_viewport.cpp:564` does.
 */
function readLightDirection(anchor: THREE.Object3D): THREE.Vector3 {
  return scratch.set(0, -1, 0).transformDirection(anchor.matrixWorld);
}

/**
 * The view for the light whose node `anchor` is drawn under, refreshed on mount and every frame,
 * republished only on a change, and null while `enabled` is false or `anchor` is not in the tree.
 * `maxDistance` stays in viewport pixels, which the identity canvas transform makes world units.
 */
export function useDirectionalShadowView(
  anchor: THREE.Object3D | null,
  enabled: boolean,
  maxDistance: number
): DirectionalShadowView | null {
  // Godot's `clip_rect`.
  const viewport = useGameViewportRect();
  const clip = useMemo(() => viewportQuad(viewport), [viewport]);
  const [view, setView] = useState<DirectionalShadowView | null>(null);
  const published = useRef(view);

  const sample = useCallback(() => {
    let next: DirectionalShadowView | null = null;
    if (enabled && anchor?.parent) {
      anchor.updateWorldMatrix(true, false);
      const { x, y } = readLightDirection(anchor);
      const current = published.current;
      // Compared before allocating: a still light is the common frame.
      if (
        current?.clip === clip &&
        current.maxDistance === maxDistance &&
        current.direction.x === x &&
        current.direction.y === y
      ) {
        return;
      }
      next = { clip, direction: { x, y }, maxDistance };
    } else if (published.current === null) {
      return;
    }
    published.current = next;
    setView(next);
  }, [anchor, enabled, clip, maxDistance]);

  useLayoutEffect(sample, [sample]);
  useFrame(sample, SHADOW_SNAPSHOT_PRIORITY);

  return view;
}

/** Reused by every frame's lookup, which reads it before the next one writes it. */
const screen: [Vector2, Vector2, Vector2, Vector2] = [
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: 0 },
];

/** The four NDC corners, in the order `ndcToShadowTransform` names them. */
const NDC_CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/** What the camera shows, into `screen`. */
function readScreen(camera: THREE.Camera): Quad2 {
  camera.updateMatrixWorld();
  NDC_CORNERS.forEach(([x, y], index) => {
    scratch.set(x, y, 0).unproject(camera);
    Object.assign(screen[index]!, { x: scratch.x, y: scratch.y });
  });
  return screen;
}

/**
 * The quad's NDC position to `(u, depth)` for a map with `worldToShadow`. One matrix for the
 * light's lifetime, rewritten from the camera every frame, so a pan moves the lookup and builds
 * nothing. It holds the identity until the first map.
 */
export function useNdcToShadow(worldToShadow: Affine2 | null): THREE.Matrix3 {
  const camera = useThree((state) => state.camera);
  const [matrix] = useState(() => new THREE.Matrix3());

  const write = useCallback(() => {
    if (!worldToShadow) return;
    const [m00, m01, m02, m10, m11, m12] = ndcToShadowTransform(readScreen(camera), worldToShadow);
    matrix.set(m00, m01, m02, m10, m11, m12, 0, 0, 1);
  }, [camera, worldToShadow, matrix]);

  useLayoutEffect(write, [write]);
  useFrame(write, SHADOW_SNAPSHOT_PRIORITY);

  return matrix;
}
