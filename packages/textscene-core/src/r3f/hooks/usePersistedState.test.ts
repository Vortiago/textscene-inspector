/**
 * usePersistedState (#224) — the shared localStorage-backed state hook
 * `TscnPreviewShell` uses for dock layout + viewport mode, mirroring the
 * web app's existing inline pattern (r3f-main.tsx) so both hosts get it for
 * free (VS Code webviews are a browser context too — localStorage works the
 * same way there).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePersistedState } from './usePersistedState';

const KEY = 'tsi.test.value';

afterEach(() => {
  window.localStorage.clear();
});

describe('usePersistedState', () => {
  it('starts at the default value when nothing is persisted', () => {
    const { result } = renderHook(() => usePersistedState(KEY, 42));
    expect(result.current[0]).toBe(42);
  });

  it('persists a new value to localStorage', () => {
    const { result } = renderHook(() => usePersistedState(KEY, 42));
    act(() => result.current[1](99));
    expect(result.current[0]).toBe(99);
    expect(window.localStorage.getItem(KEY)).toBe('99');
  });

  it('a FRESH mount (no persisted value) is a no-op — matches a fresh browser context', () => {
    // The #224 constraint from the round-2 brief: a persisted-preference
    // toggle is fine as long as a session with NO localStorage sees the
    // default. This is exactly that contract, generically.
    window.localStorage.clear();
    const { result } = renderHook(() => usePersistedState(KEY, false));
    expect(result.current[0]).toBe(false);
  });

  it('a subsequent mount reads back the persisted value', () => {
    const first = renderHook(() => usePersistedState(KEY, 42));
    act(() => first.result.current[1](7));

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
    expect(() => act(() => result.current[1](2))).not.toThrow();
    expect(result.current[0]).toBe(2); // state still updates even if persistence fails
    spy.mockRestore();
  });

  it('two independent keys do not collide', () => {
    const a = renderHook(() => usePersistedState('tsi.test.a', 'A'));
    const b = renderHook(() => usePersistedState('tsi.test.b', 'B'));
    act(() => a.result.current[1]('A2'));
    expect(a.result.current[0]).toBe('A2');
    expect(b.result.current[0]).toBe('B');
    window.localStorage.removeItem('tsi.test.a');
    window.localStorage.removeItem('tsi.test.b');
  });
});
