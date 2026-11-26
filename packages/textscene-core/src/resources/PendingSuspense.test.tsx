/**
 * A suspended subtree counts as one pending load, so a reader that waits for the loader to settle
 * waits for a lazy chunk too.
 */
import { describe, expect, it, onTestFinished } from 'vitest';
import { act, render } from '@testing-library/react';
import { lazy, type ComponentType } from 'react';
import { ResourceLoader } from './ResourceLoader';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { PendingSuspense } from './PendingSuspense';
import { createPendingProbe, type PendingProbe } from './testing/pendingProbe';

/**
 * A lazy component and the resolver that lands its chunk. The chunk lands when the test finishes at
 * the latest, since the test setup fails a file that ends with a lazy import still loading.
 */
function deferredChunk(): { Chunk: ComponentType; land: () => Promise<void> } {
  let resolve: (module: { default: ComponentType }) => void = () => {};
  const loaded = new Promise<{ default: ComponentType }>((r) => (resolve = r));
  const Chunk = lazy(() => loaded);
  const land = async () => {
    resolve({ default: () => <span data-testid="landed" /> });
    await loaded;
  };
  onTestFinished(() => act(land));
  return { Chunk, land };
}

function mount(probe: PendingProbe, Chunk: ComponentType) {
  return render(
    <ResourceLoaderProvider loader={new ResourceLoader()}>
      <probe.Probe />
      <PendingSuspense>
        <Chunk />
      </PendingSuspense>
    </ResourceLoaderProvider>
  );
}

describe('PendingSuspense', () => {
  it('counts one pending load while its children suspend', () => {
    const probe = createPendingProbe();
    mount(probe, deferredChunk().Chunk);

    expect(probe.pending()).toBe(1);
  });

  it('releases the load and renders the children once the chunk lands', async () => {
    const probe = createPendingProbe();
    const { Chunk, land } = deferredChunk();
    const view = mount(probe, Chunk);

    await act(land);

    expect(probe.pending()).toBe(0);
    expect(view.getByTestId('landed')).toBeTruthy();
  });

  it('counts nothing for children that never suspend (edge case)', () => {
    const probe = createPendingProbe();
    mount(probe, () => null);

    expect(probe.pending()).toBe(0);
  });

  it('releases the load when it unmounts while suspended (error path)', () => {
    const probe = createPendingProbe();
    const view = mount(probe, deferredChunk().Chunk);

    view.unmount();

    expect(probe.pending()).toBe(0);
  });
});
