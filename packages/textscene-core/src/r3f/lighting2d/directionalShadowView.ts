/**
 * What a DirectionalLight2D's shadow map is built over, read off the scene each frame: the light's
 * direction from its node, Godot's `clip_rect` from the project viewport, and the screen the quad
 * covers from the editor camera. The map spans the game's view, so a pan or a zoom only moves it.
 */

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { DirectionalShadowView, Point2, Quad2 } from './directionalShadowMap';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import type { ProjectViewportSize } from '../../parser/projectSettingsParser';
import { SHADOW_SNAPSHOT_PRIORITY } from './ShadowCasterStage';

/** The four NDC corners, in the order `DirectionalShadowView.corners` names them. */
const NDC_CORNERS: readonly [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/** Reused across the sample so a per-frame read allocates no vectors. */
const scratch = new THREE.Vector3();

function unprojectCorner(camera: THREE.Camera, x: number, y: number): Point2 {
  scratch.set(x, y, 0).unproject(camera);
  return { x: scratch.x, y: scratch.y };
}

/**
 * Godot's `Rect2(0, 0, size)` (`renderer_viewport.cpp:390`) in the Y-up world, in NDC corner
 * order. The canvas transform is the identity: the stage applies no Camera2D.
 */
function viewportClip({ width, height }: ProjectViewportSize): Quad2 {
  return [
    { x: 0, y: -height },
    { x: width, y: -height },
    { x: width, y: 0 },
    { x: 0, y: 0 },
  ];
}

/**
 * The view for the light whose node `anchor` is drawn under. `maxDistance` stays in viewport
 * pixels, which the identity canvas transform makes world units. The caller refreshes the matrices.
 */
export function sampleDirectionalShadowView(
  anchor: THREE.Object3D,
  camera: THREE.Camera,
  viewport: ProjectViewportSize,
  maxDistance: number
): DirectionalShadowView {
  // Godot's +Y is the previewer's -Y, and `transformDirection` normalises, as `:564` does.
  scratch.set(0, -1, 0).transformDirection(anchor.matrixWorld);
  const direction = { x: scratch.x, y: scratch.y };
  const screen = NDC_CORNERS.map(([x, y]) => unprojectCorner(camera, x, y)) as unknown as Quad2;
  return { clip: viewportClip(viewport), screen, direction, maxDistance };
}

function samePoint(a: Point2, b: Point2): boolean {
  return a.x === b.x && a.y === b.y;
}

function sameQuad(a: Quad2, b: Quad2): boolean {
  return a.every((corner, index) => samePoint(corner, b[index]!));
}

/** Do two views build the same map? */
export function sameDirectionalShadowView(
  a: DirectionalShadowView | null,
  b: DirectionalShadowView | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    samePoint(a.direction, b.direction) &&
    a.maxDistance === b.maxDistance &&
    sameQuad(a.clip, b.clip) &&
    sameQuad(a.screen, b.screen)
  );
}

/**
 * `sampleDirectionalShadowView` for `anchor`, refreshed on mount and every frame, republished
 * only on a change, and null while `enabled` is false or `anchor` is not in the tree.
 */
export function useDirectionalShadowView(
  anchor: THREE.Object3D | null,
  enabled: boolean,
  maxDistance: number
): DirectionalShadowView | null {
  const camera = useThree((state) => state.camera);
  const { viewportSize } = useProjectSettings();
  const [view, setView] = useState<DirectionalShadowView | null>(null);
  const published = useRef(view);

  const sample = useCallback(() => {
    let next: DirectionalShadowView | null = null;
    if (enabled && anchor?.parent) {
      anchor.updateWorldMatrix(true, false);
      camera.updateMatrixWorld();
      next = sampleDirectionalShadowView(anchor, camera, viewportSize, maxDistance);
    }
    if (sameDirectionalShadowView(published.current, next)) return;
    published.current = next;
    setView(next);
  }, [anchor, enabled, camera, viewportSize, maxDistance]);

  useLayoutEffect(sample, [sample]);
  useFrame(sample, SHADOW_SNAPSHOT_PRIORITY);

  return view;
}
