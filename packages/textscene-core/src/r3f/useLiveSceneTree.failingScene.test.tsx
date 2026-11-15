/** An instance of a scene Godot fails to load is a failed instance, as one of a missing scene. */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext.js';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader.js';
import { makeNode } from '../parser/testing/parserKit.js';
import type { TscnExternalResource, TscnScene } from '../parser/types.js';
import { useInstancedScene } from './hooks/useInstancedScene.js';
import { useLiveStepOf } from './useLiveSceneTree.js';
import { INSTANTIABLE_SCENE } from '../parser/sceneDefaults.testkit';
import type { LoadOutcome } from '../resources/loadFailure/loadOutcome.js';
import '../nodes/node/index';

const KID = 'res://kid.tscn';
const externalResources: TscnExternalResource[] = [{ id: '1', path: KID, type: 'PackedScene' }];
const scope = { externalResources, internalResources: [] };
const instance = makeNode('Kid', 'Node2D', { instance: 'ExtResource("1")' });
const kid: TscnScene = {
  ...INSTANTIABLE_SCENE,
  nodes: [makeNode('Kid', 'Sprite2D')],
  externalResources: [],
  internalResources: [],
};
const FAILS: LoadOutcome = { isFailed: true, chain: [KID, 'res://gone.png'], cause: 'missing' };

function mount() {
  const fake = createFakeResourceLoader();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
  );
  const hook = renderHook(
    () => ({
      step: useLiveStepOf(instance, scope),
      scene: useInstancedScene('ExtResource("1")', externalResources, KID),
    }),
    { wrapper }
  );
  act(() => fake.scenes._resolve(KID, kid));
  return { fake, hook };
}

describe('an instance of a scene Godot fails to load', () => {
  it('is a failed instance in the live tree', () => {
    const { fake, hook } = mount();

    act(() => fake.loadOutcomes._resolve(KID, FAILS));

    expect([hook.result.current.step.isMerged, hook.result.current.step.isFailedInstance]).toEqual([
      false,
      true,
    ]);
  });

  it('reads as unavailable to the instancing node', () => {
    const { fake, hook } = mount();

    act(() => fake.loadOutcomes._resolve(KID, FAILS));

    expect(hook.result.current.scene.status).toBe('unavailable');
  });

  it('merges again once its outcome loads', () => {
    const { fake, hook } = mount();
    act(() => fake.loadOutcomes._resolve(KID, FAILS));

    act(() => fake.loadOutcomes._resolve(KID, { isFailed: false }));

    expect(hook.result.current.step.isMerged).toBe(true);
  });

  it('merges once its outcome loads after it failed before the scene arrived', () => {
    const fake = createFakeResourceLoader();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
    );
    const hook = renderHook(() => useLiveStepOf(instance, scope), { wrapper });
    act(() => fake.loadOutcomes._resolve(KID, FAILS));
    act(() => fake.scenes._resolve(KID, kid));

    act(() => fake.loadOutcomes._resolve(KID, { isFailed: false }));

    expect(hook.result.current.isMerged).toBe(true);
  });

  it('requests the outcome of a scene the tree reads, with no instancing node mounted', async () => {
    const fake = createFakeResourceLoader();
    const requested: string[] = [];
    fake.loadOutcomes.setRequestImpl((path) => requested.push(path));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
    );
    renderHook(() => useLiveStepOf(instance, scope), { wrapper });

    await act(async () => fake.scenes._resolve(KID, kid));

    expect(requested).toEqual([KID]);
  });
});
