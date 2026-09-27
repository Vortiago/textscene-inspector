/**
 * The host's `rootScenePath` reaches `<Canvas2DStage>` through `<ViewportArea>`. The
 * stage starts load time again on a new path, so an edit under the same path must keep it.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));
// Canvas2DStage.test.tsx covers what the stage does with the path.
vi.mock('../Canvas2DStage/Canvas2DStage', () => ({
  Canvas2DStage: ({ scenePath }: { scenePath: string }) => (
    <div data-testid="stage-2d-stub" data-scene-path={scenePath} />
  ),
}));

import { TscnPreviewShell } from './TscnPreviewShell';

const NODE2D_ROOT = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node2D"]
`;

const EDITED_NODE2D_ROOT = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node2D"]

[node name="Added" type="Node2D" parent="."]
`;

function shellAt(rootScenePath: string, content: string) {
  return (
    <TscnPreviewShell
      panelId="scene-path"
      content={content}
      rootScenePath={rootScenePath}
      initialViewportMode="2D"
    />
  );
}

const stageScenePath = () =>
  screen.getByTestId('stage-2d-stub').getAttribute('data-scene-path');

describe('<TscnPreviewShell> scene path to the 2D stage', () => {
  it('hands the stage the path the host opened the scene under', async () => {
    render(shellAt('res://level.tscn', NODE2D_ROOT));
    await screen.findAllByText('Root');

    expect(stageScenePath()).toBe('res://level.tscn');
  });

  it('keeps the path across an edit of the open scene', async () => {
    const { rerender } = render(shellAt('res://level.tscn', NODE2D_ROOT));
    await screen.findAllByText('Root');

    rerender(shellAt('res://level.tscn', EDITED_NODE2D_ROOT));

    expect(screen.getByTestId('scene-info-nodes').textContent).toBe('2 nodes');
    expect(stageScenePath()).toBe('res://level.tscn');
  });

  it('hands the stage the new path when the host opens another scene', async () => {
    const { rerender } = render(shellAt('res://level.tscn', NODE2D_ROOT));
    await screen.findAllByText('Root');

    rerender(shellAt('res://other.tscn', NODE2D_ROOT));

    expect(stageScenePath()).toBe('res://other.tscn');
  });
});
