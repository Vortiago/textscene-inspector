import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { TextShell } from './TscnPreviewShell.testkit';
import { EditableProvider } from '../../../resources/testing/hotReloadHarness';

const HUD_PATH = 'res://hud.tscn';

vi.mock('../../TscnCanvas', async () => {
  const { useResource } = await import('../../../resources/useResource');
  return {
    TscnCanvas: () => {
      useResource('res://hud.tscn', 'scene');
      return <div data-testid="canvas-stub" />;
    },
  };
});

const HUD = `[gd_scene format=3]\n\n[node name="Hud" type="Control"]\n`;
const PLAIN_HUD = `[gd_scene format=3]\n\n[node name="Hud" type="Node3D"]\n`;
const SCENE = `[gd_scene format=3]\n\n[ext_resource type="PackedScene" path="${HUD_PATH}" id="h"]\n\n[node name="Root" type="Node3D"]\n\n[node name="Hud" parent="." instance=ExtResource("h")]\n`;
const HINT = { name: /switch to 2D/i };

describe('<TextShell provider>', () => {
  it("loads the scene's files through the provider", async () => {
    const provider = new EditableProvider();
    provider.write(HUD_PATH, HUD);

    render(<TextShell panelId="provider-a" content={SCENE} provider={provider} />);

    expect(await screen.findByRole('button', HINT)).toBeTruthy();
  });

  it('loads a file again when the provider says it changed, with no remount', async () => {
    const provider = new EditableProvider();
    provider.write(HUD_PATH, PLAIN_HUD);
    render(<TextShell panelId="provider-b" content={SCENE} provider={provider} />);
    const canvas = await screen.findByTestId('canvas-stub');
    expect(screen.queryByRole('button', HINT)).toBeNull();

    provider.write(HUD_PATH, HUD);
    act(() => provider.changed(HUD_PATH));

    expect(await screen.findByRole('button', HINT)).toBeTruthy();
    expect(screen.getByTestId('canvas-stub')).toBe(canvas);
  });
});
