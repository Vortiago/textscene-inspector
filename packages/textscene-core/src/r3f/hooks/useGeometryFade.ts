/**
 * A geometry instance's per-frame draw state: whether its visibility range lets it draw at the
 * camera's distance, and the fade its surfaces blend at. Every drawer of a GeometryInstance3D reads
 * it, so the range and `transparency` reach each one the same way.
 */

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMemo, useRef, useState, type RefObject } from 'react';
import { fadeAlpha, forcesAlphaPass, geometryFade } from '../../godot/fadeAlpha';
import {
  hasVisibilityRange,
  visibilityRangeAt,
  type VisibilityAtDistance,
} from '../../godot/visibilityRange';
import type { GeometryInstance3DProperties } from '../../nodes/3d/geometryinstance3d/types';
import type { AabbValue } from '../../parser/valueParsers';
import { transformFromNode3DProperties } from '../nodeTransform';

export interface GeometryFade {
  /** Whether the instance draws: false only outside its visibility range. */
  visible: boolean;
  /** The fade every surface blends at (`geometryFade`), for the material slots. */
  fade: number;
}

/** Before the first frame measures a distance, the instance draws, as one with no range does. */
const IN_RANGE: VisibilityAtDistance = { visible: true, fade: 1 };

/** Scratch, reused across frames and instances: each frame callback runs alone. */
const cameraPosition = new THREE.Vector3();
const worldCentre = new THREE.Vector3();
const meshCentre = new THREE.Vector3();

/**
 * @param objectRef - the instance's own drawn object, whose three parent places the node
 * @param properties - the GeometryInstance3D's parsed properties
 * @param ownAabbCentre - the centre of the instance's own AABB in node space, or null until it is
 *   known. `custom_aabb` replaces it (`renderer_scene_cull.cpp:1988-1992`).
 */
export function useGeometryFade(
  objectRef: RefObject<THREE.Object3D | null>,
  properties: GeometryInstance3DProperties,
  ownAabbCentre: () => THREE.Vector3Like | null
): GeometryFade {
  const { visibilityRange, transparency, customAabb } = properties;
  const [atDistance, setAtDistance] = useState(IN_RANGE);
  /**
   * Written only by the frame callback: the state Godot keeps per viewport, which starts hidden
   * (`renderer_scene_cull.h:301`), so a DISABLED range first draws inside its inner margins.
   */
  const wasVisible = useRef(false);
  // The node's authored transform, not its live one: a billboard or `fixed_size` rewrites the
  // live pose every frame, and Godot's instance transform never sees either.
  const nodeMatrix = useMemo(() => authoredMatrix(properties), [properties]);
  const customCentre = useMemo(() => customAabb && aabbCentre(customAabb), [customAabb]);

  useFrame(({ camera }) => {
    if (!hasVisibilityRange(visibilityRange)) return;
    const object = objectRef.current;
    const localCentre = customCentre ?? ownAabbCentre();
    if (!object || !localCentre) return;

    worldCentre.copy(localCentre).applyMatrix4(nodeMatrix);
    if (object.parent) {
      object.parent.updateWorldMatrix(true, false);
      worldCentre.applyMatrix4(object.parent.matrixWorld);
    }
    const distance = camera.getWorldPosition(cameraPosition).distanceTo(worldCentre);
    const next = visibilityRangeAt(visibilityRange, distance, wasVisible.current);
    wasVisible.current = next.visible;
    if (!drawsAlike(next, atDistance, transparency)) setAtDistance(next);
  });

  // A range removed by an edit leaves a stale state, which no frame callback clears.
  const current = hasVisibilityRange(visibilityRange) ? atDistance : IN_RANGE;
  return { visible: current.visible, fade: geometryFade(transparency, current.fade) };
}

/**
 * Whether two range states draw the same pixels: Godot quantises the fade to a byte and switches
 * passes at one threshold, so a re-render waits for either to change.
 */
function drawsAlike(a: VisibilityAtDistance, b: VisibilityAtDistance, transparency: number): boolean {
  const fadeA = geometryFade(transparency, a.fade);
  const fadeB = geometryFade(transparency, b.fade);
  return (
    a.visible === b.visible &&
    fadeAlpha(fadeA) === fadeAlpha(fadeB) &&
    forcesAlphaPass(fadeA) === forcesAlphaPass(fadeB)
  );
}

function authoredMatrix(properties: GeometryInstance3DProperties): THREE.Matrix4 {
  const { position, rotation, scale } = transformFromNode3DProperties(properties);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale)
  );
}

function aabbCentre({ position, size }: AabbValue): THREE.Vector3 {
  return new THREE.Vector3(position.x + size.x / 2, position.y + size.y / 2, position.z + size.z / 2);
}

/**
 * The centre of a mesh's own geometry box, in its local space, or null before the geometry
 * attaches. The result is scratch, valid until the next call.
 */
export function geometryCentre(mesh: THREE.Mesh | null): THREE.Vector3 | null {
  const geometry = mesh?.geometry;
  if (!geometry) return null;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  return geometry.boundingBox!.getCenter(meshCentre);
}
