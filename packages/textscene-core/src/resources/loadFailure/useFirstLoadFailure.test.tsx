import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ResourceLoaderProvider } from '../ResourceLoaderContext';
import { createFakeResourceLoader } from '../testing/createFakeResourceLoader';
import { useFirstLoadFailure } from './useFirstLoadFailure';
import type { LoadOutcome } from './loadOutcome';

const PATHS = ['res://ok.tres', 'res://bad.tres'];
const FAILS: LoadOutcome = { isFailed: true, chain: ['res://bad.tres', 'res://gone.png'], cause: 'missing' };

function mount() {
  const fake = createFakeResourceLoader();
  const requested: string[] = [];
  fake.loadOutcomes.setRequestImpl((path) => requested.push(path));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ResourceLoaderProvider loader={fake.loader}>{children}</ResourceLoaderProvider>
  );
  const hook = renderHook(() => useFirstLoadFailure(PATHS), { wrapper });
  return { fake, hook, requested };
}

describe('useFirstLoadFailure', () => {
  it('requests the outcome of each file', () => {
    const { requested } = mount();

    expect(requested).toEqual(PATHS);
  });

  it('answers the failure once a file fails to load', () => {
    const { fake, hook } = mount();

    act(() => {
      fake.loadOutcomes._resolve('res://ok.tres', { isFailed: false });
      fake.loadOutcomes._resolve('res://bad.tres', FAILS);
    });

    expect(hook.result.current).toBe(FAILS);
  });

  it('answers null while every file loads', () => {
    const { fake, hook } = mount();

    act(() => fake.loadOutcomes._resolve('res://ok.tres', { isFailed: false }));

    expect(hook.result.current).toBeNull();
  });
});
