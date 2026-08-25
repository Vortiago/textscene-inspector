/**
 * Godot's `FLAG_FIXED_SIZE` (`scene/resources/material.cpp:1357-1381`),
 * applied per frame to an Object3D — the quad keeps a constant ON-SCREEN size
 * however far the camera is from it.
 *
 * Shared by every slice that exposes `fixed_size`: SpriteBase3D and Label3D
 * both hand it to `get_material_for_2d` (`sprite_3d.cpp:299`,
 * `label_3d.cpp:396`), which sets the flag on the cached shader.
 *
 * Godot emits it as a VERTEX patch that scales columns 0-2 of
 * `MODELVIEW_MATRIX` — the model-view BASIS, leaving column 3 (the origin)
 * alone. Scaling the object's own `scale` is that same transform: a basis
 * scaled by `sc` after the view matrix equals the model matrix
 * post-multiplied by `diag(sc, sc, sc, 1)`. It is applied here rather than
 * through `materialProgramInputs.ts`'s `ProgramInjection` seam for two
 * reasons: Label3D's glyph material never passes through that seam at all (it
 * is built imperatively by `canvasTextPainter.ts`), so one injection could not
 * serve both nodes; and a scale the scene graph can see keeps raycast picking
 * and `frameSceneBounds.ts` agreeing with what is drawn, which a
 * vertex-shader-only rescale would not.
 *
 * The two arms branch on `PROJECTION_MATRIX[3][3]` exactly as the emitted
 * GLSL does, not on the camera's class:
 *   perspective (`[3][3] == 0`) — `sc = -(MODELVIEW_MATRIX)[3].z`, the
 *     object origin's own view-space depth, so on-screen size is
 *     depth-invariant.
 *   orthogonal — `h = abs(1 / (2 * PROJECTION_MATRIX[1][1]))`, `sc = h * 2`;
 *     no depth term, since an orthographic projection has none.
 * `IS_MULTIVIEW` (stereo, which takes the full distance rather than the Z
 * component) has no counterpart here — this renderer has one camera.
 */

import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRef, type RefObject } from 'react';
import type { Vec3Tuple } from '../nodeTransform';

/** Scratch, reused across frames — this runs on every rendered frame. */
const viewSpaceOrigin = new THREE.Vector3();

export function useFixedSize(
  ref: RefObject<THREE.Object3D | null>,
  enabled: boolean,
  /** The node's OWN authored scale, re-read every frame so the factor never compounds. */
  authoredScale: Vec3Tuple
): void {
  // `enabled` going false must WRITE the authored scale back, not just stop
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
    const projection = camera.projectionMatrix.elements;
    let sc: number;
    if (projection[15] !== 0) {
      sc = Math.abs(1 / projection[5]!);
    } else {
      object.updateWorldMatrix(true, false);
      viewSpaceOrigin.setFromMatrixPosition(object.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      sc = -viewSpaceOrigin.z;
    }
    object.scale.set(authoredScale[0] * sc, authoredScale[1] * sc, authoredScale[2] * sc);
  });
}
