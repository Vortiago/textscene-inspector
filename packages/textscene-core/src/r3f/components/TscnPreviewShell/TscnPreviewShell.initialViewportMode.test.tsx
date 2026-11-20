/**
 * `initialViewportMode`, from the VS Code `textscene.defaultViewportMode`
 * setting, seeds the viewport and turns off WorkspaceAutoSelect for that
 * panel, so the root's claim cannot override it. Without it, auto-select decides.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: ({ mode }: { mode?: string }) => (
    <div data-testid={mode === '2D' ? 'stage-2d-stub' : 'canvas-stub'} data-mode={mode ?? '3D'} />
  ),
  TscnSceneContents: () => null,
}));

import { TextShell } from './TscnPreviewShell.testkit';

const NODE3D_ROOT = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

const NODE2D_ROOT = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node2D"]
`;

function shellEl(panelId: string): HTMLElement {
  return globalThis.document.querySelector(`[data-panel-id="${panelId}"]`) as HTMLElement;
}

function modeButton(shell: HTMLElement, label: '2D' | '3D' | 'In-game'): HTMLButtonElement {
  const segment = shell.querySelector('[role="group"][aria-label="Viewport dimension"]');
  const button = Array.from(segment?.querySelectorAll('button') ?? []).find((b) => b.textContent === label);
  expect(button).toBeTruthy();
  return button as HTMLButtonElement;
}

describe('<TextShell> initialViewportMode', () => {
  it('without the prop, auto-select still claims 2D for a Node2D root (unchanged default behavior)', async () => {
    render(<TextShell panelId="default-behavior" content={NODE2D_ROOT} />);
    const shell = shellEl('default-behavior');
    await screen.findAllByText('Root');

    expect(modeButton(shell, '2D').getAttribute('aria-pressed')).toBe('true');
  });

  it('forces 2D and suppresses auto-select for a Node3D root that would otherwise claim 3D', async () => {
    render(<TextShell panelId="forced-2d" content={NODE3D_ROOT} initialViewportMode="2D" />);
    const shell = shellEl('forced-2d');
    await screen.findAllByText('Root');

    expect(modeButton(shell, '2D').getAttribute('aria-pressed')).toBe('true');
    expect(shell.querySelector('[data-testid="stage-2d-stub"]')).toBeTruthy();
    expect(shell.querySelector('[data-testid="canvas-stub"]')).toBeNull();
  });

  it('forces 3D and suppresses auto-select for a Node2D root that would otherwise claim 2D', async () => {
    render(<TextShell panelId="forced-3d" content={NODE2D_ROOT} initialViewportMode="3D" />);
    const shell = shellEl('forced-3d');
    await screen.findAllByText('Root');

    expect(modeButton(shell, '3D').getAttribute('aria-pressed')).toBe('true');
    expect(shell.querySelector('[data-testid="canvas-stub"]')).toBeTruthy();
  });

  it('still lets the user manually toggle away from a forced initial mode', async () => {
    render(<TextShell panelId="forced-then-toggle" content={NODE3D_ROOT} initialViewportMode="2D" />);
    const shell = shellEl('forced-then-toggle');
    await screen.findAllByText('Root');
    expect(modeButton(shell, '2D').getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      await userEvent.click(modeButton(shell, '3D'));
    });

    expect(modeButton(shell, '3D').getAttribute('aria-pressed')).toBe('true');
    expect(shell.querySelector('[data-testid="canvas-stub"]')).toBeTruthy();
  });

  it('forces the In-game mode, which draws the canvas in game', async () => {
    render(<TextShell panelId="forced-in-game" content={NODE2D_ROOT} initialViewportMode="in-game" />);
    const shell = shellEl('forced-in-game');
    await screen.findAllByText('Root');

    expect(modeButton(shell, 'In-game').getAttribute('aria-pressed')).toBe('true');
    expect(shell.querySelector('[data-testid="canvas-stub"]')?.getAttribute('data-mode')).toBe('in-game');
    expect(shell.querySelector('[data-testid="stage-2d-stub"]')).toBeNull();
  });
});
