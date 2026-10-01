/**
 * The async seam for procedural textures: a lookup is ready from the cache, or
 * pending with a build that holders start and release. Builds are keyed on their
 * content, so a re-parse that leaves a texture unchanged reuses it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as logger from '../../logger';
import type { TscnInternalResource } from '../../parser/types';
import { NOISE_PIXEL_CASES } from './noisetexture2d/pixelCases.testkit';
import type { WorkerJobOutput } from '../../workers/jobs';
import { fakeJobRunner as fakeRunner } from '../../workers/fakeJobRunner.testkit';
import {
  clearProceduralTextureCache,
  pinProceduralTexture,
  unpinProceduralTexture,
} from './proceduralTextureCache';
import {
  abortProceduralBuilds,
  resolveProceduralSubResourceAsync,
  type ProceduralBuildPlan,
  type ProceduralTextureLookup,
} from './proceduralBuilds';
import { pendingTextureWork } from './textureWork';

const [pixelCase] = NOISE_PIXEL_CASES;
if (!pixelCase) throw new Error('expected a noise pixel case');

/** One `Fake` sub-resource whose `seed` is its whole content. */
function scene(seed: string): TscnInternalResource[] {
  return [
    { id: 'tex', type: 'FakeTexture', data: { seed } },
    { id: 'other', type: 'OtherTexture', data: {} },
  ];
}

const plan = (properties: Record<string, string>): ProceduralBuildPlan | null =>
  properties.seed === 'declined'
    ? null
    : {
        job: 'noise-texture-2d',
        input: pixelCase,
        contentKey: `FakeTexture:${properties.seed}`,
        wrap: ({ pixels }) => new THREE.DataTexture(pixels, 1, 1),
      };

function lookup(
  resources: TscnInternalResource[],
  ref = 'SubResource("tex")'
): ProceduralTextureLookup | null {
  return resolveProceduralSubResourceAsync(ref, resources, 'FakeTexture', plan);
}

function pendingLookup(resources: TscnInternalResource[]) {
  const found = lookup(resources);
  if (found?.status !== 'pending') throw new Error(`expected a pending lookup, got ${found?.status}`);
  return found;
}

function output(): WorkerJobOutput<'noise-texture-2d'> {
  return { pixels: new Uint8Array(4) };
}

