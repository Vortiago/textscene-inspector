/** A lazy module loads once for every caller, counts as one pending load until it lands, and reads null before. */
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { ResourceLoader } from './ResourceLoader';
import { ResourceLoaderContext } from './ResourceLoaderContext';
import { memoisedImport, type LazyImport } from './memoisedImport';
import { moduleOf, useLazyModule, useLazyModuleState } from './useLazyModule';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function Reader({ load, seen }: { load: LazyImport<string>; seen: (string | null)[] }) {
  seen.push(useLazyModule(load));
  return null;
}

function mount(loader: ResourceLoader, load: LazyImport<string>, seen: (string | null)[]) {
  return render(
    <ResourceLoaderContext.Provider value={loader}>
      <Reader load={load} seen={seen} />
    </ResourceLoaderContext.Provider>
  );
}

describe('useLazyModule', () => {
  it('reads null and counts one pending load until the module lands', async () => {
    const loader = new ResourceLoader();
    const chunk = deferred<string>();
    const seen: (string | null)[] = [];
    mount(
      loader,
      memoisedImport(() => chunk.promise),
      seen
    );
    expect([seen.at(-1), loader.pendingResourceCount]).toEqual([null, 1]);
    await act(async () => chunk.resolve('module'));
    expect([seen.at(-1), loader.pendingResourceCount]).toEqual(['module', 0]);
  });

  it('stops counting a module that fails to load, and keeps reading null', async () => {
    const loader = new ResourceLoader();
    const chunk = deferred<string>();
    const seen: (string | null)[] = [];
    mount(
      loader,
      memoisedImport(() => chunk.promise),
      seen
    );
    await act(async () => chunk.reject(new Error('chunk lost')));
    expect([seen.at(-1), loader.pendingResourceCount]).toEqual([null, 0]);
  });

  it('reads a module that has already landed on the first render, with no pending load', async () => {
    const loader = new ResourceLoader();
    const load = memoisedImport(() => Promise.resolve('module'));
    await load();
    const seen: (string | null)[] = [];
    mount(loader, load, seen);
    expect([seen[0], loader.pendingResourceCount]).toEqual(['module', 0]);
  });

  it('counts no pending load for a module that has already failed', async () => {
    const loader = new ResourceLoader();
    const load = memoisedImport(() => Promise.reject(new Error('chunk lost')));
    await load().catch(() => {});
    const seen: (string | null)[] = [];
    mount(loader, load, seen);
    expect([seen[0], loader.pendingResourceCount]).toEqual([null, 0]);
  });
});

function StateReader({
  load,
  isNeeded,
  seen,
}: {
  load: LazyImport<string>;
  isNeeded: boolean;
  seen: unknown[];
}) {
  seen.push(useLazyModuleState(load, isNeeded));
  return null;
}

describe('useLazyModuleState', () => {
  it('reads failed once the import fails, so the caller can say so', async () => {
    const chunk = deferred<string>();
    const seen: unknown[] = [];
    render(<StateReader load={memoisedImport(() => chunk.promise)} isNeeded seen={seen} />);
    await act(async () => chunk.reject(new Error('chunk lost')));
    expect(seen.at(-1)).toBe('failed');
  });

  it('reads null and starts no import for a caller that needs none (edge case)', () => {
    let imports = 0;
    const load = memoisedImport(() => {
      imports += 1;
      return Promise.resolve('module');
    });
    const seen: unknown[] = [];
    render(<StateReader load={load} isNeeded={false} seen={seen} />);
    expect([seen.at(-1), imports]).toEqual([null, 0]);
  });
});

describe('moduleOf', () => {
  it('reads the module of a landed load', () => {
    expect(moduleOf({ module: 'chunk' })).toBe('chunk');
  });

  it('reads null for a failed load', () => {
    expect(moduleOf<string>('failed')).toBeNull();
  });

  it('reads null while it loads and with no import', () => {
    expect([moduleOf<string>('loading'), moduleOf<string>(null)]).toEqual([null, null]);
  });
});
