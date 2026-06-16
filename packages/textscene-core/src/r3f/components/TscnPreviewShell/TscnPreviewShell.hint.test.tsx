/**
 * ADR-0006 (Godot-parity amendment): scenes whose ROOT keeps the viewport in
 * 3D but which carry CanvasItem content (a HUD, embedded 2D world nodes)
 * float a "switch to 2D" hint over the canvas — that content only renders in
 * the 2D workspace, like Godot's editor. Pure-3D scenes show no hint;
 * CanvasItem-root scenes auto-open in 2D, so no hint either.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));
vi.mock('../Canvas2DStage/Canvas2DStage', () => ({
  Canvas2DStage: () => <div data-testid="canvas-2d" />,
}));

import { TscnPreviewShell } from './TscnPreviewShell';

const MIXED_HUD_SCENE = `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n[node name="HUD" type="Control" parent="."]\n`;
const MIXED_WORLD_SCENE = `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n[node name="Decal" type="Sprite2D" parent="."]\n`;
const THREED_SCENE = `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n`;

describe('<TscnPreviewShell> 2D discoverability hint (ADR-0006)', () => {
  it('shows the hint for a 3D-root scene carrying Control UI', async () => {
    render(<TscnPreviewShell panelId="hint-a" content={MIXED_HUD_SCENE} />);
    const hint = await screen.findByRole('button', { name: /switch to 2D/i });
    expect(hint).toBeTruthy();
  });

  it('shows the hint for a 3D-root scene carrying 2D world content (invisible in 3D)', async () => {
    render(<TscnPreviewShell panelId="hint-b" content={MIXED_WORLD_SCENE} />);
    const hint = await screen.findByRole('button', { name: /switch to 2D/i });
    expect(hint).toBeTruthy();
  });

  it('does not show the hint for a pure-3D scene', async () => {
    render(<TscnPreviewShell panelId="hint-c" content={THREED_SCENE} />);
    await screen.findByTestId('canvas-stub');
    expect(screen.queryByRole('button', { name: /switch to 2D/i })).toBeNull();
  });

  it('switches to 2D mode when the hint is clicked (hint then disappears)', async () => {
    render(<TscnPreviewShell panelId="hint-d" content={MIXED_HUD_SCENE} />);
    const hint = await screen.findByRole('button', { name: /switch to 2D/i });
    fireEvent.click(hint);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /switch to 2D/i })).toBeNull()
    );
    expect(screen.getByTestId('canvas-2d')).toBeTruthy();
  });
});
