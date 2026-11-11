/**
 * The Freelook button: it shows and drives the toggle of the 3D canvas's freelook through the
 * viewport actions, and says why it is off during a camera preview.
 */
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ViewportModeProvider, type ViewportMode } from '../../contexts/ViewportModeContext';
import { ViewportActionsProvider } from '../../contexts/ViewportActionsContext';
import { Freelook, type FreelookControl } from '../../freelook';
import { useViewportActions } from '../../testing/ViewportActionsProbe';
import { ViewportToolbar } from './ViewportToolbar';

/** A canvas's freelook whose toggle the browser always grants. */
function grantedFreelook(): FreelookControl {
  const freelook = new Freelook();
  return {
    toggle: () => freelook.setToggled(!freelook.isToggled),
    getState: freelook.getState,
    subscribe: freelook.subscribe,
  };
}

/** Stands in for the 3D canvas, which registers its freelook on mount. */
function RegisteredFreelook({ control }: { control: FreelookControl }) {
  const { registerFreelook } = useViewportActions();
  useEffect(() => registerFreelook(control), [registerFreelook, control]);
  return null;
}

function renderToolbar({
  mode = '3D',
  control = grantedFreelook(),
  previewedCameraPath = null,
}: { mode?: ViewportMode; control?: FreelookControl | null; previewedCameraPath?: string | null } = {}) {
  render(
    <ViewportModeProvider initialMode={mode}>
      <ViewportActionsProvider initialPreviewedCameraPath={previewedCameraPath}>
        {control && <RegisteredFreelook control={control} />}
        <ViewportToolbar />
      </ViewportActionsProvider>
    </ViewportModeProvider>
  );
  return screen.queryByRole('button', { name: 'Freelook' });
}

describe('ViewportToolbar Freelook button', () => {
  it('starts the toggle on a click, and shows it pressed', () => {
    const button = renderToolbar();
    expect(button?.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(button!);

    expect(button?.getAttribute('aria-pressed')).toBe('true');
  });

  it('follows a toggle that ends outside the toolbar, as on Escape', () => {
    const control = grantedFreelook();
    const button = renderToolbar({ control });
    fireEvent.click(button!);

    act(() => control.toggle());

    expect(button?.getAttribute('aria-pressed')).toBe('false');
  });

  it('is disabled during a camera preview, and says why', () => {
    const button = renderToolbar({ previewedCameraPath: 'Root/Camera3D' }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.title).toContain('camera preview');
  });

  it('hides in 2D, where no canvas flies', () => {
    expect(renderToolbar({ mode: '2D' })).toBeNull();
  });

  it('hides until a 3D canvas registers its freelook', () => {
    expect(renderToolbar({ control: null })).toBeNull();
  });
});
