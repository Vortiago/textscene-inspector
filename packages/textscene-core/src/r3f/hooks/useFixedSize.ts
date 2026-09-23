/**
 * Godot's `FLAG_FIXED_SIZE` (`scene/resources/material.cpp:1357-1381`), applied per frame: the quad
 * keeps one on-screen size at any distance. SpriteBase3D and Label3D both hand it to
 * `get_material_for_2d` (`sprite_3d.cpp:299`, `label_3d.cpp:396`). `IS_MULTIVIEW` (stereo) has no
 * counterpart, since this renderer has one camera.
 */

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRef, type RefObject } from 'react';
import type { Vec3Tuple } from '../nodeTransform';

/** Scratch, reused across frames: this runs on every rendered frame. */
const viewSpaceOrigin = new THREE.Vector3();

export function useFixedSize(
  ref: RefObject<THREE.Object3D | null>,
  enabled: boolean,
  /** The node's own authored scale, re-read every frame so the factor never compounds. */
  authoredScale: Vec3Tuple
): void {
  // `enabled` going false must write the authored scale back, not just stop
  // overwriting it: r3f compares a `scale` tuple shallowly, so an unchanged
  // authored value is never re-assigned and the last frame's factor would stick.
  const wasEnabled = useRef(false);

  useFrame(({ camera }) => {
    const object = ref.current;
    if (!object) return;
    if (!enabled) {
      if (wasEnabled.current) {
        object.scale.set(authoredScale[0], authoredScale[1], authoredScale[2]);
        wasEnabled.current = false;
      }
      return;
    }
    wasEnabled.current = true;
    // Godot's VERTEX patch scales the model-view basis and leaves the origin, which equals scaling
    // `object.scale`. Not a `ProgramInjection`: Label3D's glyph material bypasses that seam, and a
    // scale the scene graph sees keeps raycasts and `frameSceneBounds.ts` matching the pixels.
    const projection = camera.projectionMatrix.elements;
    let sc: number;
    // Branch on `PROJECTION_MATRIX[3][3]` as the emitted GLSL does, not on the camera's class.
    if (projection[15] !== 0) {
      // Orthogonal: `h = abs(1 / (2 * PROJECTION_MATRIX[1][1]))`, `sc = h * 2`, with no depth term.
      sc = Math.abs(1 / projection[5]!);
    } else {
      // Perspective: `sc = -(MODELVIEW_MATRIX)[3].z`, the origin's view-space depth.
      object.updateWorldMatrix(true, false);
      viewSpaceOrigin.setFromMatrixPosition(object.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      sc = -viewSpaceOrigin.z;
    }
    object.scale.set(authoredScale[0] * sc, authoredScale[1] * sc, authoredScale[2] * sc);
  });
}
