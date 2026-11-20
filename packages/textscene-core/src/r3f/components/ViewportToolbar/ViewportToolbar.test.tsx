/**
 * The 3D/2D switch and the collision toggle drive the real ViewportModeProvider,
 * so a click round-trips through context to the button's pressed state.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SHOW_STORAGE_KEYS, ViewportModeProvider } from '../../contexts/ViewportModeContext';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { ViewportActionsProvider } from '../../contexts/ViewportActionsContext';
import type { ViewAnswers } from '../../viewStatus/viewAnswers';
import { ViewportToolbar } from './ViewportToolbar';
import { openDisplayMenu } from './DisplayMenu.testkit';

function renderToolbar(initialMode?: '2D' | '3D', initialShowCollisions?: boolean) {
  return render(
    <ViewportModeProvider initialMode={initialMode} initialShow={{ collisions: initialShowCollisions }}>
      <ViewportToolbar view={null} />
    </ViewportModeProvider>
  );
}

describe('ViewportToolbar', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults to 3D pressed, 2D not pressed', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: '3D' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '2D' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking 2D switches the pressed state through context', () => {
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: '2D' }));
    expect(screen.getByRole('button', { name: '2D' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '3D' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('honors an initial 2D mode', () => {
    renderToolbar('2D');
    expect(screen.getByRole('button', { name: '2D' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('collision checkbox reflects + toggles showCollisions', () => {
    renderToolbar('3D', false);
    openDisplayMenu();
    const checkbox = screen.getByRole('checkbox', { name: 'Collisions' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('renders a pre-checked collision toggle when initially on', () => {
    renderToolbar('3D', true);
    openDisplayMenu();
    expect((screen.getByRole('checkbox', { name: 'Collisions' }) as HTMLInputElement).checked).toBe(true);
  });

  it('labels checkbox reflects + toggles showLabels (on by default)', () => {
    renderToolbar('3D', false);
    openDisplayMenu();
    const checkbox = screen.getByRole('checkbox', { name: 'Labels' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('grid checkbox is unchecked by default and toggles showGrid (#224)', () => {
    renderToolbar('3D', false);
    openDisplayMenu();
    const checkbox = screen.getByRole('checkbox', { name: 'Grid' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('gizmos checkbox is checked by default and persists a click under tsi.showGizmos', () => {
    renderToolbar('3D');
    openDisplayMenu();
    const checkbox = screen.getByRole('checkbox', { name: 'Gizmos' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(window.localStorage.getItem(SHOW_STORAGE_KEYS.gizmos)).toBe('false');
  });

  it('offers the gizmos checkbox in 2D mode, whose helpers the toggle hides too', () => {
    renderToolbar('2D');
    openDisplayMenu();
    expect(screen.getByRole('checkbox', { name: 'Gizmos' })).toBeTruthy();
  });

  it('fog checkbox is checked by default and toggles showFog', () => {
    renderToolbar('3D', false);
    openDisplayMenu();
    const checkbox = screen.getByRole('checkbox', { name: 'Fog' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('hides the fog checkbox in 2D mode, where nothing draws fog', () => {
    renderToolbar('2D');
    openDisplayMenu();
    expect(screen.queryByRole('checkbox', { name: 'Fog' })).toBeNull();
  });

  it('performance checkbox is unchecked by default and persists a click', () => {
    renderToolbar('3D');
    openDisplayMenu();
    const checkbox = screen.getByRole('checkbox', { name: 'Performance' }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(window.localStorage.getItem(SHOW_STORAGE_KEYS.performance)).toBe('true');
  });

  it('offers the performance checkbox in 2D mode, whose canvas renders frames too', () => {
    renderToolbar('2D');
    openDisplayMenu();
    expect(screen.getByRole('checkbox', { name: 'Performance' })).toBeTruthy();
  });

  it('hides the grid checkbox in 2D mode (a 3D-only affordance)', () => {
    renderToolbar('2D');
    // Open, since a closed popover lacks the toggle either way.
    openDisplayMenu();
    expect(screen.queryByRole('checkbox', { name: 'Grid' })).toBeNull();
  });
});

/** Mounts with the camera and hierarchy contexts that Reset Camera needs. */
function renderWithChrome({
  mode = '3D' as '2D' | '3D',
  sceneGraph = {} as unknown,
  view = null as ViewAnswers | null,
} = {}) {
  return render(
    <HierarchyProvider value={{ sceneGraph: sceneGraph as never, panelId: 'p' }}>
      <ViewportActionsProvider>
        <ViewportModeProvider initialMode={mode}>
          <ViewportToolbar view={view} />
        </ViewportModeProvider>
      </ViewportActionsProvider>
    </HierarchyProvider>
  );
}

describe('ViewportToolbar — Reset Camera', () => {
  it('shows an enabled Reset Camera in 3D when a scene is loaded', () => {
    renderWithChrome({ mode: '3D', sceneGraph: {} });
    const btn = screen.getByTestId('reset-camera-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('disables Reset Camera when no scene is loaded', () => {
    renderWithChrome({ mode: '3D', sceneGraph: null });
    expect((screen.getByTestId('reset-camera-button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('hides Reset Camera entirely in 2D overlay mode', () => {
    renderWithChrome({ mode: '2D', sceneGraph: {} });
    expect(screen.queryByTestId('reset-camera-button')).toBeNull();
  });
});

describe('ViewportToolbar — Screenshot', () => {
  const IMAGE = new Blob(['png'], { type: 'image/png' });
  const settledView = (): ViewAnswers => ({
    settled: Promise.resolve({ scriptedNodeCount: 0, hasCurrentCamera: false, missingFiles: new Set() }),
    captureImage: () => Promise.resolve(IMAGE),
  });

  it.each(['3D', '2D'] as const)(
    'shows an enabled Screenshot button in %s when a scene is loaded',
    (mode) => {
      renderWithChrome({ mode, sceneGraph: {}, view: settledView() });
      const btn = screen.getByTestId('screenshot-button') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    }
  );

  it('disables Screenshot when no scene is loaded', () => {
    renderWithChrome({ mode: '3D', sceneGraph: null, view: settledView() });
    expect((screen.getByTestId('screenshot-button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('hides Screenshot while no view is mounted', () => {
    renderWithChrome({ mode: '3D', sceneGraph: {}, view: null });
    expect(screen.queryByTestId('screenshot-button')).toBeNull();
  });

  it("downloads the view's image as a PNG", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:shot');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    renderWithChrome({ mode: '3D', sceneGraph: {}, view: settledView() });

    fireEvent.click(screen.getByTestId('screenshot-button'));
    await vi.waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));

    expect(createSpy).toHaveBeenCalledWith(IMAGE);
    const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.getAttribute('href')).toBe('blob:shot');
    expect(anchor.download).toMatch(/\.png$/);
    vi.restoreAllMocks();
  });
});
