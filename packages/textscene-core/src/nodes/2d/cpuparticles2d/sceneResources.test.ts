import { describe, expect, it } from 'vitest';
import { parseTresFile } from '../../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { NO_RESOURCES, type SceneResources } from '../../../r3f/SceneResourcesContext';
import { loadedFilesOf, NO_FILES } from '../../../resources/testing/loadedFiles';
import { particleFiles, resolveParticleCurves, resolveParticleGradient } from './sceneResources';
import { CPU_PARTICLES_2D_PARAM_COUNT, type ParticleParam } from './types';
import { CPUParticlesParameter } from '../../../godot/scene/cpuParticles';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

const CURVE_DATA = '[Vector2(0, 1), 0.0, 0.0, 0, 0, Vector2(1, 0), 0.0, 0.0, 0, 0]';
const GRADIENT_DATA = {
  offsets: 'PackedFloat32Array(0, 1)',
  colors: 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)',
};

const CURVE: TscnInternalResource = { type: 'Curve', id: '4', data: { _data: CURVE_DATA } };
const GRADIENT: TscnInternalResource = { type: 'Gradient', id: '2', data: GRADIENT_DATA };

const CURVE_PATH = 'res://fade.tres';
const GRADIENT_PATH = 'res://ramp.tres';
const EXTERNAL: TscnExternalResource[] = [
  { id: '7_curve', type: 'Curve', path: CURVE_PATH },
  { id: '8_ramp', type: 'Gradient', path: GRADIENT_PATH },
];
const loadedFile = loadedFilesOf({
  [CURVE_PATH]: parseTresFile(`[gd_resource type="Curve" format=3]\n\n[resource]\n_data = ${CURVE_DATA}\n`),
  [GRADIENT_PATH]: parseTresFile(
    `[gd_resource type="Gradient" format=3]\n\n[resource]\n` +
      Object.entries(GRADIENT_DATA)
        .map(([name, value]) => `${name} = ${value}\n`)
        .join('')
  ),
});

function sceneOf(internalResources: TscnInternalResource[], externalResources = EXTERNAL): SceneResources {
  return { internalResources, externalResources };
}

function params(
  overrides: Partial<Record<EnumValue<typeof CPUParticlesParameter>, string>> = {}
): ParticleParam[] {
  return Array.from({ length: CPU_PARTICLES_2D_PARAM_COUNT }, (_, i) => {
    const curve = overrides[i as EnumValue<typeof CPUParticlesParameter>];
    return curve ? { min: 0, max: 1, curve } : { min: 0, max: 1 };
  });
}

describe('resolveParticleCurves', () => {
  it('decodes the Curve a parameter slot names (happy path)', () => {
    const curves = resolveParticleCurves(
      params({ [CPUParticlesParameter.SCALE]: 'SubResource("4")' }),
      sceneOf([CURVE]),
      NO_FILES
    );
    expect(curves[CPUParticlesParameter.SCALE]?.points).toHaveLength(2);
  });

  it('decodes the Curve a parameter slot names as a loaded .tres', () => {
    const curves = resolveParticleCurves(
      params({ [CPUParticlesParameter.SCALE]: 'ExtResource("7_curve")' }),
      sceneOf([]),
      loadedFile
    );
    expect(curves[CPUParticlesParameter.SCALE]?.points).toHaveLength(2);
  });

  it('leaves a slot null while its .tres has not loaded', () => {
    const curves = resolveParticleCurves(
      params({ [CPUParticlesParameter.SCALE]: 'ExtResource("7_curve")' }),
      sceneOf([]),
      NO_FILES
    );
    expect(curves[CPUParticlesParameter.SCALE]).toBeNull();
  });

  it('leaves every unreferenced slot null and keeps the array full length', () => {
    const curves = resolveParticleCurves(
      params({ [CPUParticlesParameter.SCALE]: 'SubResource("4")' }),
      sceneOf([CURVE]),
      NO_FILES
    );
    expect(curves).toHaveLength(CPU_PARTICLES_2D_PARAM_COUNT);
    expect(curves.filter((c) => c !== null)).toHaveLength(1);
  });

  it('yields null for a reference the scene does not define (error path)', () => {
    const curves = resolveParticleCurves(
      params({ [CPUParticlesParameter.DAMPING]: 'SubResource("missing")' }),
      sceneOf([CURVE]),
      NO_FILES
    );
    expect(curves[CPUParticlesParameter.DAMPING]).toBeNull();
  });

  it('yields an all-null array for an empty resource table (edge case)', () => {
    const curves = resolveParticleCurves(params(), NO_RESOURCES, NO_FILES);
    expect(curves.every((c) => c === null)).toBe(true);
  });
});

describe('resolveParticleGradient', () => {
  it('decodes a Gradient sub-resource (happy path)', () => {
    const gradient = resolveParticleGradient('SubResource("2")', sceneOf([GRADIENT]), NO_FILES);
    expect(gradient?.stops).toHaveLength(2);
    expect(gradient?.stops[0]!.color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('decodes a Gradient the scene loads from a .tres', () => {
    const gradient = resolveParticleGradient('ExtResource("8_ramp")', sceneOf([]), loadedFile);
    expect(gradient?.stops[1]!.color).toEqual({ r: 0, g: 0, b: 1, a: 1 });
  });

  it('returns null while the .tres has not loaded', () => {
    expect(resolveParticleGradient('ExtResource("8_ramp")', sceneOf([]), NO_FILES)).toBeNull();
  });

  it('returns null when the reference names a non-Gradient resource (error path)', () => {
    expect(resolveParticleGradient('SubResource("4")', sceneOf([CURVE]), NO_FILES)).toBeNull();
  });

  it('returns null for an absent reference (edge case)', () => {
    expect(resolveParticleGradient(undefined, sceneOf([GRADIENT]), NO_FILES)).toBeNull();
  });
});

describe('particleFiles', () => {
  const ramps = { color_ramp: 'ExtResource("8_ramp")', color_initial_ramp: 'SubResource("2")' };

  it('names the .tres each curve slot and ramp loads from', () => {
    const files = particleFiles(
      {
        params: params({
          [CPUParticlesParameter.SCALE]: 'ExtResource("7_curve")',
          [CPUParticlesParameter.DAMPING]: 'ExtResource("7_curve")',
        }),
        ...ramps,
      },
      sceneOf([GRADIENT])
    );
    expect(files).toEqual([CURVE_PATH, CURVE_PATH, GRADIENT_PATH]);
  });

  it('names no file for SubResource references or none', () => {
    expect(particleFiles({ params: params() }, sceneOf([CURVE, GRADIENT]))).toEqual([]);
  });
});
