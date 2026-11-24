import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { TscnParser } from '../../../parser/TscnParser';
import { openScene } from '../../../scene/openScene';
import type { ResourceProvider } from '../../../resources/ResourceProvider';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));

import { TscnPreviewShell } from './TscnPreviewShell';
import { TextShell } from './TscnPreviewShell.testkit';

const NO_FILES: ResourceProvider = { loadResource: async () => null };

const LEVEL = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Player" type="Node3D" parent="."]
`;

describe('<TscnPreviewShell> scene', () => {
  it('parses its text once for every view', async () => {
    const parse = vi.spyOn(TscnParser.prototype, 'parse');
    render(<TextShell panelId="open-scene" content={LEVEL} rootScenePath="res://level.tscn" />);
    await screen.findAllByText('Root');
    expect(parse).toHaveBeenCalledTimes(1);
    parse.mockRestore();
  });
});

describe('<TscnPreviewShell> with the host’s scene', () => {
  it('draws the scene the host opened, and the text the host sets on it', async () => {
    const scene = openScene({ source: LEVEL, provider: NO_FILES, rootScenePath: 'res://level.tscn' });
    render(<TscnPreviewShell panelId="host-scene" scene={scene} />);
    await screen.findAllByText('Root');
    act(() => scene.setSource(LEVEL.replace('"Root"', '"Level"')));
    expect(await screen.findAllByText('Level')).not.toHaveLength(0);
  });

  it('leaves the scene open when it unmounts, since the host owns it', async () => {
    const scene = openScene({ source: LEVEL, provider: NO_FILES });
    const heard = vi.fn();
    scene.subscribe(heard);
    const { unmount } = render(<TscnPreviewShell panelId="host-scene" scene={scene} />);
    await screen.findAllByText('Root');
    unmount();
    heard.mockClear();
    scene.setSource(LEVEL.replace('"Root"', '"Level"'));
    expect(heard).toHaveBeenCalled();
  });
});
