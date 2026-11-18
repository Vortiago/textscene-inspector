import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { act } from 'react';
import { GameViewContents } from './GameViewContents';
import { TscnSceneProvider } from '../TscnSceneProvider';
import { openScene } from '../../scene/openScene';
import { ROOT_VIEWPORT_PATH } from '../contexts/EnclosingViewportContext';
import type { ViewportDescription } from '../viewportRender/viewportDescription';
import type { ResourceProvider } from '../../resources/ResourceProvider';
import { settleLoads } from '../testing/settleLoads';
import { useSelection } from '../contexts/SelectionContext';
import { useEffect } from 'react';
import type { Vector2 } from '../../godot/math/vector';
import '../nodes';

const passes: { path: string; viewport: ViewportDescription; renderSize: Vector2 }[] = [];
/** The camera each viewport's pass draws through, by the viewport's path, written as the pass renders. */
const passCameras = new Map<string, string | null>();

vi.mock('../viewportRender/OffscreenViewportPass', async (importOriginal) => {
  const { WorldEnvironmentScope } = await import('../environment/WorldEnvironmentScope');
  const { ViewportDescriptionProvider } = await import('../viewportRender/viewportDescriptionContext');
  const { ViewportPassAttributes, usePassCameraPath } = await import('../environment/worldExposure');
  function PassCamera({ path }: { path: string }) {
    passCameras.set(path, usePassCameraPath());
    return null;
  }
  return {
    ...(await importOriginal<typeof import('../viewportRender/OffscreenViewportPass')>()),
    // The world each pass gives its content, as the pass does, with no target to draw.
    OffscreenViewportPass: ({
      path,
      viewport,
      renderSize,
      children,
    }: {
      path: string;
      viewport: ViewportDescription;
      renderSize: Vector2;
      children: ReactNode;
    }) => {
      passes.push({ path, viewport, renderSize });
      return (
        <ViewportDescriptionProvider description={viewport}>
          <WorldEnvironmentScope world="subViewport">
            {children}
            <ViewportPassAttributes path={path}>
              <PassCamera path={path} />
            </ViewportPassAttributes>
          </WorldEnvironmentScope>
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

function providerOf(project: string): ResourceProvider {
  return { loadResource: async (path) => (path === 'res://project.godot' ? project : null) };
}

const CONTROL_ROOT_SCENE = `[gd_scene format=3]

[node name="Main" type="Control"]

[node name="Box2" type="SubViewportContainer" parent="."]

[node name="SubViewport" type="SubViewport" parent="Box2"]

[node name="Camera3D" type="Camera3D" parent="Box2/SubViewport"]
current = true

[node name="Box" type="CSGBox3D" parent="Box2/SubViewport"]
`;

/** A selection made in the scene tree panel, which shares the view's providers. */
function SelectInTree({ path }: { path: string }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => setSelectedNodePath(path), [setSelectedNodePath, path]);
  return null;
}

async function mountGame(source = SCENE, selectedPath?: string) {
  return mountGameOf({ source, selectedPath });
}

async function mountGameOf({
  source,
  selectedPath,
  project = PROJECT,
  pane,
}: {
  source: string;
  selectedPath?: string;
  project?: string;
  pane?: { width: number; height: number };
}) {
  const scene = openScene({ source, provider: providerOf(project) });
  const renderer = await ReactThreeTestRenderer.create(
    <TscnSceneProvider scene={scene}>
      {selectedPath && <SelectInTree path={selectedPath} />}
      <GameViewContents />
    </TscnSceneProvider>,
    pane
  );
  await settleLoads();
  return Object.assign(renderer, { opened: scene });
}

const TWO_CAMERAS = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="A" type="Camera3D" parent="."]

[node name="B" type="Camera3D" parent="."]

[node name="Sub" type="SubViewport" parent="."]

[node name="Inner" type="Camera3D" parent="Sub"]
`;

/** Runs a host's call, and lets the views hear it as they do on the next frame. */
async function called(
  renderer: Awaited<ReturnType<typeof mountGame>>,
  path: string,
  method: string,
  ...args: boolean[]
) {
  await act(async () => {
    await renderer.opened.getNode(path).call(method, ...args);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  });
}

/** A 320 x 180 game in a 640 x 360 window: `canvas_items` stretches it by 2. */
const STRETCHED_PROJECT = `[display]
window/size/viewport_width=320
window/size/viewport_height=180
window/size/window_width_override=640
window/size/window_height_override=360
window/stretch/mode="canvas_items"
`;

const WINDOW_WITH_2D = `[gd_scene format=3]

[node name="Main" type="Node2D"]

[node name="Window" type="Window" parent="."]
size = Vector2i(100, 50)

[node name="Shape" type="Polygon2D" parent="Window"]
polygon = PackedVector2Array(0, 0, 10, 0, 10, 10)
`;

/** The last render size each viewport's pass drew at, by the viewport's path. */
function renderSizesByPath(): Map<string, Vector2> {
  return new Map(passes.map(({ path, renderSize }) => [path, renderSize]));
}

/** The last description each viewport's pass drew with, by the viewport's path. */
function descriptionsByPath(): Map<string, ViewportDescription> {
  return new Map(passes.map(({ path, viewport }) => [path, viewport]));
}

describe('the In-game mode', () => {
  afterEach(() => {
    passes.length = 0;
    passCameras.clear();
    vi.restoreAllMocks();
  });

  it("draws the root through a SubViewport's pass with the game's rules", async () => {
    await mountGame();
    expect(descriptionsByPath().get(ROOT_VIEWPORT_PATH)).toMatchObject({
      camera: 'current',
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
      camera: 'current',
      fallbackEnvironment: null,
    });
  });

  it('draws a SubViewport below a Control root through its own pass', async () => {
    await mountGame(CONTROL_ROOT_SCENE);
    expect(descriptionsByPath().get('Main/Box2/SubViewport')).toMatchObject({ camera: 'current' });
  });

  it('draws the root through its first camera when none is current', async () => {
    await mountGame(TWO_CAMERAS);
    expect(passCameras.get(ROOT_VIEWPORT_PATH)).toBe('Main/A');
  });

  it('draws the root through the camera a host makes current', async () => {
    const renderer = await mountGame(TWO_CAMERAS);
    await called(renderer, 'B', 'make_current');
    expect(passCameras.get(ROOT_VIEWPORT_PATH)).toBe('Main/B');
  });

  it('draws the root through no camera after clear_current(false), so the pass shows its clear colour', async () => {
    const renderer = await mountGame(TWO_CAMERAS);
    await called(renderer, 'A', 'clear_current', false);
    expect(passCameras.get(ROOT_VIEWPORT_PATH)).toBeNull();
  });

  it("keeps the root's camera when a camera inside a SubViewport is made current", async () => {
    const renderer = await mountGame(TWO_CAMERAS);
    await called(renderer, 'Sub/Inner', 'make_current');
    expect(passCameras.get(ROOT_VIEWPORT_PATH)).toBe('Main/A');
  });

  it('takes no pointer input: no object holds a pointer handler, so a click selects nothing', async () => {
    const renderer = await mountGame();
    const handled = renderer.scene.findAll((node) =>
      Object.entries(node.props).some(
        ([prop, value]) =>
          /^on(Pointer|Click|DoubleClick|ContextMenu|Wheel)/.test(prop) && typeof value === 'function'
      )
    );
    expect(handled.map((node) => node.props.name)).toEqual([]);
  });

  it('draws no box around a node selected in the scene tree', async () => {
    const renderer = await mountGame(SCENE, 'Main/Box');
    // The box is added to the three.js scene by hand, so only a walk of that scene finds it.
    const names: string[] = [];
    renderer.scene.instance.traverse((object) => names.push(object.name));
    expect(names).not.toContain('tscn-selection-highlight');
  });

  it("renders an embedded window at the stretch of the root the pane draws, not of the project's window", async () => {
    // The pane is half the window, so the drawn root is 320 x 180 over a 320 x 180 override: a stretch of 1.
    await mountGameOf({
      source: WINDOW_WITH_2D,
      project: STRETCHED_PROJECT,
      pane: { width: 320, height: 180 },
    });
    expect(renderSizesByPath().get('Main/Window')).toEqual({ x: 100, y: 50 });
  });

  it('binds no listener on the window', async () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    await mountGame();
    // A MediaQueryList shares the method. The renderer watches the pixel ratio through one.
    const onWindow = addListener.mock.calls.filter((_, call) => addListener.mock.contexts[call] === window);
    expect(onWindow).toEqual([]);
  });
});
