/**
 * The In-game mode draws the root viewport through the pass a SubViewport draws through, with the
 * game's description, and mounts nothing that takes input. A stand-in pass records what each
 * viewport gives it, since the test renderer draws no frame.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { GameViewContents } from './GameView';
import { TscnSceneProvider } from '../TscnSceneProvider';
import { openScene } from '../../scene/openScene';
import { ROOT_VIEWPORT_PATH } from './rootViewportNode';
import type { ViewportDescription } from '../viewportRender/viewportDescription';
import type { ResourceProvider } from '../../resources/ResourceProvider';
import { settleLoads } from '../testing/settleLoads';
import '../nodes';

const passes: { path: string; viewport: ViewportDescription }[] = [];

vi.mock('../viewportRender/OffscreenViewportPass', async (importOriginal) => {
  const { WorldEnvironmentScope } = await import('../environment/WorldEnvironmentScope');
  const { ViewportDescriptionProvider } = await import('../viewportRender/viewportDescriptionContext');
  return {
    ...(await importOriginal<typeof import('../viewportRender/OffscreenViewportPass')>()),
    // The world each pass gives its content, as the pass does, with no target to draw.
    OffscreenViewportPass: ({
      path,
      viewport,
      children,
    }: {
      path: string;
      viewport: ViewportDescription;
      children: ReactNode;
    }) => {
      passes.push({ path, viewport });
      return (
        <ViewportDescriptionProvider description={viewport}>
          <WorldEnvironmentScope world="subViewport">{children}</WorldEnvironmentScope>
        </ViewportDescriptionProvider>
      );
    },
  };
});

const PROJECT = `[rendering]
environment/defaults/default_environment="res://default_env.tres"
`;

const SCENE = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Camera3D" type="Camera3D" parent="."]
current = true

[node name="Box" type="CSGBox3D" parent="."]

[node name="Sub" type="SubViewport" parent="."]

[node name="Inner" type="CSGBox3D" parent="Sub"]
`;

const provider: ResourceProvider = {
  loadResource: async (path) => (path === 'res://project.godot' ? PROJECT : null),
};

async function mountGame() {
  const scene = openScene({ source: SCENE, provider });
  const renderer = await ReactThreeTestRenderer.create(
    <TscnSceneProvider scene={scene}>
      <GameViewContents />
    </TscnSceneProvider>
  );
  await settleLoads();
  return renderer;
}

/** The last description each viewport's pass drew with, by the viewport's path. */
function descriptionsByPath(): Map<string, ViewportDescription> {
  return new Map(passes.map(({ path, viewport }) => [path, viewport]));
}

describe('the In-game mode', () => {
  afterEach(() => {
    passes.length = 0;
    vi.restoreAllMocks();
  });

  it("draws the root through a SubViewport's pass with the game's rules", async () => {
    await mountGame();
    expect(descriptionsByPath().get(ROOT_VIEWPORT_PATH)).toMatchObject({
      camera: 'elected',
      drawsEditorChrome: false,
      previewsEnvironment: false,
    });
  });

  it("gives the root the project's default Environment as its world's fallback", async () => {
    await mountGame();
    expect(descriptionsByPath().get(ROOT_VIEWPORT_PATH)?.fallbackEnvironment).toBe('res://default_env.tres');
  });

  it('draws a SubViewport of the scene through the same pass with its own description', async () => {
    await mountGame();
    expect(descriptionsByPath().get('Main/Sub')).toMatchObject({
      camera: 'elected',
      fallbackEnvironment: null,
    });
  });

  it('takes no pointer input: no object holds a pointer handler, so a click selects nothing', async () => {
    const renderer = await mountGame();
    const handled = renderer.scene.findAll((node) =>
      Object.keys(node.props).some((prop) => /^on(Pointer|Click|DoubleClick|ContextMenu|Wheel)/.test(prop))
    );
    expect(handled.map((node) => node.props.name)).toEqual([]);
  });

  it('binds no listener on the window', async () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    await mountGame();
    // A MediaQueryList shares the method. The renderer watches the pixel ratio through one.
    const onWindow = addListener.mock.calls.filter((_, call) => addListener.mock.contexts[call] === window);
    expect(onWindow).toEqual([]);
  });
});
