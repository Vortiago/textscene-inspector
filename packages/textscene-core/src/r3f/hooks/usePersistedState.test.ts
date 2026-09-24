/**
 * `usePersistedState`. Writes are trailing-debounced and flushed on unmount, so timing-sensitive
 * cases run under fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { readPersisted, usePersistedState, writePersisted } from './usePersistedState';

const KEY = 'tsi.test.value';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

function flushDebounce() {
  act(() => {
    vi.runAllTimers();
  });
}

describe('usePersistedState', () => {
  it('starts at the default value when nothing is persisted', () => {
    const { result } = renderHook(() => usePersistedState(KEY, 42));
    expect(result.current[0]).toBe(42);
  });

  it('persists a new value to localStorage once the debounce window passes', () => {
    const { result } = renderHook(() => usePersistedState(KEY, 42));
    act(() => result.current[1](99));
    expect(result.current[0]).toBe(99); // state is immediate…
    flushDebounce();
    expect(window.localStorage.getItem(KEY)).toBe('99'); // …the write is trailing
  });

  it('coalesces a burst of updates (a splitter drag) into ONE trailing write', () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    const { result } = renderHook(() => usePersistedState(KEY, 0));
    for (let i = 1; i <= 25; i++) {
      act(() => result.current[1](i));
    }
    expect(setItem).not.toHaveBeenCalled(); // nothing lands mid-burst
    flushDebounce();
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(KEY)).toBe('25');
    setItem.mockRestore();
  });

  it('flushes a still-pending write on unmount (change then immediately close)', () => {
    const { result, unmount } = renderHook(() => usePersistedState(KEY, 42));
    act(() => result.current[1](7));
    unmount(); // debounce window has NOT passed
    expect(window.localStorage.getItem(KEY)).toBe('7');
  });

  it('flushes a still-pending write on pagehide (tab close / webview reload skips unmount)', () => {
    const { result } = renderHook(() => usePersistedState(KEY, 42));
    act(() => result.current[1](7));
    expect(window.localStorage.getItem(KEY)).toBeNull(); // still inside the debounce window
    window.dispatchEvent(new Event('pagehide'));
    expect(window.localStorage.getItem(KEY)).toBe('7');
  });

  it('never writes on mount — a fresh session must not materialize the default', () => {
    renderHook(() => usePersistedState(KEY, false));
    flushDebounce();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('a subsequent mount reads back the persisted value', () => {
    const first = renderHook(() => usePersistedState(KEY, 42));
    act(() => first.result.current[1](7));
    first.unmount(); // flushes

    const second = renderHook(() => usePersistedState(KEY, 42));
    expect(second.result.current[0]).toBe(7);
  });

  it('supports the functional setState form', () => {
    const { result } = renderHook(() => usePersistedState(KEY, 1));
    act(() => result.current[1]((prev) => prev + 1));
    expect(result.current[0]).toBe(2);
  });

  it('falls back to the default when the persisted JSON is corrupt', () => {
    window.localStorage.setItem(KEY, '{not valid json');
    const { result } = renderHook(() => usePersistedState(KEY, 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('falls back to the default when a validator rejects the persisted shape', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ unexpected: true }));
    const isNumber = (v: unknown): v is number => typeof v === 'number';
    const { result } = renderHook(() => usePersistedState(KEY, 10, isNumber));
    expect(result.current[0]).toBe(10);
  });

  it('does not throw when localStorage access throws (private-mode/quota)', () => {
    const spy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const { result } = renderHook(() => usePersistedState(KEY, 1));
    expect(() => {
      act(() => result.current[1](2));
      flushDebounce();
    }).not.toThrow();
    expect(result.current[0]).toBe(2); // state still updates even if persistence fails
    spy.mockRestore();
  });

  it('two independent keys do not collide', () => {
    const a = renderHook(() => usePersistedState('tsi.test.a', 'A'));
    const b = renderHook(() => usePersistedState('tsi.test.b', 'B'));
    act(() => a.result.current[1]('A2'));
    flushDebounce();
    expect(a.result.current[0]).toBe('A2');
    expect(b.result.current[0]).toBe('B');
    window.localStorage.removeItem('tsi.test.a');
    window.localStorage.removeItem('tsi.test.b');
  });
});

describe('readPersisted / writePersisted (the one-shot pair behind ViewportModeSync)', () => {
  it('round-trips a value', () => {
    writePersisted(KEY, { mode: '2D' });
    expect(readPersisted<unknown>(KEY, null)).toEqual({ mode: '2D' });
  });

  it('readPersisted honours the validator', () => {
    writePersisted(KEY, 'garbage');
    const isNumber = (v: unknown): v is number => typeof v === 'number';
    expect(readPersisted(KEY, 5, isNumber)).toBe(5);
  });

  it('writePersisted swallows storage failures', () => {
    const spy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => writePersisted(KEY, 1)).not.toThrow();
    spy.mockRestore();
  });
});
