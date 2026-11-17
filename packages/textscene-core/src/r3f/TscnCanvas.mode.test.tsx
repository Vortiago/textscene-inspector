/**
 * The view's mode picks the stage it mounts, and a scene given to the view needs no provider
 * around it. A happy-dom render creates no WebGL context, so a stand-in canvas marks each stage.
 */
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

const SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]
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
});
