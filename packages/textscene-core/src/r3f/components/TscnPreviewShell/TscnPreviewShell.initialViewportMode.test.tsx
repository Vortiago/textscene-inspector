/**
 * `initialViewportMode`, from the VS Code `textscene.defaultViewportMode`
 * setting, seeds the viewport and turns off WorkspaceAutoSelect for that
 * panel, so the root's claim cannot override it. Without it, auto-select decides.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));
vi.mock('../Canvas2DStage/Canvas2DStage', () => ({
  Canvas2DStage: () => <div data-testid="stage-2d-stub" />,
}));

import { TscnPreviewShell } from './TscnPreviewShell';

const NODE3D_ROOT = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

const NODE2D_ROOT = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node2D"]
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

describe('<TscnPreviewShell> initialViewportMode', () => {
  it('without the prop, auto-select still claims 2D for a Node2D root (unchanged default behavior)', async () => {
    render(<TscnPreviewShell panelId="default-behavior" content={NODE2D_ROOT} />);
    const shell = shellEl('default-behavior');
    await screen.findAllByText('Root');

    expect(modeButton(shell, '2D').getAttribute('aria-pressed')).toBe('true');
  });

  it('forces 2D and suppresses auto-select for a Node3D root that would otherwise claim 3D', async () => {
    render(
      <TscnPreviewShell panelId="forced-2d" content={NODE3D_ROOT} initialViewportMode="2D" />
    );
    const shell = shellEl('forced-2d');
    await screen.findAllByText('Root');

    expect(modeButton(shell, '2D').getAttribute('aria-pressed')).toBe('true');
    expect(shell.querySelector('[data-testid="stage-2d-stub"]')).toBeTruthy();
    expect(shell.querySelector('[data-testid="canvas-stub"]')).toBeNull();
  });

  it('forces 3D and suppresses auto-select for a Node2D root that would otherwise claim 2D', async () => {
    render(
      <TscnPreviewShell panelId="forced-3d" content={NODE2D_ROOT} initialViewportMode="3D" />
    );
    const shell = shellEl('forced-3d');
    await screen.findAllByText('Root');

    expect(modeButton(shell, '3D').getAttribute('aria-pressed')).toBe('true');
    expect(shell.querySelector('[data-testid="canvas-stub"]')).toBeTruthy();
  });

  it('still lets the user manually toggle away from a forced initial mode', async () => {
    render(
      <TscnPreviewShell panelId="forced-then-toggle" content={NODE3D_ROOT} initialViewportMode="2D" />
    );
    const shell = shellEl('forced-then-toggle');
    await screen.findAllByText('Root');
    expect(modeButton(shell, '2D').getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      await userEvent.click(modeButton(shell, '3D'));
    });

    expect(modeButton(shell, '3D').getAttribute('aria-pressed')).toBe('true');
    expect(shell.querySelector('[data-testid="canvas-stub"]')).toBeTruthy();
  });
});
