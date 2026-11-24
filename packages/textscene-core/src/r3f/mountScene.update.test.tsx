import { act, render } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountScene } from './mountScene';
import { openScene } from '../scene/openScene';
import type { ResourceProvider } from '../resources/ResourceProvider';

// A happy-dom render creates no WebGL context, so the stub shows each stage and its frameloop.
vi.mock('@react-three/fiber', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@react-three/fiber')>()),
  // The editor's stage hands its canvas the editor camera. The game's stage hands it none.
  Canvas: vi.fn((props: { camera?: unknown; frameloop?: string }) => (
    <div data-testid="canvas" data-stage={props.camera ? 'editor' : 'game'} data-frameloop={props.frameloop}>
      <canvas />
    </div>
  )),
}));

vi.mock('./editorView/Canvas2DStage/Canvas2DStage', () => ({
  Canvas2DStage: () => <div data-testid="canvas" data-stage="2D" />,
}));

const NO_FILES: ResourceProvider = { loadResource: async () => null };
const SCENE =
  '[gd_scene format=3]\n\n[node name="Main" type="Node3D"]\n\n[node name="Box" type="Node3D" parent="."]\n';

function element(): HTMLElement {
  const host = document.createElement('div');
  document.body.append(host);
  return host;
}

const canvasesOf = (host: HTMLElement) => [...host.querySelectorAll<HTMLElement>('[data-testid="canvas"]')];

async function mountedIn(host: HTMLElement, options?: Parameters<typeof mountScene>[2]) {
  const view = await act(async () =>
    mountScene(host, openScene({ source: SCENE, provider: NO_FILES }), options)
  );
  return view;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('View.update', () => {
  it.each([
    ['in-game', '3D', 'editor'],
    ['3D', '2D', '2D'],
    ['2D', 'in-game', 'game'],
  ] as const)('switches a view mounted in %s to %s, and leaves one stage', async (from, to, stage) => {
    const host = element();
    const view = await mountedIn(host, { mode: from });

    await act(async () => view.update({ mode: to }));

    await vi.waitFor(() => expect(canvasesOf(host).map((canvas) => canvas.dataset.stage)).toEqual([stage]));
    view.dispose();
  });

  it('keeps the scene’s writes across a switch', async () => {
    const scene = openScene({ source: SCENE, provider: NO_FILES });
    const view = await act(async () => mountScene(element(), scene, { mode: '3D' }));
    await scene.getNode('Box').set('visible', false);

    await act(async () => view.update({ mode: '2D' }));

    expect(await scene.getNode('Box').get('visible')).toBe(false);
    view.dispose();
  });

  it('waits with a settled read from before a switch, as the new mode settles it', async () => {
    const view = await mountedIn(element());
    const settled = view.settled;

    await act(async () => view.update({ mode: '3D' }));
    view.dispose();

    await expect(settled).rejects.toThrow('expected the view to settle before its dispose');
  });

  it('refuses a capture until the mode it switched to draws a frame', async () => {
    const view = await mountedIn(element());

    await act(async () => view.update({ mode: '2D' }));

    await expect(view.captureImage()).rejects.toThrow('expected a settled view, got no view mounted');
    view.dispose();
  });

  it('refuses an update once disposed', async () => {
    const view = await mountedIn(element());
    view.dispose();

    expect(() => view.update({ mode: '3D' })).toThrow(
      'expected a mounted view to update, got a disposed one'
    );
  });

  it('loses the context of the canvas a switch replaces, before update returns', async () => {
    const loseContext = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      getExtension: () => ({ loseContext }),
    } as unknown as WebGL2RenderingContext);
    const view = await mountedIn(element(), { mode: '3D' });

    view.update({ mode: '2D' });

    expect(loseContext).toHaveBeenCalledTimes(1);
    view.dispose();
  });

  it('draws no frame while visible is false', async () => {
    const host = element();
    const view = await mountedIn(host, { mode: '3D', visible: false });

    expect(canvasesOf(host)[0]!.dataset.frameloop).toBe('never');
    view.dispose();
  });

  it('draws again once visible turns true', async () => {
    const host = element();
    const view = await mountedIn(host, { mode: '3D', visible: false });

    await act(async () => view.update({ visible: true }));

    expect(canvasesOf(host)[0]!.dataset.frameloop).toBe('always');
    view.dispose();
  });

  it('changes only the keys it is given', async () => {
    const host = element();
    const view = await mountedIn(host, { mode: '3D', visible: false });

    await act(async () => view.update({ mode: 'in-game' }));

    await vi.waitFor(() =>
      expect(canvasesOf(host).map(({ dataset }) => [dataset.stage, dataset.frameloop])).toEqual([
        ['game', 'never'],
      ])
    );
    view.dispose();
  });

  it('loses the replaced canvas of a switch a host calls inside its own React commit', async () => {
    const host = element();
    const view = await mountedIn(host, { mode: '3D' });
    const replaced = host.querySelector('canvas')!;
    const getContext = vi.spyOn(replaced, 'getContext');
    const Switcher = () => {
      useLayoutEffect(() => view.update({ mode: 'in-game' }), []);
      return null;
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => void render(<Switcher />));

    await vi.waitFor(() => expect(getContext).toHaveBeenCalledWith('webgl2'));
    view.dispose();
  });
});
