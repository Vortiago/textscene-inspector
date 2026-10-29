/**
 * A GradientTexture2D or NoiseTexture names its Gradient and FastNoiseLite as a saved `.tres`, which
 * Godot loads as it does a sub-resource. The Texture2D and Texture3D slots draw the same pixels
 * for either form of the reference.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { parseTresFile } from '../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import type { ResourceLoader } from './ResourceLoader';
import { createFakeResourceLoader, withJobRunner } from './testing/createFakeResourceLoader';
import { resetProceduralTextures } from './textures/proceduralBuilds';
import { useTexture2D } from './useTexture2D';
import { useTexture3D } from './useTexture3D';

const GRADIENT_COLORS = 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)';
const GRADIENT_TRES = `[gd_resource type="Gradient" format=3]

[resource]
colors = ${GRADIENT_COLORS}
`;
const NOISE_TRES = `[gd_resource type="FastNoiseLite" format=3]

[resource]
seed = 7
frequency = 0.05
`;

const EXTERNAL: TscnExternalResource[] = [
  { id: '1', type: 'Gradient', path: 'res://ramp.tres' },
  { id: '2', type: 'FastNoiseLite', path: 'res://noise.tres' },
];

const GRADIENT_TEXTURE = 'SubResource("GradientTexture2D_a")';
const NOISE_TEXTURE = 'SubResource("NoiseTexture2D_a")';
const NOISE_VOLUME = 'SubResource("NoiseTexture3D_a")';

/** The scene's textures, naming their Gradient and FastNoiseLite through `gradient` and `noise`. */
function sceneWith(sources: { gradient: string; noise: string; colorRamp: string }): TscnInternalResource[] {
  return [
    {
      id: 'GradientTexture2D_a',
      type: 'GradientTexture2D',
      data: { gradient: sources.gradient, width: '2', height: '1' },
    },
    {
      id: 'NoiseTexture2D_a',
      type: 'NoiseTexture2D',
      data: { noise: sources.noise, color_ramp: sources.colorRamp, width: '4', height: '4' },
    },
    {
      id: 'NoiseTexture3D_a',
      type: 'NoiseTexture3D',
      data: { noise: sources.noise, color_ramp: sources.colorRamp, width: '4', height: '4', depth: '2' },
    },
    { id: 'Gradient_a', type: 'Gradient', data: { colors: GRADIENT_COLORS } },
    { id: 'FastNoiseLite_a', type: 'FastNoiseLite', data: { seed: '7', frequency: '0.05' } },
  ];
}

const INLINE = sceneWith({
  gradient: 'SubResource("Gradient_a")',
  noise: 'SubResource("FastNoiseLite_a")',
  colorRamp: 'SubResource("Gradient_a")',
});
const SAVED = sceneWith({
  gradient: 'ExtResource("1")',
  noise: 'ExtResource("2")',
  colorRamp: 'ExtResource("1")',
});

function wrapperFor(loader: ResourceLoader) {
  return ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={loader}>{children}</ResourceLoaderProvider>
  );
}

/** A job runner that records each job a slot starts and never finishes it. */
function recordingRunner() {
  const jobs: Array<{ name: string; input: unknown }> = [];
  const run = (name: string, input: unknown) => {
    jobs.push({ name, input });
    return new Promise<never>(() => {});
  };
  return { jobs, runner: { run } as unknown as ResourceLoader['jobRunner'] };
}

/** The one job a slot starts on an empty procedural cache, or undefined when it starts none. */
/** Resets per call: the inline and the saved run must not share a cache entry. */
function jobStartedBy(slot: () => unknown) {
  resetProceduralTextures();
  const { wrapper, jobs } = setUp();
  renderHook(slot, { wrapper });
  return jobs[0];
}

