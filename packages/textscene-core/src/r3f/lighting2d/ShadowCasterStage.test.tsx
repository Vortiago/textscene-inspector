/**
 * The once-per-frame world snapshot of the occluders.
 *
 * The contract has two halves: the snapshot must FOLLOW the world matrices
 * (which are not React values, so nothing re-renders when an occluder moves),
 * and it must be REFERENTIALLY STABLE while nothing moves — a light memoises its
 * shadow geometry on it, so a new array every frame would rebuild every
 * volume in the scene 60 times a second.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import {
  sameWorldCasters,
  ShadowCasterStage,
  useWorldShadowCasters,
} from './ShadowCasterStage';
import { useShadowCaster } from './shadowCasterRegistry';
import { OCCLUDER_CULL_CLOCKWISE, OCCLUDER_CULL_DISABLED } from './shadowVolumes';
import type { WorldShadowCaster } from './shadowCasterRegistry';

function world(
  segments: number[],
  overrides: Partial<WorldShadowCaster> = {}
): WorldShadowCaster {
  return {
    segments: new Float32Array(segments),
    cullMode: OCCLUDER_CULL_DISABLED,
    occluderLightMask: 1,
    ...overrides,
  };
}

describe('sameWorldCasters', () => {
  it('holds for two flattens of the same unmoved occluder', () => {
    expect(sameWorldCasters([world([0, 0, 10, 0])], [world([0, 0, 10, 0])])).toBe(true);
  });

  it('holds for two empty snapshots', () => {
    expect(sameWorldCasters([], [])).toBe(true);
  });

  it('breaks on a moved coordinate', () => {
    expect(sameWorldCasters([world([0, 0, 10, 0])], [world([0, 0, 10, 1])])).toBe(false);
  });

  it('breaks when an occluder is added or withdrawn', () => {
    expect(sameWorldCasters([], [world([0, 0, 10, 0])])).toBe(false);
    expect(sameWorldCasters([world([0, 0, 10, 0])], [])).toBe(false);
  });

  it('breaks on a changed cull mode, which flips which edges cast', () => {
    expect(
      sameWorldCasters(
        [world([0, 0, 10, 0])],
        [world([0, 0, 10, 0], { cullMode: OCCLUDER_CULL_CLOCKWISE })]
      )
    ).toBe(false);
  });

  it('breaks on a changed occluder_light_mask, which flips which lights see it', () => {
    expect(
      sameWorldCasters([world([0, 0, 10, 0])], [world([0, 0, 10, 0], { occluderLightMask: 2 })])
    ).toBe(false);
  });

  it('breaks when the polygon gains a point', () => {
    expect(sameWorldCasters([world([0, 0, 10, 0])], [world([0, 0, 10, 0, 10, 5])])).toBe(false);
  });
});

/** Publishes one caster and reports every snapshot the stage handed it. */
function Probe({
  object,
  seen,
}: {
  object: THREE.Object3D;
  seen: (readonly WorldShadowCaster[])[];
}) {
  useShadowCaster({
    segments: new Float32Array([0, 0, 0, 10, 0, 0]),
    cullMode: OCCLUDER_CULL_DISABLED,
    occluderLightMask: 1,
    object,
  });
  seen.push(useWorldShadowCasters());
  return null;
}

async function mountStage(object: THREE.Object3D) {
  const seen: (readonly WorldShadowCaster[])[] = [];
  const renderer = await ReactThreeTestRenderer.create(
    <ShadowCasterStage>
      <Probe object={object} seen={seen} />
    </ShadowCasterStage>
  );
  return { renderer, seen };
}

/**
 * `advanceFrames` invokes the frame callbacks but leaves React's own work
 * queued, so the state a snapshot publishes only reaches the tree inside `act`.
 */
async function frames(renderer: Awaited<ReturnType<typeof mountStage>>['renderer'], count = 1) {
  await ReactThreeTestRenderer.act(async () => {
    await renderer.advanceFrames(count, 16);
  });
}

describe('ShadowCasterStage', () => {
  it('publishes the world flatten during mount, before any frame runs', async () => {
    // A still capture never advances the loop far, and the previewer draws one
    // frame per pan step; waiting for a frame would mean the first one is
    // shadowless. The local matrices are committed by layout time, which is all
    // `updateWorldMatrix` needs.
    const object = new THREE.Group();
    object.position.set(100, -50, 0);
    const { seen } = await mountStage(object);
    const casters = seen.at(-1)!;
    expect(casters).toHaveLength(1);
    // Local (0,0)–(10,0) placed at (100,-50): the flatten drops the z and pairs
    // the points as `[ax,ay, bx,by]`.
    expect([...casters[0]!.segments]).toEqual([100, -50, 110, -50]);
  });

  it('hands back the SAME array while nothing moves', async () => {
    const { renderer, seen } = await mountStage(new THREE.Group());
    await frames(renderer);
    const first = seen.at(-1);
    await frames(renderer, 3);
    expect(seen.at(-1)).toBe(first);
  });

  it('republishes once the occluder is moved by something React never saw', async () => {
    const object = new THREE.Group();
    const { renderer, seen } = await mountStage(object);
    await frames(renderer);
    const before = seen.at(-1)!;

    object.position.set(7, 0, 0);
    await frames(renderer, 2);
    const after = seen.at(-1)!;
    expect(after).not.toBe(before);
    expect([...after[0]!.segments]).toEqual([7, 0, 17, 0]);
  });

  it('drops an occluder hidden by an ancestor', async () => {
    const root = new THREE.Group();
    const object = new THREE.Group();
    root.add(object);
    const { renderer, seen } = await mountStage(object);
    await frames(renderer);
    expect(seen.at(-1)).toHaveLength(1);

    root.visible = false;
    await frames(renderer, 2);
    expect(seen.at(-1)).toEqual([]);
  });
});
