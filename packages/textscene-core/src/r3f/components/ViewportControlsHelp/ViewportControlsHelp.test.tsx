/**
 * The pill states three bindings, the panel opens on click or ? and closes
 * every way a popover must, and each mode lists its own bindings. happy-dom has
 * no cascade, so the `pointer-events` CSS is read from the module source.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ViewportControlsHelp } from './ViewportControlsHelp';
import { controlsFor } from './bindings';

function open(mode: '2D' | '3D' = '3D') {
  const utils = render(<ViewportControlsHelp mode={mode} />);
  fireEvent.click(screen.getByTestId('viewport-controls-hint'));
  return utils;
}

describe('<ViewportControlsHelp>', () => {
  it('shows the summary bindings without being opened', () => {
    render(<ViewportControlsHelp mode="3D" />);
    expect(screen.getByTestId('viewport-controls-hint').textContent).toContain(
      controlsFor('3D').summary
    );
    expect(screen.queryByTestId('viewport-controls-panel')).toBeNull();
  });

  it('opens the panel on click and reports it through aria-expanded', () => {
    open();
    expect(screen.getByTestId('viewport-controls-panel')).toBeTruthy();
    expect(screen.getByTestId('viewport-controls-hint').getAttribute('aria-expanded')).toBe('true');
  });

  it('lists every binding for the 3D viewport, grouped by device', () => {
    open('3D');
    for (const group of controlsFor('3D').groups) {
      // Scoped to the group, since "Pinch" is under both Trackpad and Touch.
      const section = screen.getByText(group.device).closest('section');
      expect(section).toBeTruthy();
      for (const binding of group.bindings) {
        expect(within(section as HTMLElement).getByText(binding.input)).toBeTruthy();
      }
    }
  });

  it('advertises the 2D bindings in 2D, not the 3D ones', () => {
    open('2D');
    expect(screen.getByText('One-finger drag')).toBeTruthy();
    // The 2D stage has no camera to orbit.
    expect(screen.queryByText('Middle-drag')).toBeNull();
    expect(screen.getByRole('dialog', { name: '2D viewport controls' })).toBeTruthy();
  });

  it('opens on ?, and toggles back shut', () => {
    render(<ViewportControlsHelp mode="3D" />);
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByTestId('viewport-controls-panel')).toBeTruthy();
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.queryByTestId('viewport-controls-panel')).toBeNull();
  });

  it('leaves F1 alone — in a VS Code webview it is Show All Commands', () => {
    // `useGlobalShortcut` never calls preventDefault, so F1 would also open the
    // command palette.
    render(<ViewportControlsHelp mode="3D" />);
    fireEvent.keyDown(window, { key: 'F1' });
    expect(screen.queryByTestId('viewport-controls-panel')).toBeNull();
  });

  it('does not hijack ? typed into a text field', () => {
    render(
      <>
        <ViewportControlsHelp mode="3D" />
        <textarea data-testid="source" />
      </>
    );
    fireEvent.keyDown(screen.getByTestId('source'), { key: '?' });
    expect(screen.queryByTestId('viewport-controls-panel')).toBeNull();
  });

  it('closes on Escape', () => {
    open();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('viewport-controls-panel')).toBeNull();
  });

  it('closes on a pointer down outside, so it cannot eat a navigation drag', () => {
    open();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId('viewport-controls-panel')).toBeNull();
  });

  it('stays open when the pointer goes down inside it', () => {
    open();
    fireEvent.pointerDown(screen.getByTestId('viewport-controls-panel'));
    expect(screen.getByTestId('viewport-controls-panel')).toBeTruthy();
  });

  it('closes on the close button', () => {
    open();
    fireEvent.click(screen.getByLabelText('Close viewport controls'));
    expect(screen.queryByTestId('viewport-controls-panel')).toBeNull();
  });

  it('moves focus into the panel, and back to the pill on close', () => {
    // role="dialog" promises focus inside the panel.
    render(<ViewportControlsHelp mode="3D" />);
    const hint = screen.getByTestId('viewport-controls-hint');
    fireEvent.click(hint);
    expect(document.activeElement).toBe(screen.getByTestId('viewport-controls-panel'));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(document.activeElement).toBe(hint);
  });

  it('lets viewport drags through everywhere except the pill and the panel', () => {
    // The root is a full-width box over a draggable canvas, so it takes
    // `pointer-events: none` and only the two interactive children take `auto`.
    const css = readFileSync(
      path.join(import.meta.dirname, 'ViewportControlsHelp.module.css'),
      'utf8'
    );
    const block = (selector: string) =>
      new RegExp(`\\${selector}\\s*\\{[^}]*\\}`).exec(css)?.[0] ?? '';
    expect(block('.root')).toContain('pointer-events: none');
    expect(block('.hint')).toContain('pointer-events: auto');
    expect(block('.panel')).toContain('pointer-events: auto');
  });

  it('sits clear of the toolbar overlay, which grows leftward and outranks it', () => {
    // Bottom-left is the one free corner: a wrapped toolbar covers the top edge,
    // and bottom-centre holds the 2D hint and the zoom HUD.
    const css = readFileSync(
      path.join(import.meta.dirname, 'ViewportControlsHelp.module.css'),
      'utf8'
    );
    const root = /\.root\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(root).toContain('bottom:');
    expect(root).toContain('left:');
    expect(root).not.toContain('top:');

    const toolbar = readFileSync(
      path.join(import.meta.dirname, '../TscnPreviewShell/TscnPreviewShell.module.css'),
      'utf8'
    );
    const overlay = /\.viewportToolbarOverlay\s*\{[^}]*\}/.exec(toolbar)?.[0] ?? '';
    const zIndexOf = (block: string) => Number(/z-index:\s*(\d+)/.exec(block)?.[1] ?? '0');
    expect(zIndexOf(root)).toBeGreaterThan(zIndexOf(overlay));
  });
});

describe('controlsFor', () => {
  it('gives every binding a unique input WITHIN its device, so panel keys cannot collide', () => {
    // A label may repeat across devices, since each group's list scopes its React keys.
    for (const mode of ['2D', '3D'] as const) {
      for (const group of controlsFor(mode).groups) {
        const inputs = group.bindings.map((b) => b.input);
        expect(new Set(inputs).size).toBe(inputs.length);
      }
    }
  });

  it('covers mouse, trackpad and touch in both modes', () => {
    for (const mode of ['2D', '3D'] as const) {
      const devices = controlsFor(mode).groups.map((g) => g.device);
      expect(devices).toContain('Mouse');
      expect(devices).toContain('Trackpad');
      expect(devices).toContain('Touch');
    }
  });
});
