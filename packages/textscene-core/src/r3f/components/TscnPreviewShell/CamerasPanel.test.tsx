/**
 * The Cameras panel lists BOTH camera kinds: Camera3D rows drive the 3D
 * viewport swap (CameraControlContext.switchToCamera); Camera2D rows frame
 * the 2D stage on the camera's view (requestFrame2D + switch to the 2D
 * workspace) — the 2D "use this camera" equivalent.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CamerasPanel } from './CamerasPanel';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import {
  CameraControlProvider,
  useCameraControl,
} from '../../contexts/CameraControlContext';
import {
  ViewportModeProvider,
  useViewportMode,
} from '../../contexts/ViewportModeContext';
import { SceneGraphBuilder } from '../../../core/SceneGraphBuilder';
import { TscnParser } from '../../../parser/TscnParser';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { ResourceEventBus } from '../../../resources/ResourceEventBus';
import type { ResourceLoader } from '../../../resources/ResourceLoader';
import type { TscnNode, TscnScene } from '../../../parser/types';

const SCENE = `[gd_scene format=3]

[node name="World" type="Node2D"]

[node name="Player" type="Node2D" parent="."]
position = Vector2(100, 50)

[node name="Cam" type="Camera2D" parent="Player"]
position = Vector2(20, 10)
zoom = Vector2(2, 2)

[node name="Eye" type="Camera3D" parent="."]
`;

function Probe() {
  const cam = useCameraControl();
  const { mode } = useViewportMode();
  return (
    <div
      data-testid="probe"
      data-mode={mode}
      data-frame={cam.frame2D ? `${cam.frame2D.center.x},${cam.frame2D.center.y}@${cam.frame2D.zoom}` : ''}
    />
  );
}

function renderPanel() {
  const parsed = new TscnParser().parse(SCENE);
  const sceneGraph = new SceneGraphBuilder()
    .setRootScene('res://test.tscn')
    .addScene({ ...parsed, path: 'res://test.tscn' })
    .build();
  return render(
    <HierarchyProvider value={{ sceneGraph, panelId: 'cams-test' }}>
      <CameraControlProvider>
        <ViewportModeProvider>
          <Probe />
          <CamerasPanel />
        </ViewportModeProvider>
      </CameraControlProvider>
    </HierarchyProvider>
  );
}

describe('<CamerasPanel> with 2D cameras', () => {
  it('lists Camera2D nodes alongside Camera3D nodes', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /Cam/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Eye/ })).toBeTruthy();
  });

  it('clicking a Camera2D frames the 2D stage on its world view and opens the 2D workspace', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Cam/ }));
    const probe = screen.getByTestId('probe');
    // World position (120, 60), DRAG_CENTER default, zoom 2.
    expect(probe.getAttribute('data-frame')).toBe('120,60@2');
    expect(probe.getAttribute('data-mode')).toBe('2D');
  });
});

describe('<CamerasPanel> with cameras inside instanced sub-scenes', () => {
  function makeNode(name: string, type: string, extras: Partial<TscnNode> = {}): TscnNode {
    return { name, type, children: [], properties: {}, ...extras };
  }

  function makeLoader(scenes: Record<string, TscnScene>): ResourceLoader {
    const proc = <T,>(cache: Record<string, T>) => ({
      getCached: (p: string) => cache[p],
      isCached: (p: string) => p in cache,
      isLoading: () => false,
      request: () => {},
      clearCache: () => {},
      getCacheSize: () => Object.keys(cache).length,
    });
    return {
      eventBus: new ResourceEventBus(),
      scenes: proc<TscnScene>(scenes),
      glbMeshes: proc<never>({}),
      register: () => {},
    } as unknown as ResourceLoader;
  }

  it('lists a Camera3D nested inside an instance (absent from flattenedNodes)', () => {
    // Root scene instances player.tscn; the follow-camera lives inside it.
    const root = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="4_ray"]

[node name="Game" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("4_ray")]
`;
    const playerScene: TscnScene = {
      nodes: [
        makeNode('Player', 'CharacterBody3D', {
          children: [
            makeNode('Target', 'Node3D', { children: [makeNode('FollowCam', 'Camera3D')] }),
          ],
        }),
      ],
      externalResources: [],
      internalResources: [],
    };
    const parsed = new TscnParser().parse(root);
    const sceneGraph = new SceneGraphBuilder()
      .setRootScene('res://game.tscn')
      .addScene({ ...parsed, path: 'res://game.tscn' })
      .build();
    const loader = makeLoader({ 'res://player.tscn': playerScene });

    render(
      <ResourceLoaderProvider loader={loader}>
        <HierarchyProvider value={{ sceneGraph, panelId: 'cams-nested' }}>
          <CameraControlProvider>
            <ViewportModeProvider>
              <CamerasPanel />
            </ViewportModeProvider>
          </CameraControlProvider>
        </HierarchyProvider>
      </ResourceLoaderProvider>
    );

    expect(screen.getByRole('button', { name: /FollowCam/ })).toBeTruthy();
  });

  it('frames a Camera2D inside an instanced sub-scene at its world position, not the origin', () => {
    // game.tscn: Game → Player (instance of player.tscn at 100,50).
    // player.tscn: PlayerRoot → Cam (Camera2D at 20,10, zoom 2). The camera's
    // world position is 120,60 — composed over the LIVE tree (the sub-scene Cam
    // is absent from flattenedNodes, so the old static walk framed at 0,0).
    const root = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="p"]

[node name="Game" type="Node2D"]

[node name="Player" parent="." instance=ExtResource("p")]
position = Vector2(100, 50)
`;
    const playerScene = new TscnParser().parse(`[gd_scene format=3]

[node name="PlayerRoot" type="Node2D"]

[node name="Cam" type="Camera2D" parent="."]
position = Vector2(20, 10)
zoom = Vector2(2, 2)
`);
    const parsed = new TscnParser().parse(root);
    const sceneGraph = new SceneGraphBuilder()
      .setRootScene('res://game.tscn')
      .addScene({ ...parsed, path: 'res://game.tscn' })
      .build();
    const loader = makeLoader({ 'res://player.tscn': playerScene as TscnScene });

    render(
      <ResourceLoaderProvider loader={loader}>
        <HierarchyProvider value={{ sceneGraph, panelId: 'cams-2d-nested' }}>
          <CameraControlProvider>
            <ViewportModeProvider>
              <Probe />
              <CamerasPanel />
            </ViewportModeProvider>
          </CameraControlProvider>
        </HierarchyProvider>
      </ResourceLoaderProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Cam/ }));
    const probe = screen.getByTestId('probe');
    expect(probe.getAttribute('data-frame')).toBe('120,60@2');
    expect(probe.getAttribute('data-mode')).toBe('2D');
  });
});
