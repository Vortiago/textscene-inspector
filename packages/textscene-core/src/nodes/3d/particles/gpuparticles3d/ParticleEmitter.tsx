/**
 * The particles of a GPUParticles3D: the pose the GPU steps reach (`settle.ts`), drawn once for
 * each draw pass, under the node, as the server draws the passes over one particle buffer.
 */

import { useMemo } from 'react';
import type { Transform3D } from '../../../../godot/math/transform3d';
import type { GpuMaterial } from '../../../shared/gpuparticles/emitter';
import { gpuSettleSeconds, settleGpuParticles } from '../../../shared/gpuparticles/settle';
import { ParticleMesh } from '../../../shared/particles3d/ParticleMesh';
import type { GPUParticles3DProperties } from './types';

interface ParticleEmitterProps {
  properties: GPUParticles3DProperties;
  material: GpuMaterial;
  emissionTransform: Transform3D;
}

export function ParticleEmitter({ properties, material, emissionTransform }: ParticleEmitterProps) {
  const { emitter, drawPasses } = properties;
  const { buffer } = useMemo(
    () => settleGpuParticles({ emitter, material, emissionTransform }, gpuSettleSeconds(emitter)),
    [emitter, material, emissionTransform]
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
