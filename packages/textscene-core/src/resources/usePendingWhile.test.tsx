/**
 * The hook holds one pending load while its condition holds, and releases it when the condition
 * clears or the caller unmounts.
 */
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { ResourceLoader } from './ResourceLoader';
import { ResourceLoaderProvider } from './ResourceLoaderContext';
import { usePendingWhile } from './usePendingWhile';

function Pending({ pending }: { pending: boolean }) {
  usePendingWhile(pending);
  return null;
}

function mount(loader: ResourceLoader, pending: boolean) {
  return render(
    <ResourceLoaderProvider loader={loader}>
      <Pending pending={pending} />
    </ResourceLoaderProvider>
  );
}

describe('usePendingWhile', () => {
  it('counts one pending load while the condition holds', () => {
    const loader = new ResourceLoader();
    mount(loader, true);

    expect(loader.pendingResourceCount).toBe(1);
  });

  it('releases the load when the condition clears', () => {
    const loader = new ResourceLoader();
    const view = mount(loader, true);

    act(() => {
      view.rerender(
        <ResourceLoaderProvider loader={loader}>
          <Pending pending={false} />
        </ResourceLoaderProvider>
      );
    });

    expect(loader.pendingResourceCount).toBe(0);
  });

  it('releases the load when the caller unmounts', () => {
    const loader = new ResourceLoader();
    const view = mount(loader, true);

    view.unmount();

    expect(loader.pendingResourceCount).toBe(0);
  });

  it('counts nothing while the condition is false', () => {
    const loader = new ResourceLoader();
    mount(loader, false);

    expect(loader.pendingResourceCount).toBe(0);
  });
});
