/**
 * The hook holds one pending load while its condition holds, and releases it when the condition
 * clears or the caller unmounts.
 */
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { ResourceLoader } from './ResourceLoader';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { createPendingProbe, type PendingProbe } from './testing/pendingProbe';
import { usePendingWhile } from './usePendingWhile';

function PendingTexture() {
  usePendingWhile(true, 'textures');
  return null;
}

function Pending({ isPending }: { isPending: boolean }) {
  usePendingWhile(isPending);
  return null;
}

function tree(loader: ResourceLoader, probe: PendingProbe, isPending: boolean) {
  return (
    <ResourceLoaderProvider loader={loader}>
      <probe.Probe />
      <Pending isPending={isPending} />
    </ResourceLoaderProvider>
  );
}

describe('usePendingWhile', () => {
  it('counts one pending load while the condition holds', () => {
    const probe = createPendingProbe();
    render(tree(new ResourceLoader(), probe, true));

    expect(probe.pending()).toBe(1);
  });

  it('releases the load when the condition clears', () => {
    const loader = new ResourceLoader();
    const probe = createPendingProbe();
    const view = render(tree(loader, probe, true));

    act(() => view.rerender(tree(loader, probe, false)));

    expect(probe.pending()).toBe(0);
  });

  it('releases the load when the caller unmounts', () => {
    const probe = createPendingProbe();
    const view = render(tree(new ResourceLoader(), probe, true));

    view.unmount();

    expect(probe.pending()).toBe(0);
  });

  it('counts nothing while the condition is false', () => {
    const probe = createPendingProbe();
    render(tree(new ResourceLoader(), probe, false));

    expect(probe.pending()).toBe(0);
  });

  it('counts on the kind of work it names, and leaves the loads alone', () => {
    const probe = createPendingProbe();
    render(
      <ResourceLoaderProvider loader={new ResourceLoader()}>
        <probe.Probe />
        <PendingTexture />
      </ResourceLoaderProvider>
    );

    expect([probe.work().textures.pending(), probe.pending()]).toEqual([1, 0]);
  });
});
