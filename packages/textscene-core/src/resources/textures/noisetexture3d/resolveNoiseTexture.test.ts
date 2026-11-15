/**
 * Building a decoded NoiseTexture3D, as a FogMaterial's `density_texture` names one. The build runs
 * as a worker job, here through the in-thread runner, which runs the same job.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { loadedValue } from '../../reading/reading.testkit';
import { WorkerJobRunner } from '../../../workers/WorkerJobRunner';
import { resetProceduralTextures } from '../proceduralBuilds';
import { TEXTURE_3D } from '../texture3d/kind';
import { noiseTexture3D } from './resolveNoiseTexture';

const FOG = `[sub_resource type="FastNoiseLite" id="FastNoiseLite_a"]

[sub_resource type="NoiseTexture3D" id="NoiseTexture3D_b"]
width = 4
height = 3
depth = 5
noise = SubResource("FastNoiseLite_a")
`;

afterEach(() => {
  resetProceduralTextures();
});

describe('noiseTexture3D', () => {
  it('builds the texels Godot measures into a 3D texture', async () => {
    const source = loadedValue(TEXTURE_3D, 'SubResource("NoiseTexture3D_b")', FOG);
    if (source.form !== 'noise') throw new Error(`expected a noise source, got ${source.form}`);
    const lookup = noiseTexture3D(source);
    if (lookup?.status !== 'pending') throw new Error(`expected a pending build, got ${lookup?.status}`);
    const handle = lookup.start(new WorkerJobRunner());
    const texture = await handle.settled;
    handle.release();
    expect(texture).toBeInstanceOf(THREE.Data3DTexture);
    expect(Array.from((texture as THREE.Data3DTexture).image.data as Uint8Array).slice(0, 4)).toEqual([
      29, 58, 80, 100,
    ]);
  });
});
