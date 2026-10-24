import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createStoreContext } from './createStoreContext';

const { Provider, useStore, useValue } = createStoreContext<string | null>(null, 'TestStoreContext');

function provider({ children }: { children: ReactNode }) {
  return <Provider>{children}</Provider>;
}

describe('createStoreContext', () => {
  it("re-renders a value reader with each value the provider's store takes", () => {
    const { result } = renderHook(() => ({ value: useValue(), store: useStore() }), { wrapper: provider });
    act(() => result.current.store.set('published'));
    expect(result.current.value).toBe('published');
  });

  it('reads the initial value before a writer sets one', () => {
    const { result } = renderHook(() => useValue(), { wrapper: provider });
    expect(result.current).toBeNull();
  });

  it('reads the initial value with no provider, whose stand-in store nothing reads (edge case)', () => {
    const { result } = renderHook(() => useValue());
    expect(result.current).toBeNull();
  });

  it('gives each provider a store of its own, so two previews never share a value', () => {
    const first = renderHook(() => useStore(), { wrapper: provider });
    const second = renderHook(() => useStore(), { wrapper: provider });
    expect(first.result.current).not.toBe(second.result.current);
  });
});
