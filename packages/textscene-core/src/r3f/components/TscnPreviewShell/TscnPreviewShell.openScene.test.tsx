/**
 * The shell opens its text with `openScene`, so its views and a host's code read one parse.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TscnParser } from '../../../parser/TscnParser';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));

import { TscnPreviewShell } from './TscnPreviewShell';

const LEVEL = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Player" type="Node3D" parent="."]
`;

describe('<TscnPreviewShell> scene', () => {
  it('parses its text once for every view', async () => {
    const parse = vi.spyOn(TscnParser.prototype, 'parse');
    render(<TscnPreviewShell panelId="open-scene" content={LEVEL} rootScenePath="res://level.tscn" />);
    await screen.findAllByText('Root');
    expect(parse).toHaveBeenCalledTimes(1);
    parse.mockRestore();
  });
});
