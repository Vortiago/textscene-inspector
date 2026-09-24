/** `createExternalStore`: a change re-renders only the consumer that reads the value. */
import { describe, expect, it, vi } from 'vitest';
import { createExternalStore } from './createExternalStore';

describe('createExternalStore', () => {
  it('get() returns the initial value', () => {
    const store = createExternalStore<string | null>(null);
    expect(store.get()).toBeNull();
  });

  it('set() updates the value read back by get()', () => {
    const store = createExternalStore<string | null>(null);
    store.set('Root/Cube');
    expect(store.get()).toBe('Root/Cube');
  });

  it('notifies subscribers when the value changes', () => {
    const store = createExternalStore<string | null>(null);
    const listener = vi.fn();
    store.subscribe(listener);
    store.set('Root/Cube');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does NOT notify subscribers when set() is called with an unchanged value (Object.is)', () => {
    const store = createExternalStore<string | null>('Root/Cube');
    const listener = vi.fn();
    store.subscribe(listener);
    store.set('Root/Cube');
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops notifying a subscriber after it unsubscribes', () => {
    const store = createExternalStore<string | null>(null);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set('Root/Cube');
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple independent subscribers', () => {
    const store = createExternalStore<number>(0);
    const a = vi.fn();
    const b = vi.fn();
    store.subscribe(a);
    store.subscribe(b);
    store.set(1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('two stores created independently do not share state', () => {
    const storeA = createExternalStore<string | null>(null);
    const storeB = createExternalStore<string | null>(null);
    storeA.set('A');
    expect(storeA.get()).toBe('A');
    expect(storeB.get()).toBeNull();
  });
});
