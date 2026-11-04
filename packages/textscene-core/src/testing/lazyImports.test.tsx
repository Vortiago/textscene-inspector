/**
 * The imports `React.lazy` starts, which a test file waits for before its module runner closes.
 */

import { lazy, Suspense, type ComponentType } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { ErrorBoundary } from '../r3f/components/ErrorBoundary';
import { settleLazyImports, trackedLazy } from './lazyImports';

/** React's own `lazy`, past the tracked one the test setup gives every test file. */
const { lazy: untrackedLazy } = await vi.importActual<typeof import('react')>('react');

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

/** Renders `Chunk` so it suspends, and draws nothing if its import fails. */
function renderSuspended(Chunk: ComponentType): void {
  render(
    <ErrorBoundary fallback={() => null}>
      <Suspense fallback={null}>
        <Chunk />
      </Suspense>
    </ErrorBoundary>
  );
}

describe('settleLazyImports', () => {
  it('waits for an import a render started', async () => {
    const slow = slowModule(50);
    renderSuspended(trackedLazy(untrackedLazy)(slow.load));

    await settleLazyImports();

    expect(slow.hasLanded()).toBe(true);
  });

  it('settles an import that fails', async () => {
    renderSuspended(trackedLazy(untrackedLazy)(() => Promise.reject(new Error('expected failure'))));

    await expect(settleLazyImports()).resolves.toBeUndefined();
  });

  it('fails, naming the count, when an import still loads at the time limit', async () => {
    let land: (module: { default: ComponentType }) => void = () => {};
    renderSuspended(
      trackedLazy(untrackedLazy)(() => new Promise<{ default: ComponentType }>((resolve) => (land = resolve)))
    );
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
      land({ default: () => null });
    });

    const settled = expect(settleLazyImports()).rejects.toThrow('found 1 still loading');
    await vi.runAllTimersAsync();

    await settled;
  });

  it('tracks the lazy every test file imports from react', async () => {
    const slow = slowModule(50);
    renderSuspended(lazy(slow.load));

    await settleLazyImports();

    expect(slow.hasLanded()).toBe(true);
  });
});
