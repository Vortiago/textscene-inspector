/**
 * The imports `React.lazy` starts, which a test file waits for before its module runner closes.
 */

import { lazy, Suspense, type ComponentType } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ErrorBoundary } from '../r3f/components/ErrorBoundary';
import { settleLazyImports, trackedLazy } from './lazyImports';

/** A module that lands after `ms`, and records that it landed. */
function slowModule(ms: number): {
  load: () => Promise<{ default: ComponentType }>;
  hasLanded: () => boolean;
} {
  let hasLanded = false;
  const load = async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    hasLanded = true;
    return { default: () => null };
  };
  return { load, hasLanded: () => hasLanded };
}

describe('settleLazyImports', () => {
  it('waits for an import a render started', async () => {
    const slow = slowModule(50);
    const Slow = trackedLazy(lazy)(slow.load);
    render(
      <Suspense fallback={null}>
        <Slow />
      </Suspense>
    );

    await settleLazyImports();

    expect(slow.hasLanded()).toBe(true);
  });

  it('settles an import that fails', async () => {
    const Failing = trackedLazy(lazy)(() => Promise.reject(new Error('expected failure')));
    render(
      <ErrorBoundary fallback={() => null}>
        <Suspense fallback={null}>
          <Failing />
        </Suspense>
      </ErrorBoundary>
    );

    await expect(settleLazyImports()).resolves.toBeUndefined();
  });

  it('tracks the lazy every test file imports from react', async () => {
    const slow = slowModule(50);
    const Slow = lazy(slow.load);
    render(
      <Suspense fallback={null}>
        <Slow />
      </Suspense>
    );

    await settleLazyImports();

    expect(slow.hasLanded()).toBe(true);
  });
});
