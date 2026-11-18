import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ViewportModeProvider } from '../../contexts/ViewportModeContext';
import { ViewportToolbar } from './ViewportToolbar';
import { openDisplayMenu } from './DisplayMenu.testkit';

/** The toggles the running game overrides, so none of them changes the In-game view. */
const NO_EFFECT_IN_GAME = [
  'Gizmos',
  'Collisions',
  'Labels',
  'Navigation',
  'Frame on open',
  'Grid',
  'Fog',
  'Preview Sun',
  'Preview Sky',
];

const toggle = (label: string) => screen.getByRole('checkbox', { name: label }) as HTMLInputElement;
const clickMode = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));

describe('ViewportToolbar in the In-game view', () => {
  afterEach(() => window.localStorage.clear());

  it('disables each toggle that has no effect on the game', () => {
    render(
      <ViewportModeProvider initialMode="in-game">
        <ViewportToolbar />
      </ViewportModeProvider>
    );
    openDisplayMenu();
    const disabled = screen.getAllByRole('checkbox').filter((box) => (box as HTMLInputElement).disabled);
    expect(disabled.map((box) => box.parentElement?.textContent)).toEqual(NO_EFFECT_IN_GAME);
  });

  it('keeps the Performance toggle live, since the overlay times the game view too', () => {
    render(
      <ViewportModeProvider initialMode="in-game">
        <ViewportToolbar />
      </ViewportModeProvider>
    );
    openDisplayMenu();
    expect(toggle('Performance').disabled).toBe(false);
  });

  it('keeps the value of a disabled toggle for the 3D view', () => {
    render(
      <ViewportModeProvider initialMode="3D">
        <ViewportToolbar />
      </ViewportModeProvider>
    );
    openDisplayMenu();
    fireEvent.click(toggle('Grid'));
    clickMode('In-game');
    expect([toggle('Grid').checked, toggle('Grid').disabled]).toEqual([true, true]);
    clickMode('3D');
    expect([toggle('Grid').checked, toggle('Grid').disabled]).toEqual([true, false]);
  });
});
