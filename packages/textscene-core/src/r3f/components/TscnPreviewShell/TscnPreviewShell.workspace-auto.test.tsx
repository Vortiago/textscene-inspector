/**
 * Godot-editor parity (ADR-0006 amendment): opening a scene selects the
 * workspace from the root node's type — CanvasItem root → 2D, Node3D root →
 * 3D, plain Node root → keep the current workspace. Switching scenes
 * re-derives; a manual toggle only lasts until the next scene switch.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-3d" />,
  TscnSceneContents: () => null,
}));
vi.mock('../Canvas2DStage/Canvas2DStage', () => ({
  Canvas2DStage: () => <div data-testid="canvas-2d" />,
}));

import { TscnPreviewShell } from './TscnPreviewShell';

const SPRITE_SCENE = `[gd_scene format=3]\n\n[node name="World" type="Sprite2D"]\n`;
const CONTROL_SCENE = `[gd_scene format=3]\n\n[node name="UI" type="Control"]\n`;
const THREED_SCENE = `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n`;
const PLAIN_NODE_SCENE = `[gd_scene format=3]\n\n[node name="Main" type="Node"]\n\n[node name="S" type="Sprite2D" parent="."]\n`;

describe('<TscnPreviewShell> workspace auto-select (Godot parity)', () => {
  it('opens a CanvasItem-root scene in the 2D workspace', async () => {
    render(<TscnPreviewShell panelId="auto-a" content={SPRITE_SCENE} />);
    expect(await screen.findByTestId('canvas-2d')).toBeTruthy();
  });

  it('opens a Control-root scene in the 2D workspace', async () => {
    render(<TscnPreviewShell panelId="auto-b" content={CONTROL_SCENE} />);
    expect(await screen.findByTestId('canvas-2d')).toBeTruthy();
  });

  it('opens a Node3D-root scene in the 3D workspace', async () => {
    render(<TscnPreviewShell panelId="auto-c" content={THREED_SCENE} />);
    expect(await screen.findByTestId('canvas-3d')).toBeTruthy();
  });

  it('keeps the current workspace for a plain-Node root (Godot: no plugin claims it)', async () => {
    render(<TscnPreviewShell panelId="auto-d" content={PLAIN_NODE_SCENE} />);
    expect(await screen.findByTestId('canvas-3d')).toBeTruthy();
  });

  it('re-derives the workspace when the scene switches', async () => {
    const { rerender } = render(
      <TscnPreviewShell panelId="auto-e" content={THREED_SCENE} />
    );
    expect(await screen.findByTestId('canvas-3d')).toBeTruthy();

    rerender(<TscnPreviewShell panelId="auto-e" content={SPRITE_SCENE} />);
    expect(await screen.findByTestId('canvas-2d')).toBeTruthy();
  });
});
