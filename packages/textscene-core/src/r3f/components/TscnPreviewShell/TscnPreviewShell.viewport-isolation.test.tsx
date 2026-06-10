/**
 * Multi-Panel State Isolation contract, viewport-mode edition: two
 * <TscnPreviewShell> instances in one document must not share ViewportMode
 * state. Selection isolation on its own is already pinned in
 * TscnPreviewShell.test.tsx ("isolates selection state between two shells");
 * this file drives the combined flow — select in A, switch A to 2D — and
 * asserts B's mode AND selection stay untouched, and that A's selection
 * survives its own mode switch.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// happy-dom has no WebGL: stub the R3F canvas like the sibling shell tests do.
vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));
// Keep the 2D stage lean too — its pan/zoom chrome is covered by
// Canvas2DStage.test.tsx; here only "which viewport is mounted" matters.
vi.mock('../Canvas2DStage/Canvas2DStage', () => ({
  Canvas2DStage: () => <div data-testid="stage-2d-stub" />,
}));

import { TscnPreviewShell } from './TscnPreviewShell';

const MINIMAL_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="Node3D" parent="Root"]
`;

function shellEl(panelId: string): HTMLElement {
  return globalThis.document.querySelector(`[data-panel-id="${panelId}"]`) as HTMLElement;
}

function modeButton(shell: HTMLElement, label: '2D' | '3D'): HTMLButtonElement {
  const segment = shell.querySelector('[role="group"][aria-label="Viewport dimension"]');
  const button = Array.from(segment?.querySelectorAll('button') ?? []).find(
    (b) => b.textContent === label
  );
  expect(button).toBeTruthy();
  return button as HTMLButtonElement;
}

describe('<TscnPreviewShell> viewport-mode isolation between panels', () => {
  it('switching A to 2D leaves B in 3D, and neither selection bleeds nor resets', async () => {
    render(
      <>
        <TscnPreviewShell panelId="shell-a" content={MINIMAL_TSCN} />
        <TscnPreviewShell panelId="shell-b" content={MINIMAL_TSCN} />
      </>
    );
    const shellA = shellEl('shell-a');
    const shellB = shellEl('shell-b');

    // Both shells start in 3D with the canvas mounted.
    await screen.findAllByText('Root'); // lazy tree resolved in both
    expect(shellA.querySelector('[data-testid="canvas-stub"]')).toBeTruthy();
    expect(shellB.querySelector('[data-testid="canvas-stub"]')).toBeTruthy();
    expect(modeButton(shellA, '3D').getAttribute('aria-pressed')).toBe('true');
    expect(modeButton(shellB, '3D').getAttribute('aria-pressed')).toBe('true');

    // Select Root in shell A only.
    const rowInA = shellA.querySelector('[data-node-path="Root"] [class*=header]') as HTMLElement;
    expect(rowInA).toBeTruthy();
    await act(async () => {
      await userEvent.click(rowInA);
    });
    expect(shellA.querySelectorAll('[class*=selected]').length).toBeGreaterThan(0);
    expect(shellB.querySelectorAll('[class*=selected]').length).toBe(0);

    // Switch shell A to the 2D overlay.
    await act(async () => {
      await userEvent.click(modeButton(shellA, '2D'));
    });

    // A swapped viewports…
    expect(modeButton(shellA, '2D').getAttribute('aria-pressed')).toBe('true');
    expect(shellA.querySelector('[data-testid="canvas-stub"]')).toBeNull();
    expect(shellA.querySelector('[data-testid="stage-2d-stub"]')).toBeTruthy();

    // …while B is completely unaffected: still 3D, still canvas, still unselected.
    expect(modeButton(shellB, '3D').getAttribute('aria-pressed')).toBe('true');
    expect(modeButton(shellB, '2D').getAttribute('aria-pressed')).toBe('false');
    expect(shellB.querySelector('[data-testid="canvas-stub"]')).toBeTruthy();
    expect(shellB.querySelector('[data-testid="stage-2d-stub"]')).toBeNull();
    expect(shellB.querySelectorAll('[class*=selected]').length).toBe(0);

    // And A's own selection survives its viewport-mode switch — the mode only
    // swaps the center viewport, never the dock's selection state.
    expect(shellA.querySelectorAll('[class*=selected]').length).toBeGreaterThan(0);
  });

  it('switching B afterwards does not pull A back to 3D', async () => {
    render(
      <>
        <TscnPreviewShell panelId="shell-a" content={MINIMAL_TSCN} />
        <TscnPreviewShell panelId="shell-b" content={MINIMAL_TSCN} />
      </>
    );
    const shellA = shellEl('shell-a');
    const shellB = shellEl('shell-b');
    await screen.findAllByText('Root');

    await act(async () => {
      await userEvent.click(modeButton(shellA, '2D'));
    });
    await act(async () => {
      await userEvent.click(modeButton(shellB, '2D'));
    });
    // Both independently 2D now.
    expect(modeButton(shellA, '2D').getAttribute('aria-pressed')).toBe('true');
    expect(modeButton(shellB, '2D').getAttribute('aria-pressed')).toBe('true');

    // Flip B back to 3D; A must stay in 2D.
    await act(async () => {
      await userEvent.click(modeButton(shellB, '3D'));
    });
    expect(modeButton(shellB, '3D').getAttribute('aria-pressed')).toBe('true');
    expect(modeButton(shellA, '2D').getAttribute('aria-pressed')).toBe('true');
    expect(shellA.querySelector('[data-testid="stage-2d-stub"]')).toBeTruthy();
    expect(shellB.querySelector('[data-testid="canvas-stub"]')).toBeTruthy();
  });
});
