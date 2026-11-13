/**
 * The async seam for procedural textures: a lookup is ready from the cache, or
 * pending with a build that holders start and release. Builds are keyed on their
 * content, so a new decoded value with unchanged content reuses the texture.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as logger from '../../logger';
import { NOISE_PIXEL_CASES } from './noisetexture2d/pixelCases.testkit';
import type { WorkerJobOutput } from '../../workers/jobs';
import { fakeJobRunner as fakeRunner } from '../../workers/fakeJobRunner.testkit';
import { pinProceduralTexture, unpinProceduralTexture } from './proceduralTextureCache';
import {
  resetProceduralTextures,
  proceduralBuild,
  type ProceduralBuildPlan,
  type ProceduralTextureLookup,
} from './proceduralBuilds';
import { textureWork } from './textureWork';

const [pixelCase] = NOISE_PIXEL_CASES;
if (!pixelCase) throw new Error('expected a noise pixel case');

/** A decoded fake texture whose `seed` is its whole content. Each call is a new decoded value. */
interface FakeTexture {
  readonly seed: string;
}
const scene = (seed: string): FakeTexture => ({ seed });

const plan = ({ seed }: FakeTexture): ProceduralBuildPlan<'noise-texture-2d'> | null =>
  seed === 'declined'
    ? null
    : {
        job: 'noise-texture-2d',
        input: pixelCase,
        contentKey: `FakeTexture:${seed}`,
        wrap: ({ levels }) => new THREE.DataTexture(levels[0]!.data, 1, 1),
      };

function lookup(texture: FakeTexture): ProceduralTextureLookup | null {
  return proceduralBuild('FakeTexture', plan(texture));
}

function pendingLookup(texture: FakeTexture) {
  const found = lookup(texture);
  if (found?.status !== 'pending') throw new Error(`expected a pending lookup, got ${found?.status}`);
  return found;
}

function output(): WorkerJobOutput<'noise-texture-2d'> {
  return { levels: [{ data: new Uint8Array(4), width: 1, height: 1 }] };
}

/** Lets microtasks and promise callbacks run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
});
afterEach(async () => {
  resetProceduralTextures();
  await settle();
  warn.mockRestore();
  resetProceduralTextures();
});

describe('proceduralBuild', () => {
  it('is pending for an unbuilt texture, then ready with the built texture', async () => {
    const { runner, runs } = fakeRunner();
    const texture = scene('1');
    const handle = pendingLookup(texture).start(runner);
    runs[0]?.resolve(output());
    const built = await handle.settled;
    handle.release();

    const ready = lookup(texture);
    expect(ready).toMatchObject({ status: 'ready', key: 'FakeTexture:1' });
    expect(ready?.status === 'ready' && ready.texture).toBe(built);
  });

  it('runs one build for two holders of the same texture', () => {
    const { runner, runs } = fakeRunner();
    pendingLookup(scene('1')).start(runner);
    pendingLookup(scene('1')).start(runner);

    expect(runs).toHaveLength(1);
  });

  it('reuses a built texture for a new decoded value whose content is unchanged', async () => {
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

  it('abandons a held build when the cache resets, so the next holder builds afresh', async () => {
    const { runner, runs } = fakeRunner();
    const handle = pendingLookup(scene('1')).start(runner);
    resetProceduralTextures();

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
    expect(textureWork.pending()).toBe(1);
    runs[0]?.resolve(output());
    await handle.settled;

    expect(textureWork.pending()).toBe(0);
  });

  it('stops counting an aborted build', async () => {
    const { runner } = fakeRunner();
    pendingLookup(scene('1')).start(runner).release();
    await settle();

    expect(textureWork.pending()).toBe(0);
  });

  it('settles null, with a warning, when the pixels cannot be allocated', async () => {
    const { runner, runs } = fakeRunner();
    const handle = pendingLookup(scene('1')).start(runner);
    runs[0]?.reject(new RangeError('Array buffer allocation failed'));

    expect(await handle.settled).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[FakeTexture]'));
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

  it('declines what the plan declines', () => {
    expect(lookup(scene('declined'))).toBeNull();
  });
});

describe('a plan with a derived texture', () => {
  /** The built texture, then `derive` of it: the texture a holder that wants more draws. */
  const derivedPlan = (texture: FakeTexture, derive: (built: THREE.Texture) => THREE.Texture) => {
    const built = plan(texture);
    return built && { ...built, derived: { suffix: ':derived', derive } };
  };

  const cloned = (built: THREE.Texture) => built.clone();

  function derivedLookup(texture: FakeTexture, derive = cloned) {
    return proceduralBuild('FakeTexture', derivedPlan(texture, derive));
  }

  function pendingDerived(texture: FakeTexture, derive = cloned) {
    const found = derivedLookup(texture, derive);
    if (found?.status !== 'pending') throw new Error(`expected a pending lookup, got ${found?.status}`);
    return found;
  }

  it('keys the derived texture apart from the built one', () => {
    expect([pendingDerived(scene('1')).key, pendingLookup(scene('1')).key]).toEqual([
      'FakeTexture:1:derived',
      'FakeTexture:1',
    ]);
  });

  it('settles on the derived texture, and caches the built one beside it', async () => {
    const { runner, runs } = fakeRunner();
    const texture = scene('1');
    const handle = pendingDerived(texture).start(runner);
    runs[0]?.resolve(output());
    const derived = await handle.settled;

    const built = lookup(scene('1'));
    expect(built?.status === 'ready' && built.texture).not.toBe(derived);
    expect(derivedLookup(texture)).toMatchObject({ status: 'ready', texture: derived });
  });

  it('derives from the cached built texture without a run when only the derivation is new', async () => {
    const { runner, runs } = fakeRunner();
    const first = pendingLookup(scene('1')).start(runner);
    runs[0]?.resolve(output());
    const built = await first.settled;
    const derive = vi.fn(cloned);

    const handle = pendingDerived(scene('1'), derive).start(runner);
    await handle.settled;

    expect(runs).toHaveLength(1);
    expect(derive).toHaveBeenCalledWith(built);
  });

  it('runs one build for a holder that derives and a holder that does not', async () => {
    const { runner, runs } = fakeRunner();
    const withDerived = pendingDerived(scene('1')).start(runner);
    const without = pendingLookup(scene('1')).start(runner);
    runs[0]?.resolve(output());

    expect(runs).toHaveLength(1);
    expect(await withDerived.settled).not.toBe(await without.settled);
  });

  it('derives once for two holders of the same derived texture', async () => {
    const { runner, runs } = fakeRunner();
    const derive = vi.fn(cloned);
    const first = pendingDerived(scene('1'), derive).start(runner);
    const second = pendingDerived(scene('1'), derive).start(runner);
    runs[0]?.resolve(output());

    expect(await first.settled).toBe(await second.settled);
    expect(derive).toHaveBeenCalledTimes(1);
  });

  it('settles null, with a warning, when the derived texture cannot be allocated', async () => {
    const { runner, runs } = fakeRunner();
    const handle = pendingDerived(scene('1'), () => {
      throw new RangeError('Array buffer allocation failed');
    }).start(runner);
    runs[0]?.resolve(output());

    expect(await handle.settled).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});
