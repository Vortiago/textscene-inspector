/**
 * The top-bar status that the scene's resources are still loading. It exists only
 * while the loader waits on a resource, so "gone" means detached from the DOM,
 * which is what the work budget check waits for.
 */
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ResourceLoader } from '../../../resources/ResourceLoader';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { ResourceLoadStatus } from './ResourceLoadStatus';
import { RESOURCE_LOAD_STATUS_TESTID } from './resourceLoadStatusTestId';

function renderWithLoader(loader: ResourceLoader) {
  return render(
    <ResourceLoaderProvider loader={loader}>
      <ResourceLoadStatus />
    </ResourceLoaderProvider>
  );
}

describe('<ResourceLoadStatus>', () => {
  it('is absent while no resource is on its way', () => {
    renderWithLoader(new ResourceLoader());
    expect(screen.queryByTestId(RESOURCE_LOAD_STATUS_TESTID)).toBeNull();
  });

  it('announces a resource on its way as a polite status, and leaves once it lands', () => {
    const loader = new ResourceLoader();
    renderWithLoader(loader);
    let release: () => void = () => {};
    act(() => {
      release = loader.beginPending();
    });
    const status = screen.getByTestId(RESOURCE_LOAD_STATUS_TESTID);
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('Loading resources…');
    expect(status.className).toMatch(/statChip/);

    act(() => release());
    expect(screen.queryByTestId(RESOURCE_LOAD_STATUS_TESTID)).toBeNull();
  });

  it('is absent outside a loader, which has no resource to wait on (edge case)', () => {
    render(<ResourceLoadStatus />);
    expect(screen.queryByTestId(RESOURCE_LOAD_STATUS_TESTID)).toBeNull();
  });
});
