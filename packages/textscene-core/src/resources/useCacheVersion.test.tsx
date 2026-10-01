import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { useCacheVersion } from './useCacheVersion';
import type { ResourceLoader } from './ResourceLoader';

function mount(busTypes: Parameters<typeof useCacheVersion>[1], read?: string[]) {
  const fake = createFakeResourceLoader();
  const readKeys = read ? { current: new Set(read) } : undefined;
  const hook = renderHook(() => useCacheVersion(fake.loader as ResourceLoader, busTypes, readKeys));
  return { fake, hook };
}

describe('useCacheVersion', () => {
  it('moves on when a listed bus loads or fails a key', () => {
    const { fake, hook } = mount(['theme', 'font']);
    const start = hook.result.current;

    act(() => fake.themes._resolve('res://ui.tres', {} as never));
    const afterLoad = hook.result.current;
    act(() => fake.fonts._fail('res://a.ttf', 'gone'));

    expect(afterLoad).toBeGreaterThan(start);
    expect(hook.result.current).toBeGreaterThan(afterLoad);
  });

  it('requests an invalidated key it read again, and keeps its version until the value arrives', () => {
    const { fake, hook } = mount(['theme'], ['res://ui.tres']);
    const request = vi.fn();
    fake.themes.setRequestImpl(request);
    const start = hook.result.current;

    act(() => fake.eventBus.emit('theme', 'invalidated', 'res://ui.tres'));

    expect(request).toHaveBeenCalledWith('res://ui.tres');
    expect(hook.result.current).toBe(start);
  });

  it('moves on when another key loads while one it requested again is still loading', () => {
    const { fake, hook } = mount(['theme', 'font'], ['res://ui.tres']);
    fake.themes.setRequestImpl(() => {});
    const start = hook.result.current;

    act(() => fake.eventBus.emit('theme', 'invalidated', 'res://ui.tres'));
    act(() => fake.fonts._resolve('res://body.ttf', {} as never));

    expect(hook.result.current).toBeGreaterThan(start);
  });

  it('moves on when a key it requested again fails', () => {
    const { fake, hook } = mount(['theme'], ['res://ui.tres']);
    const start = hook.result.current;

    act(() => fake.eventBus.emit('theme', 'invalidated', 'res://ui.tres'));
    act(() => fake.themes._fail('res://ui.tres', 'gone'));

    expect(hook.result.current).toBeGreaterThan(start);
  });

  it('leaves an invalidated key it never read alone', () => {
    const { fake } = mount(['theme'], ['res://ui.tres']);
    const request = vi.fn();
    fake.themes.setRequestImpl(request);

    act(() => fake.eventBus.emit('theme', 'invalidated', 'res://other.tres'));

    expect(request).not.toHaveBeenCalled();
  });

  it('requests nothing without a read set, for a reader whose keys useResource requests', () => {
    const { fake } = mount(['theme']);
    const request = vi.fn();
    fake.themes.setRequestImpl(request);

    act(() => fake.eventBus.emit('theme', 'invalidated', 'res://ui.tres'));

    expect(request).not.toHaveBeenCalled();
  });

  it('ignores a bus it does not list', () => {
    const { fake, hook } = mount(['theme']);
    const start = hook.result.current;

    act(() => fake.glbMeshes._resolve('res://prop.glb', {} as never));

    expect(hook.result.current).toBe(start);
  });

  it('leaves no handler behind when it unmounts', () => {
    const { fake, hook } = mount(['theme', 'font']);

    hook.unmount();

    expect(fake.eventBus.getTotalHandlerCount()).toBe(0);
  });

  it('stays at its first version without a loader', () => {
    const hook = renderHook(() => useCacheVersion(null, ['theme']));

    expect(hook.result.current).toBe(0);
  });
});