function setUp() {
  const fake = createFakeResourceLoader();
  fake.resources.seed('res://ramp.tres', parseTresFile(GRADIENT_TRES));
  fake.resources.seed('res://noise.tres', parseTresFile(NOISE_TRES));
  const { jobs, runner } = recordingRunner();
  const loader = withJobRunner(fake, runner);
  return { fake, wrapper: wrapperFor(loader), jobs };
}

function pixels(texture: THREE.Texture | null): number[] {
  return Array.from((texture as THREE.DataTexture).image.data as ArrayLike<number>);
}

beforeEach(resetProceduralTextures);
afterEach(resetProceduralTextures);

describe('a Texture2D slot with a saved Gradient or FastNoiseLite', () => {
  it('draws a GradientTexture2D whose gradient is an ExtResource as it draws the SubResource form', () => {
    const { wrapper } = setUp();
    const inline = renderHook(() => useTexture2D(GRADIENT_TEXTURE, [], INLINE), { wrapper });
    const saved = renderHook(() => useTexture2D(GRADIENT_TEXTURE, EXTERNAL, SAVED), { wrapper });

    expect(pixels(saved.result.current.texture)).toEqual(pixels(inline.result.current.texture));
    expect(saved.result.current.missing).toBe(false);
  });

  it('builds a NoiseTexture2D whose noise and color_ramp are ExtResources from the content of the SubResource form', () => {
    const inline = jobStartedBy(() => useTexture2D(NOISE_TEXTURE, [], INLINE));
    const saved = jobStartedBy(() => useTexture2D(NOISE_TEXTURE, EXTERNAL, SAVED));

    expect(saved).toEqual(inline);
    expect(saved).toMatchObject({
      name: 'noise-texture-2d',
      input: { colorRamp: { stops: expect.any(Array) } },
    });
  });

  it('draws nothing, and is not missing, while the saved Gradient loads', () => {
    const fake = createFakeResourceLoader();
    const wrapper = wrapperFor(fake.loader);
    const { result } = renderHook(() => useTexture2D(GRADIENT_TEXTURE, EXTERNAL, SAVED), { wrapper });

    expect(result.current).toMatchObject({ texture: null, missing: false, isArriving: true });

    act(() => fake.resources._resolve('res://ramp.tres', parseTresFile(GRADIENT_TRES)));

    expect(result.current).toMatchObject({ texture: expect.any(THREE.DataTexture), missing: false });
  });

  it('draws a new Gradient when the saved file reloads with other colours', () => {
    const { fake, wrapper } = setUp();
    const { result } = renderHook(() => useTexture2D(GRADIENT_TEXTURE, EXTERNAL, SAVED), { wrapper });
    const before = pixels(result.current.texture);

    const green = GRADIENT_TRES.replace(GRADIENT_COLORS, 'PackedColorArray(0, 1, 0, 1, 0, 1, 0, 1)');
    act(() => fake.resources._resolve('res://ramp.tres', parseTresFile(green)));

    expect(pixels(result.current.texture)).not.toEqual(before);
  });

  it('draws nothing for a saved file that is no Gradient (error path)', () => {
    const { fake, wrapper } = setUp();
    fake.resources.seed('res://ramp.tres', parseTresFile(NOISE_TRES));
    const { result } = renderHook(() => useTexture2D(GRADIENT_TEXTURE, EXTERNAL, SAVED), { wrapper });

    expect(result.current.texture).toBeNull();
  });
});

describe('a Texture3D slot with a saved Gradient or FastNoiseLite', () => {
  it('builds a NoiseTexture3D whose noise and color_ramp are ExtResources from the content of the SubResource form', () => {
    const inline = jobStartedBy(() =>
      useTexture3D(NOISE_VOLUME, { externalResources: [], internalResources: INLINE })
    );
    const saved = jobStartedBy(() =>
      useTexture3D(NOISE_VOLUME, { externalResources: EXTERNAL, internalResources: SAVED })
    );

    expect(saved).toEqual(inline);
    expect(saved).toMatchObject({
      name: 'noise-texture-3d',
      input: { colorRamp: { stops: expect.any(Array) } },
    });
  });
});
