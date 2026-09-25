/**
 * ADR-0006: a scene with a 3D root and CanvasItem content floats a "switch to
 * 2D" hint, since that content renders only in the 2D workspace. A pure-3D
 * scene and a CanvasItem-root scene show no hint.
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
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../../../resources/ResourceEventBus';
import { TscnParser } from '../../../parser/TscnParser';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type { TscnScene } from '../../../parser/types';

function makeLoader(scenes: Record<string, TscnScene>): ResourceLoader {
  const proc = <T,>(cache: Record<string, T>) => ({
    getCached: (p: string) => cache[p],
    isCached: (p: string) => p in cache,
    isLoading: () => false,
    request: () => {},
    clearCache: () => {},
    getCacheSize: () => Object.keys(cache).length,
  });
  return {
    eventBus: new ResourceEventBus(),
    scenes: proc<TscnScene>(scenes),
    glbMeshes: proc<never>({}),
    register: () => {},
  } as unknown as ResourceLoader;
}

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

  it('shows the hint when the 2D content lives inside an instanced sub-scene', async () => {
    // The Control lives inside an instanced HUD sub-scene, which only the live
    // tree descends into.
    const hud = new TscnParser().parse(`[gd_scene format=3]\n\n[node name="Hud" type="Control"]\n`);
    const loader = makeLoader({ 'res://hud.tscn': hud as TscnScene });
    const content = `[gd_scene format=3]\n\n[ext_resource type="PackedScene" path="res://hud.tscn" id="h"]\n\n[node name="Root" type="Node3D"]\n\n[node name="Hud" parent="." instance=ExtResource("h")]\n`;
    render(
      <ResourceLoaderProvider loader={loader}>
        <TscnPreviewShell panelId="hint-sub" content={content} />
      </ResourceLoaderProvider>
    );
    const hint = await screen.findByRole('button', { name: /switch to 2D/i });
    expect(hint).toBeTruthy();
  });
});
