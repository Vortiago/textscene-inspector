/**
 * Resolving a NoiseTexture3D sub-resource to a build, as a FogMaterial's `density_texture` names
 * one. The build runs as a worker job, here through the in-thread runner, which runs the same job.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { parseTresFile } from '../../../parser/parsedResource';
import { WorkerJobRunner } from '../../../workers/WorkerJobRunner';
import { resetProceduralTextures } from '../proceduralBuilds';
import { resolveNoiseTexture3D } from './resolveNoiseTexture';

const FOG = `[gd_resource type="FogMaterial" format=3]

[sub_resource type="FastNoiseLite" id="FastNoiseLite_a"]

[sub_resource type="NoiseTexture3D" id="NoiseTexture3D_b"]
width = 4
height = 3
depth = 5
noise = SubResource("FastNoiseLite_a")

[resource]
density_texture = SubResource("NoiseTexture3D_b")
`;

const fog = parseTresFile(FOG);
const DENSITY = 'SubResource("NoiseTexture3D_b")';

afterEach(() => {
  resetProceduralTextures();
});

describe('resolveNoiseTexture3D', () => {
  it('builds the texels Godot measures into a 3D texture', async () => {
    const lookup = resolveNoiseTexture3D(DENSITY, fog.subResources);
    if (lookup?.status !== 'pending') throw new Error(`expected a pending build, got ${lookup?.status}`);
    const handle = lookup.start(new WorkerJobRunner());
    const texture = await handle.settled;
    handle.release();
    expect(texture).toBeInstanceOf(THREE.Data3DTexture);
    expect(Array.from((texture as THREE.Data3DTexture).image.data as Uint8Array).slice(0, 4)).toEqual([
      29, 58, 80, 100,
    ]);
  });

  it('declines a reference that is not an inline NoiseTexture3D', () => {
    expect(resolveNoiseTexture3D('SubResource("FastNoiseLite_a")', fog.subResources)).toBeNull();
    expect(resolveNoiseTexture3D('ExtResource("1")', fog.subResources)).toBeNull();
  });

  it('declines a texture without noise, for which Godot generates nothing (edge case)', () => {
    const empty = parseTresFile(FOG.replace('noise = SubResource("FastNoiseLite_a")\n', ''));
    expect(resolveNoiseTexture3D(DENSITY, empty.subResources)).toBeNull();
  });
});
