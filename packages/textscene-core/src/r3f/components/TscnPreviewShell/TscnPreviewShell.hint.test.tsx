/**
 * ADR-0006: the viewport defaults to 3D, but when a scene also carries 2D-UI
 * (Control/CanvasLayer) nodes the shell floats a "switch to 2D" hint over the
 * canvas so the overlay is discoverable. Pure-3D scenes show no hint.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));

import { TscnPreviewShell } from './TscnPreviewShell';

const UI_SCENE = `[gd_scene format=3]\n\n[node name="UI" type="Control"]\nanchors_preset = 15\n`;
const THREED_SCENE = `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n`;

describe('<TscnPreviewShell> 2D-UI discoverability hint (ADR-0006)', () => {
  it('shows the "switch to 2D" hint in 3D mode when the scene has 2D UI', async () => {
    render(<TscnPreviewShell panelId="hint-a" content={UI_SCENE} />);
    const hint = await screen.findByRole('button', { name: /switch to 2D/i });
    expect(hint).toBeTruthy();
  });

  it('does not show the hint for a pure-3D scene', async () => {
    render(<TscnPreviewShell panelId="hint-b" content={THREED_SCENE} />);
    await screen.findByTestId('canvas-stub');
    expect(screen.queryByRole('button', { name: /switch to 2D/i })).toBeNull();
  });

  it('switches to 2D mode when the hint is clicked (hint then disappears)', async () => {
    render(<TscnPreviewShell panelId="hint-c" content={UI_SCENE} />);
    const hint = await screen.findByRole('button', { name: /switch to 2D/i });
    fireEvent.click(hint);
    // The hint is 3D-only; switching to 2D unmounts it (the lazy overlay mounts).
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /switch to 2D/i })).toBeNull()
    );
  });
});
