/**
 * The bind poses a GPUParticles3D trail draws through (`gpu_particles_3d.cpp:595-617`): the poses
 * of `draw_skin`, else the built-in poses of the first draw pass that has any.
 */

import { useCallback } from 'react';
import type { Transform3D } from '../../../../godot/math/transform3d';
import { TRAIL_MESH_BIND_POSES } from '../../../../resources/meshes/primitivemesh/trailBindPoses';
import { useSnapshotRead, type NodeRead } from '../../../../resources/reading';
import { SKIN_BIND_POSES } from '../../../../resources/skin/bindPosesKind';

/** Null while a skin is still loading, and when neither the skin nor a draw pass has poses. */
export function useTrailBindPoses(
  drawSkin: string | undefined,
  drawPasses: ReadonlyArray<string | undefined>
): readonly Transform3D[] | null {
  return useSnapshotRead(
    useCallback((read) => bindPosesOf(read, drawSkin, drawPasses), [drawSkin, drawPasses])
  );
}

function bindPosesOf(
  read: NodeRead,
  drawSkin: string | undefined,
  drawPasses: ReadonlyArray<string | undefined>
): readonly Transform3D[] | null {
  const skin = read(drawSkin, SKIN_BIND_POSES);
  if (skin.status === 'loaded') return skin.value;
  if (skin.status === 'pending') return null;
  for (const pass of drawPasses) {
    const poses = read(pass, TRAIL_MESH_BIND_POSES);
    if (poses.status === 'loaded' && poses.value.length > 0) return poses.value;
  }
  return null;
}
