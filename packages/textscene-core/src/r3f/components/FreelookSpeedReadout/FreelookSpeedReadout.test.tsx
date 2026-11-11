/**
 * The freelook speed readout: Godot's indicator bar and "m/s" label, shown for a moment after each
 * wheel change of the flight speed.
 */
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ViewportActionsProvider } from '../../contexts/ViewportActionsContext';
import { Freelook } from '../../freelook';
import { useViewportActions } from '../../testing/ViewportActionsProbe';
import { FreelookSpeedReadout } from './FreelookSpeedReadout';

/** `ZOOM_FREELOOK_INDICATOR_DELAY_S` (`node_3d_editor_plugin.cpp:121`), in milliseconds. */
const INDICATOR_MS = 1500;

/** Godot's editor camera: `default_z_near` 0.05 and `default_z_far` 4000 (`editor_settings.cpp:931-932`). */
const EDITOR_RANGE = { near: 0.05, far: 4000 };

function RegisteredFreelook({ freelook }: { freelook: Freelook }) {
  const { registerFreelook } = useViewportActions();
  useEffect(
    () => registerFreelook({ toggle: () => {}, getState: freelook.getState, subscribe: freelook.subscribe }),
    [registerFreelook, freelook]
  );
  return null;
}

function renderReadout(): Freelook {
  const freelook = new Freelook();
  render(
    <ViewportActionsProvider>
      <RegisteredFreelook freelook={freelook} />
      <FreelookSpeedReadout />
    </ViewportActionsProvider>
  );
  return freelook;
}

const readout = () => screen.queryByTestId('freelook-speed-readout');

describe('<FreelookSpeedReadout>', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows nothing before the speed changes', () => {
    renderReadout();

    expect(readout()).toBeNull();
  });

  it('shows the new speed with one decimal, as Godot does from 1 m/s up', () => {
    const freelook = renderReadout();

    act(() => freelook.scaleSpeed(1.08, EDITOR_RANGE));

    expect(readout()?.textContent).toBe('5.4 m/s');
  });

  it('shows two decimals below 1 m/s', () => {
    const freelook = renderReadout();

    act(() => freelook.scaleSpeed(0.05, EDITOR_RANGE));

    expect(readout()?.textContent).toBe('0.25 m/s');
  });

  it('fills the bar by the speed’s place in its range, on Godot’s logarithmic scale', () => {
    const freelook = renderReadout();

    act(() => freelook.scaleSpeed(1, EDITOR_RANGE));

    // log1p(5 - 0.2) / log1p(1000 - 0.2), from `node_3d_editor_plugin.cpp:3893-3899`.
    const fill = screen.getByTestId('freelook-speed-fill');
    expect(parseFloat(fill.style.height)).toBeCloseTo(25.4447, 3);
  });

  it('hides again after Godot’s indicator delay', () => {
    const freelook = renderReadout();
    act(() => freelook.scaleSpeed(1.08, EDITOR_RANGE));

    act(() => vi.advanceTimersByTime(INDICATOR_MS));

    expect(readout()).toBeNull();
  });

  it('stays for the whole delay after the last of several changes', () => {
    const freelook = renderReadout();
    act(() => freelook.scaleSpeed(1.08, EDITOR_RANGE));
    act(() => vi.advanceTimersByTime(INDICATOR_MS - 100));

    act(() => freelook.scaleSpeed(1.08, EDITOR_RANGE));
    act(() => vi.advanceTimersByTime(INDICATOR_MS - 100));

    expect(readout()).not.toBeNull();
  });
});
