/**
 * A suspended subtree counts as one pending load, so a reader that waits for the loader to settle
 * waits for a lazy chunk too.
 */
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { lazy, type ComponentType } from 'react';
import { ResourceLoader } from './ResourceLoader';
import { ResourceLoaderContext } from './ResourceLoaderContext';
import { PendingSuspense } from './PendingSuspense';

/** A lazy component and the resolver that lands its chunk. */
function deferredChunk(): { Chunk: ComponentType; land: () => Promise<void> } {
  let resolve: (module: { default: ComponentType }) => void = () => {};
  const loaded = new Promise<{ default: ComponentType }>((r) => (resolve = r));
  const Chunk = lazy(() => loaded);
  return {
    Chunk,
    land: async () => {
      resolve({ default: () => <span data-testid="landed" /> });
      await loaded;
    },
  };
}

function mount(loader: ResourceLoader, Chunk: ComponentType) {
  return render(
    <ResourceLoaderContext.Provider value={loader}>
      <PendingSuspense>
        <Chunk />
      </PendingSuspense>
    </ResourceLoaderContext.Provider>
  );
}

describe('PendingSuspense', () => {
  it('counts one pending load while its children suspend', () => {
    const loader = new ResourceLoader();
    mount(loader, deferredChunk().Chunk);

    expect(loader.pendingResourceCount).toBe(1);
  });

  it('releases the load and renders the children once the chunk lands', async () => {
    const loader = new ResourceLoader();
    const { Chunk, land } = deferredChunk();
    const view = mount(loader, Chunk);

    await act(land);

    expect(loader.pendingResourceCount).toBe(0);
    expect(view.getByTestId('landed')).toBeTruthy();
  });

  it('counts nothing for children that never suspend (edge case)', () => {
    const loader = new ResourceLoader();
    mount(loader, () => null);

    expect(loader.pendingResourceCount).toBe(0);
  });

  it('releases the load when it unmounts while suspended (error path)', () => {
    const loader = new ResourceLoader();
    const view = mount(loader, deferredChunk().Chunk);

    view.unmount();

    expect(loader.pendingResourceCount).toBe(0);
  });
});
