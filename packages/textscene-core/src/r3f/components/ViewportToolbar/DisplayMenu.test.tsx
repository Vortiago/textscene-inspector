/**
 * The display-toggle menu: it opens and closes the way a popover over a drag
 * surface has to, it reports how many toggles are on without being opened, and
 * a disabled toggle stays disabled and uncounted.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DisplayMenu, type DisplayToggle } from './DisplayMenu';

function toggle(label: string, over: Partial<DisplayToggle> = {}): DisplayToggle {
  return { label, title: `${label} title`, checked: false, onChange: vi.fn(), ...over };
}

function open(toggles: DisplayToggle[]) {
  const utils = render(<DisplayMenu toggles={toggles} />);
  fireEvent.click(screen.getByTestId('display-menu-button'));
  return utils;
}

describe('<DisplayMenu>', () => {
  it('keeps the toggles out of the bar until asked for', () => {
    render(<DisplayMenu toggles={[toggle('Grid')]} />);
    expect(screen.queryByTestId('display-menu-popover')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Grid' })).toBeNull();
  });

  it('opens on click and reports it through aria-expanded', () => {
    open([toggle('Grid')]);
    expect(screen.getByTestId('display-menu-popover')).toBeTruthy();
    expect(screen.getByTestId('display-menu-button').getAttribute('aria-expanded')).toBe('true');
  });

  it('renders every toggle with its own title and checked state', () => {
    open([toggle('Grid', { checked: true }), toggle('Labels')]);
    expect((screen.getByRole('checkbox', { name: 'Grid' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', { name: 'Labels' }) as HTMLInputElement).checked).toBe(
      false
    );
  });

  it('reports each change to the toggle that owns it', () => {
    const grid = toggle('Grid');
    open([grid, toggle('Labels')]);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Grid' }));
    expect(grid.onChange).toHaveBeenCalledWith(true);
  });

  it('counts the active toggles on the button, so a closed menu is not opaque', () => {
    render(<DisplayMenu toggles={[toggle('Grid', { checked: true }), toggle('Labels')]} />);
    expect(screen.getByTestId('display-menu-button').textContent).toBe('Display (1)');
  });

  it('shows no count when nothing is on', () => {
    render(<DisplayMenu toggles={[toggle('Grid')]} />);
    expect(screen.getByTestId('display-menu-button').textContent).toBe('Display');
  });

  it('does not count a toggle the scene has disabled', () => {
    // A preview that yielded to the scene's own light reads as checked-but-
    // disabled; counting it would claim the user turned something on.
    render(<DisplayMenu toggles={[toggle('Preview Sun', { checked: true, disabled: true })]} />);
    expect(screen.getByTestId('display-menu-button').textContent).toBe('Display');
  });

  it('renders a disabled toggle as disabled', () => {
    open([toggle('Preview Sun', { checked: true, disabled: true })]);
    expect(
      (screen.getByRole('checkbox', { name: 'Preview Sun' }) as HTMLInputElement).disabled
    ).toBe(true);
  });

  it('closes on Escape', () => {
    open([toggle('Grid')]);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('display-menu-popover')).toBeNull();
  });

  it('closes on a pointer down outside, so it cannot eat a navigation drag', () => {
    open([toggle('Grid')]);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId('display-menu-popover')).toBeNull();
  });

  it('stays open while toggling something inside it', () => {
    open([toggle('Grid')]);
    fireEvent.pointerDown(screen.getByRole('checkbox', { name: 'Grid' }));
    expect(screen.getByTestId('display-menu-popover')).toBeTruthy();
  });

  it('renders nothing at all when there are no toggles to offer', () => {
    const { container } = render(<DisplayMenu toggles={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
