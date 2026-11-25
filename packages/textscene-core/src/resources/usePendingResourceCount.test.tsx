import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { act, render, renderHook } from '@testing-library/react';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createFakeResourceLoader } from './testing/createFakeResourceLoader';
import { usePendingResourceCount } from './usePendingResourceCount';
import { usePendingWhile } from './usePendingWhile';

function PendingWhile({ isPending }: { isPending: boolean }) {
  usePendingWhile(isPending);
  return null;
}

function Count({ onCount }: { onCount: (count: number) => void }) {
  onCount(usePendingResourceCount());
  return null;
}

/** Two views on one loader, each under its own provider, as two `mountScene` calls on one provider are. */
function renderTwoViews(isPendingInB: boolean) {
  const { loader } = createFakeResourceLoader();
  const counts = { a: -1, b: -1 };
  const tree = (isPending: boolean) => (
    <>
      <ResourceLoaderProvider loader={loader}>
        <Count onCount={(count) => (counts.a = count)} />
      </ResourceLoaderProvider>
      <ResourceLoaderProvider loader={loader}>
        <PendingWhile isPending={isPending} />
        <Count onCount={(count) => (counts.b = count)} />
      </ResourceLoaderProvider>
    </>
  );
  const { rerender } = render(tree(isPendingInB));
  return { counts, rerender: (isPending: boolean) => rerender(tree(isPending)) };
}

describe('usePendingResourceCount', () => {
  it("counts the loads of its own view's consumers, from zero, up, and back to zero", () => {
    const { counts, rerender } = renderTwoViews(false);
    expect(counts.b).toBe(0);

    act(() => rerender(true));
    expect(counts.b).toBe(1);

    act(() => rerender(false));
    expect(counts.b).toBe(0);
  });

  it('leaves another view on the same loader at zero while one view loads', () => {
    const { counts } = renderTwoViews(true);

    expect(counts).toEqual({ a: 0, b: 1 });
  });

  it('answers zero outside a loader (error case)', () => {
    const { result } = renderHook(() => usePendingResourceCount(), {
      wrapper: ({ children }: { children: ReactNode }) => children,
    });
    expect(result.current).toBe(0);
  });
});
