/**
 * The particles of a GPUParticles3D: the pose the GPU steps reach (`settle.ts`), copied into the
 * draw order and the alignment of the node (`instanceCopy.ts`), drawn once for each draw pass,
 * under the node, as the server draws the passes over one particle buffer. With `trail_enabled` and
 * bind poses, each particle draws one section for each pose (`TrailMesh.tsx`).
 */

import { useMemo } from 'react';
import type { Transform3D } from '../../../../godot/math/transform3d';
import type { GpuMaterial } from '../../../shared/gpuparticles/emitter';
import { copyInstances, readsCamera } from '../../../shared/gpuparticles/instanceCopy';
import { gpuSettleSeconds, settleGpuParticles } from '../../../shared/gpuparticles/settle';
import { ParticleMesh } from '../../../shared/particles3d/ParticleMesh';
import { TrailMesh } from '../../../shared/particles3d/TrailMesh';
import { useCameraAxes } from '../../../shared/particles3d/useCameraAxes';
import type { GPUParticles3DProperties } from './types';
import { useTrailBindPoses } from './useTrailBindPoses';

interface ParticleEmitterProps {
  properties: GPUParticles3DProperties;
  material: GpuMaterial;
  emissionTransform: Transform3D;
}

export function ParticleEmitter({ properties, material, emissionTransform }: ParticleEmitterProps) {
  const { emitter, drawPasses, drawOrder, transformAlign, trailEnabled, trailLifetime, drawSkin } =
    properties;
  const poses = useTrailBindPoses(drawSkin, drawPasses);
  // A trail needs more than one bind pose, as `particles_storage.cpp:645-647` counts sections.
  const bindPoses = trailEnabled && poses && poses.length > 1 ? poses : undefined;
  const sections = bindPoses?.length;
  const settled = useMemo(
    () =>
      settleGpuParticles(
        {
          emitter,
          material,
          emissionTransform,
          trail: sections === undefined ? undefined : { sections, lifetime: trailLifetime },
        },
        gpuSettleSeconds(emitter)
      ),
    [emitter, material, emissionTransform, sections, trailLifetime]
  );
  const view = useCameraAxes(readsCamera(drawOrder, transformAlign));
  const buffer = useMemo(
    () =>
      copyInstances(settled, {
        amount: emitter.amount,
        drawOrder,
        transformAlign,
        localCoords: emitter.localCoords,
        emissionTransform,
        view,
        bindPoses,
      }),
    [settled, emitter, drawOrder, transformAlign, emissionTransform, view, bindPoses]
  );
  // No live particle draws no pass: Godot draws an instance for none.
  if (buffer.length === 0) return null;
  return (
    <>
      {drawPasses.map((mesh, pass) =>
        sections === undefined ? (
          <ParticleMesh key={pass} mesh={mesh} buffer={buffer} />
        ) : (
          <TrailMesh key={pass} mesh={mesh} buffer={buffer} sections={sections} />
        )
      )}
    </>
  );
}
