import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ResourceLoaderProvider } from '../ResourceLoaderContext';
import { createFakeResourceLoader } from '../testing/createFakeResourceLoader';
import { useLoadFailure } from './useLoadFailure';
import type { LoadOutcome } from './loadOutcome';

const BAD = 'res://bad.tres';
const FAILS: LoadOutcome = { isFailed: true, chain: [BAD, 'res://gone.png'], cause: 'missing' };

function mount(path: string | null) {
  const fake = createFakeResourceLoader();
  const requested: string[] = [];
  fake.loadOutcomes.setRequestImpl((requestedPath) => requested.push(requestedPath));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
  );
  const hook = renderHook(() => useLoadFailure(path), { wrapper });
  return { fake, hook, requested };
}

describe('useLoadFailure', () => {
  it('requests the outcome of the file', () => {
    expect(mount(BAD).requested).toEqual([BAD]);
  });

  it('answers the failure once the file fails to load', () => {
    const { fake, hook } = mount(BAD);
    act(() => fake.loadOutcomes._resolve(BAD, FAILS));
    expect(hook.result.current).toBe(FAILS);
  });

  it('answers null while the file loads', () => {
    const { fake, hook } = mount(BAD);
    act(() => fake.loadOutcomes._resolve(BAD, { isFailed: false }));
    expect(hook.result.current).toBeNull();
  });

  it('requests nothing and answers null for no path', () => {
    const { hook, requested } = mount(null);
    expect(requested).toEqual([]);
    expect(hook.result.current).toBeNull();
  });
});
