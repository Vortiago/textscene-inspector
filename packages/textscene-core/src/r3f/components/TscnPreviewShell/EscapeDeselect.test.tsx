/**
 * EscapeDeselect — a global Escape key clears the current selection,
 * regardless of viewport mode (2D/3D). Guarded against firing while the
 * user is typing (the web app's Source pane, ADR-0020, or any input).
 */
import { describe, expect, it } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { SelectionProvider, useSelection } from '../../contexts/SelectionContext';
import { ViewportControlsHelp } from '../ViewportControlsHelp/ViewportControlsHelp';
import { EscapeDeselect } from './EscapeDeselect';

function Harness() {
  const { selectedNodePath, setSelectedNodePath } = useSelection();
  return (
    <div>
      <span data-testid="selected">{selectedNodePath ?? '(none)'}</span>
      <button type="button" onClick={() => setSelectedNodePath('Root/Cube')}>
        select
      </button>
      <input data-testid="text-input" />
      <EscapeDeselect />
    </div>
  );
}

function renderHarness() {
  return render(
    <SelectionProvider>
      <Harness />
    </SelectionProvider>
  );
}

describe('<EscapeDeselect> (#224)', () => {
  it('clears the selection on Escape', () => {
    const { getByText, getByTestId } = renderHarness();
    act(() => fireEvent.click(getByText('select')));
    expect(getByTestId('selected').textContent).toBe('Root/Cube');

    act(() => fireEvent.keyDown(globalThis.window, { key: 'Escape' }));
    expect(getByTestId('selected').textContent).toBe('(none)');
  });

  it('does nothing when nothing is selected', () => {
    const { getByTestId } = renderHarness();
    expect(() => act(() => fireEvent.keyDown(globalThis.window, { key: 'Escape' }))).not.toThrow();
    expect(getByTestId('selected').textContent).toBe('(none)');
  });

  it('ignores other keys', () => {
    const { getByText, getByTestId } = renderHarness();
    act(() => fireEvent.click(getByText('select')));
    act(() => fireEvent.keyDown(globalThis.window, { key: 'a' }));
    expect(getByTestId('selected').textContent).toBe('Root/Cube');
  });

  it('does NOT clear selection when Escape fires while a text input has focus', () => {
    const { getByText, getByTestId } = renderHarness();
    act(() => fireEvent.click(getByText('select')));
    const input = getByTestId('text-input');
    act(() => fireEvent.keyDown(input, { key: 'Escape' }));
    expect(getByTestId('selected').textContent).toBe('Root/Cube');
  });

  it('leaves the selection alone when Escape is dismissing a floating panel', () => {
    // Both live on window, so without arbitration one Escape did both: the
    // legend closed AND the node the user had selected before opening it was
    // silently cleared.
    const { getByText, getByTestId } = render(
      <SelectionProvider>
        <Harness />
        <ViewportControlsHelp mode="3D" />
      </SelectionProvider>
    );
    act(() => fireEvent.click(getByText('select')));
    act(() => fireEvent.click(getByTestId('viewport-controls-hint')));
    expect(getByTestId('viewport-controls-panel')).toBeTruthy();

    act(() => fireEvent.keyDown(globalThis.window, { key: 'Escape' }));
    expect(document.querySelector('[data-testid="viewport-controls-panel"]')).toBeNull();
    expect(getByTestId('selected').textContent).toBe('Root/Cube');

    // With the panel shut, Escape goes back to clearing the selection.
    act(() => fireEvent.keyDown(globalThis.window, { key: 'Escape' }));
    expect(getByTestId('selected').textContent).toBe('(none)');
  });
});
