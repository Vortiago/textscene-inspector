/**
 * The live-tree readers re-derive on this version. A scene or GLB that loads or fails
 * moves it, so a deleted instanced scene leaves the tree. An `invalidated` key does
 * not, since its cache entry is gone until the reload lands.
 */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import type { ResourceLoader } from '../resources/ResourceLoader';
import { useLiveTreeVersion } from './useLiveSceneTree';

function mount() {
  const fake = createFakeResourceLoader();
  const hook = renderHook(() => useLiveTreeVersion(fake.loader as ResourceLoader));
  return { fake, hook };
}

describe('useLiveTreeVersion', () => {
  it.each(['scene', 'glb'] as const)('moves when a %s loads', (bus) => {
    const { fake, hook } = mount();
    const start = hook.result.current;

    act(() => fake.eventBus.emit(bus, 'loaded', 'res://sub.tscn', {}));

    expect(hook.result.current).toBeGreaterThan(start);
  });

  it.each(['scene', 'glb'] as const)(
    'moves when a %s fails, so a deleted instance leaves the tree',
    (bus) => {
      const { fake, hook } = mount();
      const start = hook.result.current;

      act(() => fake.eventBus.emit(bus, 'failed', 'res://sub.tscn', new Error('gone')));

      expect(hook.result.current).toBeGreaterThan(start);
    }
  );

  it('stays while a scene is invalidated and reloading', () => {
    const { fake, hook } = mount();
    const start = hook.result.current;

    act(() => fake.eventBus.emit('scene', 'invalidated', 'res://sub.tscn'));

    expect(hook.result.current).toBe(start);
  });

  it('leaves no handler behind when it unmounts', () => {
    const { fake, hook } = mount();

    hook.unmount();

    expect(fake.eventBus.getTotalHandlerCount()).toBe(0);
  });
});
