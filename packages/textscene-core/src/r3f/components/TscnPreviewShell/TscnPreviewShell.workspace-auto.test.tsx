import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const TESTID_OF_MODE: Record<string, string> = { '2D': 'canvas-2d', '3D': 'canvas-3d', 'in-game': 'in-game' };

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: ({ mode = '3D' }: { mode?: string }) => <div data-testid={TESTID_OF_MODE[mode]} />,
  TscnSceneContents: () => null,
}));

import { TextShell } from './TscnPreviewShell.testkit';
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

describe('<TextShell> workspace auto-select (Godot parity)', () => {
  it('opens a CanvasItem-root scene in the 2D workspace', async () => {
    render(<TextShell panelId="auto-a" content={SPRITE_SCENE} />);
    expect(await screen.findByTestId('canvas-2d')).toBeTruthy();
  });

  it('opens a Control-root scene in the 2D workspace', async () => {
    render(<TextShell panelId="auto-b" content={CONTROL_SCENE} />);
    expect(await screen.findByTestId('canvas-2d')).toBeTruthy();
  });

  it('opens a Node3D-root scene in the 3D workspace', async () => {
    render(<TextShell panelId="auto-c" content={THREED_SCENE} />);
    expect(await screen.findByTestId('canvas-3d')).toBeTruthy();
  });

  it('keeps the current workspace for a plain-Node root (Godot: no plugin claims it)', async () => {
    render(<TextShell panelId="auto-d" content={PLAIN_NODE_SCENE} />);
    expect(await screen.findByTestId('canvas-3d')).toBeTruthy();
  });

  it('re-derives the workspace when the scene switches', async () => {
    const { rerender } = render(<TextShell panelId="auto-e" content={THREED_SCENE} />);
    expect(await screen.findByTestId('canvas-3d')).toBeTruthy();

    rerender(<TextShell panelId="auto-e" content={SPRITE_SCENE} />);
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
        <TextShell panelId="auto-rootinst" content={content} />
      </ResourceLoaderProvider>
    );
    expect(await screen.findByTestId('canvas-2d')).toBeTruthy();
  });

  it('keeps the In-game mode when the scene switches', async () => {
    const { rerender } = render(<TextShell panelId="auto-f" content={THREED_SCENE} />);
    await screen.findByTestId('canvas-3d');
    fireEvent.click(screen.getByRole('button', { name: 'In-game' }));
    expect(await screen.findByTestId('in-game')).toBeTruthy();

    rerender(<TextShell panelId="auto-f" content={SPRITE_SCENE} />);
    await screen.findAllByText('World');
    expect(screen.getByTestId('in-game')).toBeTruthy();
    expect(screen.queryByTestId('canvas-2d')).toBeNull();
  });
});
