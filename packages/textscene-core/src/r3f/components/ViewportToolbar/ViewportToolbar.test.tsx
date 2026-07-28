/**
 * ViewportToolbar drives the real ViewportModeProvider state: the 3D/2D
 * segmented switch and the collision toggle. Rendered under the actual provider
 * so a click round-trips through context back into the button's pressed state.
 */

import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ViewportModeProvider } from '../../contexts/ViewportModeContext';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { CameraControlProvider, useCameraControl } from '../../contexts/CameraControlContext';
import { ViewportToolbar } from './ViewportToolbar';

/**
 * The display toggles live behind the "Display" button now (the toolbar wrapped
 * to two rows and covered the scene with them inline), so a test that wants one
 * has to open the menu exactly as a user would.
 */
function openDisplayMenu(): void {
  fireEvent.click(screen.getByTestId('display-menu-button'));
}


function renderToolbar(initialMode?: '2D' | '3D', initialShowCollisions?: boolean) {
  return render(
    <ViewportModeProvider initialMode={initialMode} initialShowCollisions={initialShowCollisions}>
      <ViewportToolbar />
    </ViewportModeProvider>
  );
}

describe('ViewportToolbar', () => {
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
    expect(
      (screen.getByRole('checkbox', { name: 'Collisions' }) as HTMLInputElement).checked
    ).toBe(true);
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

  it('hides the grid checkbox in 2D mode (a 3D-only affordance)', () => {
    renderToolbar('2D');
    // Opened, so this asserts the toggle is absent from the menu rather than
    // just absent from a closed popover — which would pass either way.
    openDisplayMenu();
    expect(screen.queryByRole('checkbox', { name: 'Grid' })).toBeNull();
  });
});

/** Mount with the camera + hierarchy contexts the Reset Camera button needs. */
function renderWithChrome({
  mode = '3D' as '2D' | '3D',
  sceneGraph = {} as unknown,
} = {}) {
  return render(
    <HierarchyProvider value={{ sceneGraph: sceneGraph as never, panelId: 'p' }}>
      <CameraControlProvider>
        <ViewportModeProvider initialMode={mode}>
          <ViewportToolbar />
        </ViewportModeProvider>
      </CameraControlProvider>
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

describe('ViewportToolbar — Screenshot (#224)', () => {
  it('shows an enabled Screenshot button in 3D when a scene is loaded', () => {
    renderWithChrome({ mode: '3D', sceneGraph: {} });
    const btn = screen.getByTestId('screenshot-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('disables Screenshot when no scene is loaded', () => {
    renderWithChrome({ mode: '3D', sceneGraph: null });
    expect((screen.getByTestId('screenshot-button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('hides Screenshot entirely in 2D overlay mode', () => {
    renderWithChrome({ mode: '2D', sceneGraph: {} });
    expect(screen.queryByTestId('screenshot-button')).toBeNull();
  });

  it('clicking Screenshot pulls a frame from the registered handler and triggers a download', () => {
    const DATA_URL = 'data:image/png;base64,AAAA';

    function ScreenshotHandlerRegistrar() {
      const { registerScreenshotHandler } = useCameraControl();
      useEffect(() => registerScreenshotHandler(() => DATA_URL), [registerScreenshotHandler]);
      return null;
    }

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    // Mount FIRST, with the real appendChild — testing-library's own render()
    // attaches its container via document.body.appendChild too, so mocking it
    // beforehand would break the mount itself. Only wrap it afterwards, still
    // calling through to the original so the DOM keeps working normally.
    render(
      <HierarchyProvider value={{ sceneGraph: {} as never, panelId: 'p' }}>
        <CameraControlProvider>
          <ScreenshotHandlerRegistrar />
          <ViewportModeProvider initialMode="3D">
            <ViewportToolbar />
          </ViewportModeProvider>
        </CameraControlProvider>
      </HierarchyProvider>
    );

    let capturedAnchor: HTMLAnchorElement | null = null;
    const originalAppendChild = globalThis.document.body.appendChild.bind(
      globalThis.document.body
    );
    const appendSpy = vi
      .spyOn(globalThis.document.body, 'appendChild')
      .mockImplementation((node) => {
        if (node instanceof HTMLAnchorElement) capturedAnchor = node;
        return originalAppendChild(node);
      });

    fireEvent.click(screen.getByTestId('screenshot-button'));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(capturedAnchor).not.toBeNull();
    expect((capturedAnchor as unknown as HTMLAnchorElement).getAttribute('href')).toBe(DATA_URL);
    expect((capturedAnchor as unknown as HTMLAnchorElement).download).toMatch(/\.png$/);

    clickSpy.mockRestore();
    appendSpy.mockRestore();
  });

  it('does nothing (no throw) when the handler returns null (no canvas mounted)', () => {
    renderWithChrome({ mode: '3D', sceneGraph: {} });
    expect(() => fireEvent.click(screen.getByTestId('screenshot-button'))).not.toThrow();
  });
});