/** Lets microtasks and promise callbacks run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(async () => {
  abortProceduralBuilds();
  await settle();
  warn.mockRestore();
  clearProceduralTextureCache();
});

describe('resolveProceduralSubResourceAsync', () => {
  it('plans each sub-resource once per parse, however many consumers look it up', () => {
    const counted = vi.fn(plan);
    const resources = scene('1');
    resolveProceduralSubResourceAsync('SubResource("tex")', resources, 'FakeTexture', counted);
    resolveProceduralSubResourceAsync('SubResource("tex")', resources, 'FakeTexture', counted);
    expect(counted).toHaveBeenCalledTimes(1);

    resolveProceduralSubResourceAsync('SubResource("tex")', scene('1'), 'FakeTexture', counted);
    expect(counted).toHaveBeenCalledTimes(2);
  });

  it('is pending for an unbuilt texture, then ready with the built texture', async () => {
    const { runner, runs } = fakeRunner();
    const resources = scene('1');
    const handle = pendingLookup(resources).start(runner);
    runs[0]?.resolve(output());
    const built = await handle.settled;
    handle.release();

    const ready = lookup(resources);
    expect(ready).toMatchObject({ status: 'ready', key: 'FakeTexture:1' });
    expect(ready?.status === 'ready' && ready.texture).toBe(built);
  });

  it('runs one build for two holders of the same texture', () => {
    const { runner, runs } = fakeRunner();
    pendingLookup(scene('1')).start(runner);
    pendingLookup(scene('1')).start(runner);

    expect(runs).toHaveLength(1);
  });

  it('reuses a built texture across a re-parse whose content is unchanged', async () => {
    const { runner, runs } = fakeRunner();
    const handle = pendingLookup(scene('1')).start(runner);
    runs[0]?.resolve(output());
    const built = await handle.settled;

    const reparsed = lookup(scene('1'));
    expect(reparsed?.status === 'ready' && reparsed.texture).toBe(built);
    expect(runs).toHaveLength(1);
  });

  it('hands a holder that starts after the build landed the cached texture, without a second run', async () => {
    const { runner, runs } = fakeRunner();
    const early = pendingLookup(scene('1'));
    const late = pendingLookup(scene('1'));
    const handle = early.start(runner);
    runs[0]?.resolve(output());
    const built = await handle.settled;
    await settle();

    const lateHandle = late.start(runner);
    expect(await lateHandle.settled).toBe(built);
    expect(runs).toHaveLength(1);
  });

  it('builds again when the content changes', () => {
    expect(pendingLookup(scene('1')).key).not.toBe(pendingLookup(scene('2')).key);
  });

  it('aborts a build once its last holder releases it, and never caches the result', async () => {
    const { runner, runs } = fakeRunner();
    const handle = pendingLookup(scene('1')).start(runner);
    handle.release();
    await settle();

    expect(runs[0]?.signal?.aborted).toBe(true);
    expect(await handle.settled).toBeNull();
    pendingLookup(scene('1')).start(runner);
    expect(runs).toHaveLength(2);
  });

  it('keeps a build that is released and taken again in the same task', async () => {
    const { runner, runs } = fakeRunner();
    pendingLookup(scene('1')).start(runner).release();
    pendingLookup(scene('1')).start(runner);
    await settle();

    expect(runs).toHaveLength(1);
    expect(runs[0]?.signal?.aborted).toBe(false);
  });

  it('counts a build as texture work until it lands', async () => {
    const { runner, runs } = fakeRunner();
    const handle = pendingLookup(scene('1')).start(runner);
    expect(pendingTextureWork()).toBe(1);
    runs[0]?.resolve(output());
    await handle.settled;

    expect(pendingTextureWork()).toBe(0);
  });

  it('stops counting an aborted build', async () => {
    const { runner } = fakeRunner();
    pendingLookup(scene('1')).start(runner).release();
    await settle();

    expect(pendingTextureWork()).toBe(0);
  });

  it('settles null, with a warning, when the pixels cannot be allocated', async () => {
    const { runner, runs } = fakeRunner();
    const handle = pendingLookup(scene('1')).start(runner);
    runs[0]?.reject(new RangeError('Array buffer allocation failed'));

    expect(await handle.settled).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[FakeTexture] sub-resource "tex"'));
    expect(lookup(scene('1'))?.status).toBe('pending');
  });

  it('rejects on any other failure', async () => {
    const { runner, runs } = fakeRunner();
    const handle = pendingLookup(scene('1')).start(runner);
    runs[0]?.reject(new TypeError('bad input'));

    await expect(handle.settled).rejects.toBeInstanceOf(TypeError);
  });

  it('keeps a texture pinned while pending resident through a cache flood', async () => {
    const { runner, runs } = fakeRunner();
    const pending = pendingLookup(scene('1'));
    pinProceduralTexture(pending.key);
    const handle = pending.start(runner);
    runs[0]?.resolve(output());
    await handle.settled;
    for (let seed = 100; seed < 200; seed++) {
      const flood = pendingLookup(scene(String(seed))).start(runner);
      runs.at(-1)?.resolve(output());
      await flood.settled;
    }

    expect(lookup(scene('1'))?.status).toBe('ready');
    unpinProceduralTexture(pending.key);
  });

  it.each([
    ['an ExtResource ref', 'ExtResource("1")'],
    ['an unknown id', 'SubResource("missing")'],
    ['another type', 'SubResource("other")'],
    ['no ref', undefined],
  ])('declines %s', (_label, ref) => {
    expect(resolveProceduralSubResourceAsync(ref, scene('1'), 'FakeTexture', plan)).toBeNull();
  });

  it('declines what the plan declines', () => {
    expect(lookup(scene('declined'))).toBeNull();
  });
});
