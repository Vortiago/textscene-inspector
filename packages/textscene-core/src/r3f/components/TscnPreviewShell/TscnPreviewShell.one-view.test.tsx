import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TscnParser } from '../../../parser/TscnParser';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext';

// happy-dom has no WebGL. The stub shows which view mounts, in which mode, and on whose scene.
vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: ({ mode, scene }: { mode?: string; scene?: unknown }) => {
    const shellScene = useOptionalHierarchy()?.scene;
    return (
      <div
        data-testid="view"
        data-mode={mode ?? '3D'}
        data-own-scene={String(scene !== undefined)}
        data-shell-scene={String(shellScene !== undefined)}
      />
    );
  },
}));

import { TextShell } from './TscnPreviewShell.testkit';

const SCENE = `[gd_scene format=3]

[node name="Root" type="Node"]
`;

const views = () => screen.queryAllByTestId('view');

describe('<TextShell> one view for every mode', () => {
  it.each(['2D', '3D', 'in-game'] as const)('mounts one view in the %s mode', async (mode) => {
    render(<TextShell panelId={`one-${mode}`} content={SCENE} initialViewportMode={mode} />);
    await screen.findAllByText('Root');
    expect(views().map((view) => view.dataset.mode)).toEqual([mode]);
  });

  it('draws the shell’s own scene, with no scene of its own', async () => {
    render(<TextShell panelId="one-scene" content={SCENE} initialViewportMode="2D" />);
    await screen.findAllByText('Root');
    const [view] = views();
    expect([view?.dataset.ownScene, view?.dataset.shellScene]).toEqual(['false', 'true']);
  });

  it('parses the text once in the 2D mode', async () => {
    const parse = vi.spyOn(TscnParser.prototype, 'parse');
    render(<TextShell panelId="one-parse" content={SCENE} initialViewportMode="2D" />);
    await screen.findAllByText('Root');
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
