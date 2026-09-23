/**
 * ADR-0006: a scene opens in the workspace its root claims. A CanvasItem root
 * gives 2D, a Node3D root gives 3D, and a plain Node keeps the current one. A
 * manual toggle lasts until the next scene switch.
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
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type { TscnScene } from '../../../parser/types';

function makeLoader(scenes: Record<string, TscnScene>): ResourceLoader {
  const fake = createFakeResourceLoader();
  for (const [path, scene] of Object.entries(scenes)) fake.scenes.seed(path, scene);
  return fake.loader;
}

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

  it('opens a scene whose ROOT is itself an instance in the sub-scene workspace', async () => {
    // The root is an instance with no own type. Only the merged sub-scene root,
    // a Control, claims the 2D workspace.
    const menu = new TscnParser().parse(`[gd_scene format=3]\n\n[node name="Menu" type="Control"]\n`);
    const loader = makeLoader({ 'res://menu.tscn': menu as TscnScene });
    const content = `[gd_scene format=3]\n\n[ext_resource type="PackedScene" path="res://menu.tscn" id="m"]\n\n[node name="Menu" instance=ExtResource("m")]\n`;
    render(
      <ResourceLoaderProvider loader={loader}>
        <TscnPreviewShell panelId="auto-rootinst" content={content} />
      </ResourceLoaderProvider>
    );
    expect(await screen.findByTestId('canvas-2d')).toBeTruthy();
  });
});
