/**
 * The particles of a GPUParticles3D: the pose the GPU steps reach (`settle.ts`), copied into the
 * draw order and the alignment of the node (`instanceCopy.ts`), drawn once for each draw pass,
 * under the node, as the server draws the passes over one particle buffer.
 */

import { useMemo } from 'react';
import type { Transform3D } from '../../../../godot/math/transform3d';
import type { GpuMaterial } from '../../../shared/gpuparticles/emitter';
import { copyInstances, readsCamera } from '../../../shared/gpuparticles/instanceCopy';
import { gpuSettleSeconds, settleGpuParticles } from '../../../shared/gpuparticles/settle';
import { ParticleMesh } from '../../../shared/particles3d/ParticleMesh';
import { useCameraAxes } from '../../../shared/particles3d/useCameraAxes';
import type { GPUParticles3DProperties } from './types';

interface ParticleEmitterProps {
  properties: GPUParticles3DProperties;
  material: GpuMaterial;
  emissionTransform: Transform3D;
}

export function ParticleEmitter({ properties, material, emissionTransform }: ParticleEmitterProps) {
  const { emitter, drawPasses, drawOrder, transformAlign } = properties;
  const settled = useMemo(
    () => settleGpuParticles({ emitter, material, emissionTransform }, gpuSettleSeconds(emitter)),
    [emitter, material, emissionTransform]
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
      }),
    [settled, emitter, drawOrder, transformAlign, emissionTransform, view]
  );
  // No live particle draws no pass: Godot draws an instance for none.
  if (buffer.length === 0) return null;
  return (
    <>
      {drawPasses.map((mesh, pass) => (
        <ParticleMesh key={pass} mesh={mesh} buffer={buffer} />
      ))}
    </>
  );
}
