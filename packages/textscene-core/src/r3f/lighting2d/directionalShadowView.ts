/**
 * What a DirectionalLight2D's shadow map is built over, and how the light quad reaches it. The map
 * depends on the light's direction, Godot's `clip_rect` from the canvas it lights
 * (`renderer_canvas_render_rd.cpp:1140-1146`), the canvas scale and `max_distance`. The stage's
 * clip never moves, so a pan only moves the quad's NDC lookup. A SubViewport's Camera2D moves its
 * clip, and the map follows it, as Godot rebuilds the map each frame. Both hooks read the canvas
 * from the pass that hosts the light, which runs them once its camera is framed.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ndcToShadowTransform, type Affine2, type DirectionalShadowView } from './directionalShadowMap';
import type { Quad2 } from './shadowVolumes';
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

/**
 * The view for the light whose node `anchor` is drawn under, refreshed on mount and ahead of every
 * draw of the pass, republished only on a change, and null while `enabled` is false or `anchor` is
 * not in the tree. `maxDistance` stays in screen pixels, as Godot reads it.
 */
export function useDirectionalShadowView(
  anchor: THREE.Object3D | null,
  enabled: boolean,
  maxDistance: number
): DirectionalShadowView | null {
  const { registerPassStep } = useCanvasLighting2D();
  const [view, setView] = useState<DirectionalShadowView | null>(null);
  const published = useRef(view);
  // The clip's quad, kept while the host hands out the same clip, so a still canvas republishes nothing.
  const quadOf = useRef<{ clip: CanvasClip; quad: Quad2 } | null>(null);

  const sample = useCallback<LightPassStep>(
    (_camera, clip) => {
      let next: DirectionalShadowView | null = null;
      if (enabled && anchor?.parent) {
        anchor.updateWorldMatrix(true, false);
        const { x, y } = readLightDirection(anchor);
        if (quadOf.current?.clip !== clip) quadOf.current = { clip, quad: rectQuad(clip.rect) };
        const { quad } = quadOf.current;
        const current = published.current;
        // Compared before allocating: a still light is the common frame.
        if (
          current?.clip === quad &&
          current.scale === clip.scale &&
          current.maxDistance === maxDistance &&
          current.direction.x === x &&
          current.direction.y === y
        ) {
          return;
        }
        next = { clip: quad, direction: { x, y }, maxDistance, scale: clip.scale };
      } else if (published.current === null) {
        return;
      }
      published.current = next;
      setView(next);
    },
    [anchor, enabled, maxDistance]
  );

  useLayoutEffect(() => registerPassStep(sample), [registerPassStep, sample]);

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
 * light's lifetime, rewritten from the pass's camera ahead of every draw, so a pan moves the lookup
 * and builds nothing. It holds the identity until the first map.
 */
export function useNdcToShadow(worldToShadow: Affine2 | null): THREE.Matrix3 {
  const { registerPassStep } = useCanvasLighting2D();
  const [matrix] = useState(() => new THREE.Matrix3());

  const write = useCallback<LightPassStep>(
    (camera) => {
      if (!worldToShadow) return;
      const [m00, m01, m02, m10, m11, m12] = ndcToShadowTransform(readScreen(camera), worldToShadow);
      matrix.set(m00, m01, m02, m10, m11, m12, 0, 0, 1);
    },
    [worldToShadow, matrix]
  );

  useLayoutEffect(() => registerPassStep(write), [registerPassStep, write]);

  return matrix;
}
