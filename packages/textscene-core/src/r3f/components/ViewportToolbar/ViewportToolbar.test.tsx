/**
 * ViewportToolbar drives the real ViewportModeProvider state: the 3D/2D
 * segmented switch and the collision toggle. Rendered under the actual provider
 * so a click round-trips through context back into the button's pressed state.
 */

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ViewportModeProvider } from '../../contexts/ViewportModeContext';
import { ViewportToolbar } from './ViewportToolbar';

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
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('renders a pre-checked collision toggle when initially on', () => {
    renderToolbar('3D', true);
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
  });
});
