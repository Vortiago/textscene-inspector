/**
 * The keyed store an AnimationPlayer pushes sampled values through. A listener hears every write to
 * its key, and a release is null.
 */
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createPushStore, createPushStoreContext } from './pushStore';

describe('createPushStore', () => {
  it('hands a pushed value to every listener of that key, and to no other key', () => {
    const store = createPushStore<number[]>();
    const first = vi.fn();
    const second = vi.fn();
    const other = vi.fn();
    store.subscribe('a', first);
    store.subscribe('a', second);
    store.subscribe('b', other);

    store.set('a', [1]);

    expect(first).toHaveBeenCalledWith([1]);
    expect(second).toHaveBeenCalledWith([1]);
    expect(other).not.toHaveBeenCalled();
  });

  it('hands the pushed value to a listener that subscribes later', () => {
    const store = createPushStore<number[]>();
    store.set('a', [1]);
    const late = vi.fn();

    store.subscribe('a', late);

    expect(late).toHaveBeenCalledWith([1]);
  });

  it('releases with null, which listeners see and later listeners do not get', () => {
    const store = createPushStore<number[]>();
    const listener = vi.fn();
    const late = vi.fn();
    store.subscribe('a', listener);
    store.set('a', [1]);

    store.set('a', null);
    store.subscribe('a', late);

    expect(listener).toHaveBeenLastCalledWith(null);
    expect(late).not.toHaveBeenCalled();
  });

  it('stops pushing to a listener that unsubscribed, and keeps the others', () => {
    const store = createPushStore<number[]>();
    const gone = vi.fn();
    const kept = vi.fn();
    const unsubscribe = store.subscribe('a', gone);
    store.subscribe('a', kept);

    unsubscribe();
    store.set('a', [1]);

    expect(gone).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledWith([1]);
  });

  it('lets a stale unsubscribe leave a listener that subscribed after it (edge case)', () => {
    const store = createPushStore<number[]>();
    const stale = vi.fn();
    const current = vi.fn();
    const unsubscribeStale = store.subscribe('a', stale);
    store.subscribe('a', current);

    unsubscribeStale();
    unsubscribeStale();
    store.set('a', [1]);

    expect(current).toHaveBeenCalledWith([1]);
  });
});

describe('createPushStoreContext', () => {
  const { Provider, useStore } = createPushStoreContext<string>('TestPushContext');

  it('is a store that reaches no one outside a provider, and never throws', () => {
    const { result } = renderHook(useStore);

    expect(() => result.current.set('a', 'x')).not.toThrow();
    const late = vi.fn();
    result.current.subscribe('a', late);
    expect(late).not.toHaveBeenCalled();
  });

  it('gives every reader below a provider the same store', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <Provider>{children}</Provider>;
    const { result } = renderHook(() => [useStore(), useStore()] as const, { wrapper });
    const listener = vi.fn();

    result.current[0].subscribe('a', listener);
    result.current[1].set('a', 'x');

    expect(listener).toHaveBeenCalledWith('x');
  });
});
