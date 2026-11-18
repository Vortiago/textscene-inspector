import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TscnCanvas } from './TscnCanvas';
import { openScene } from '../scene/openScene';
import { TscnParser } from '../parser/TscnParser';
import type { ResourceProvider } from '../resources/ResourceProvider';

vi.mock('@react-three/fiber', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/fiber')>()),
  // The editor's stage hands its canvas the editor camera. The game's stage hands it none.
  Canvas: vi.fn((props: { camera?: unknown }) => (
    <div data-testid="canvas" data-stage={props.camera ? 'editor' : 'game'} />
  )),
}));

// Canvas2DStage.test.tsx covers the stage. This records what the view hands it.
vi.mock('./components/Canvas2DStage/Canvas2DStage', () => ({
  Canvas2DStage: ({ nodes, scenePath }: { nodes: readonly { name: string }[]; scenePath: string }) => (
    <div data-testid="stage-2d" data-roots={nodes.map((node) => node.name).join(',')} data-path={scenePath} />
  ),
}));

const SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]
`;

const SCENE_2D = `[gd_scene format=3]

[node name="Menu" type="Control"]
`;

const provider: ResourceProvider = { loadResource: async () => null };

const stages = () => screen.queryAllByTestId('canvas').map((canvas) => canvas.dataset.stage);

describe('<TscnCanvas> mode', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mounts the editor’s 3D stage with no mode, as before the mode existed', () => {
    render(<TscnCanvas />);
    expect(stages()).toEqual(['editor']);
  });

  it('mounts the game’s stage in the In-game mode', async () => {
    render(<TscnCanvas mode="in-game" />);
    await screen.findByTestId('canvas');
    expect(stages()).toEqual(['game']);
  });

  it('replaces the stage on a change of mode, and leaves one canvas', async () => {
    const { rerender } = render(<TscnCanvas mode="3D" />);
    rerender(<TscnCanvas mode="in-game" />);
    await screen.findByTestId('canvas');
    expect(stages()).toEqual(['game']);
  });

  it('puts the host’s class on the element it fills', () => {
    const { container } = render(<TscnCanvas className="game-panel" />);
    expect(container.querySelector('.game-panel')).not.toBeNull();
  });

  it('draws a scene it is given with no provider around it', () => {
    const scene = openScene({ source: SCENE, provider });
    render(<TscnCanvas scene={scene} />);
    expect(stages()).toEqual(['editor']);
  });

  it('parses a scene once for two views of it in two modes', async () => {
    const parse = vi.spyOn(TscnParser.prototype, 'parse');
    const scene = openScene({ source: SCENE, provider });
    render(
      <>
        <TscnCanvas scene={scene} mode="3D" />
        <TscnCanvas scene={scene} mode="in-game" />
      </>
    );
    await screen.findAllByTestId('canvas');
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('mounts the editor’s 2D stage in the 2D mode, and no canvas of a 3D stage', () => {
    render(<TscnCanvas scene={openScene({ source: SCENE_2D, provider })} mode="2D" />);
    expect(screen.getByTestId('stage-2d').dataset.roots).toBe('Menu');
    expect(stages()).toEqual([]);
  });

  it('hands the 2D stage the path the scene opened under', () => {
    const scene = openScene({ source: SCENE_2D, provider, rootScenePath: 'res://ui/menu.tscn' });
    render(<TscnCanvas scene={scene} mode="2D" />);
    expect(screen.getByTestId('stage-2d').dataset.path).toBe('res://ui/menu.tscn');
  });
});
