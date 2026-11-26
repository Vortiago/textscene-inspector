import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { sizeEveryElement } from '../../testing/sizeEveryElement';

// The world canvas needs WebGL. The stub keeps the keys, which hand the stage where each node stands.
vi.mock('../../world2D/World2DCanvas', async () => {
  const { FocusSelection2D } = await import('./FocusSelection2D');
  const { useSyncExternalStore } = await import('react');
  type Source = import('../../../utils/externalStore').ExternalStore<
    import('../../world2D/stageView').StageView
  >;
  return {
    World2DCanvas: function World({ view }: { view: Source }) {
      const { pan, zoom } = useSyncExternalStore(view.subscribe, view.get);
      return (
        <div data-testid="world" data-pan={`${pan.x},${pan.y}`} data-zoom={zoom}>
          <FocusSelection2D />
        </div>
      );
    },
  };
});

import { Canvas2DStage } from './Canvas2DStage';
import { TscnSceneProvider } from '../../TscnSceneProvider';
import { openScene } from '../../../scene/openScene';
import { EditorCamerasScope, useEditorCameras } from '../editorCamera/EditorCamerasContext';
import type { NodeHandle } from '../../../scene/nodeHandle';

// No camera here is current, so Godot's own frame of each is measured with that camera made current.
const CAMERAS = `[gd_scene format=3]

[node name="World" type="Node2D"]

[node name="Zoomed" type="Camera2D" parent="."]
position = Vector2(500, 100)
zoom = Vector2(2, 2)
offset = Vector2(10, 0)
limit_right = 600

[node name="Corner" type="Camera2D" parent="."]
position = Vector2(100, 50)
anchor_mode = 0

[node name="Narrow" type="Camera2D" parent="."]
position = Vector2(40, 30)
zoom = Vector2(0.5, 0.5)
limit_left = 0
limit_top = 0
limit_right = 1000
limit_bottom = 800
`;

const STAGE = { width: 800, height: 600 };

let editorCamera: NodeHandle | null = null;

function CameraProbe() {
  editorCamera = useEditorCameras()?.of('2D') ?? null;
  return null;
}

async function mountStage(source = CAMERAS, files: Record<string, string> = {}): Promise<NodeHandle> {
  sizeEveryElement(STAGE.width, STAGE.height);
  const provider = { loadResource: async (path: string) => files[path] ?? null };
  const scene = openScene({ source, provider, rootScenePath: 'res://main.tscn' });
  render(
    <EditorCamerasScope>
      <CameraProbe />
      <TscnSceneProvider scene={scene}>
        <Canvas2DStage nodes={[]} internalResources={[]} externalResources={[]} scenePath="res://main.tscn" />
      </TscnSceneProvider>
    </EditorCamerasScope>
  );
  await screen.findByTestId('canvas-2d-stage');
  return editorCamera!;
}

/** The canvas point at the stage's centre, and the zoom, as the stage draws them now. */
function framed(): { centre: { x: number; y: number }; zoom: number } {
  const world = screen.getByTestId('world');
  const zoom = Number(world.dataset.zoom);
  const [panX, panY] = world.dataset.pan!.split(',').map(Number);
  return { centre: { x: (STAGE.width / 2 - panX!) / zoom, y: (STAGE.height / 2 - panY!) / zoom }, zoom };
}

// Each centre is Godot 4.6.3's `get_screen_center_position` of that camera on a 1152 by 648 screen.
describe('frame_camera_view of the 2D editor camera', () => {
  it('frames a zoomed camera that a limit holds, with its offset laid on', async () => {
    const camera = await mountStage();
    await waitFor(() => camera.call('frame_camera_view', '/root/World/Zoomed'));
    await waitFor(() => expect(framed()).toEqual({ centre: { x: 322, y: 100 }, zoom: 2 }));
  });

  it('frames a camera anchored at its top-left corner', async () => {
    const camera = await mountStage();
    await waitFor(() => camera.call('frame_camera_view', '/root/World/Corner'));
    await waitFor(() => expect(framed()).toEqual({ centre: { x: 676, y: 374 }, zoom: 1 }));
  });

  it('centres a view wider than its limits in the span between them', async () => {
    const camera = await mountStage();
    await waitFor(() => camera.call('frame_camera_view', '/root/World/Narrow'));
    await waitFor(() => expect(framed()).toEqual({ centre: { x: 500, y: 400 }, zoom: 0.5 }));
  });

  it('refuses a camera whose zoom is not above 0, and keeps the view', async () => {
    const camera = await mountStage(`[gd_scene format=3]

[node name="World" type="Node2D"]

[node name="Broken" type="Camera2D" parent="."]
zoom = Vector2(-1, -1)
`);
    const before = framed();
    await expect(camera.call('frame_camera_view', '/root/World/Broken')).rejects.toThrow(
      'expected a Camera2D zoom above 0 to frame, got -1'
    );
    expect(framed()).toEqual(before);
  });

  it('refuses a path that names no Camera2D', async () => {
    const camera = await mountStage();
    await expect(camera.call('frame_camera_view', '/root/World')).rejects.toThrow(
      'expected the absolute path of a Camera2D to frame, got /root/World'
    );
  });
});

const PLACED = [
  {
    case: 'a camera a RemoteTransform2D moved, at the relay',
    path: '/root/World/Cam',
    centre: { x: 500, y: 200 },
    source: `[gd_scene format=3]

[node name="World" type="Node2D"]

[node name="Cam" type="Camera2D" parent="."]
position = Vector2(20, 10)

[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(500, 200)
remote_path = NodePath("../Cam")
`,
  },
  {
    // The LookAt turns the arm a quarter turn at the target below it (`skeleton_2d.cpp:786-796`).
    case: 'a camera below a bone a modification stack turned, at the end of the turned bone',
    path: '/root/World/Skeleton/Arm/Cam',
    centre: { x: 300, y: 350 },
    source: `[gd_scene format=3]

[sub_resource type="SkeletonModification2DLookAt" id="lookat"]
bone_index = 0
bone2d_node = NodePath("Arm")
target_nodepath = NodePath("../Target")

[sub_resource type="SkeletonModificationStack2D" id="stack"]
enabled = true
modification_count = 1
modifications/0 = SubResource("lookat")

[node name="World" type="Node2D"]

[node name="Skeleton" type="Skeleton2D" parent="."]
position = Vector2(300, 150)
modification_stack = SubResource("stack")

[node name="Arm" type="Bone2D" parent="Skeleton"]
rest = Transform2D(1, 0, 0, 1, 0, 0)
auto_calculate_length_and_angle = false
length = 200.0

[node name="Cam" type="Camera2D" parent="Skeleton/Arm"]
position = Vector2(200, 0)

[node name="Target" type="Node2D" parent="."]
position = Vector2(300, 400)
`,
  },
  {
    case: 'a camera under a Node2D a RemoteTransform2D moved, with its parent',
    path: '/root/World/Player/Cam',
    centre: { x: 320, y: 10 },
    source: `[gd_scene format=3]

[node name="World" type="Node2D"]

[node name="Player" type="Node2D" parent="."]
position = Vector2(100, 50)

[node name="Cam" type="Camera2D" parent="Player"]
position = Vector2(20, 10)

[node name="Relay" type="RemoteTransform2D" parent="."]
position = Vector2(300, 0)
remote_path = NodePath("../Player")
`,
  },
  {
    case: 'a top_level camera under a translated Node2D, at its own position',
    path: '/root/World/Cam',
    centre: { x: 20, y: 10 },
    source: `[gd_scene format=3]

[node name="World" type="Node2D"]
position = Vector2(100, 50)

[node name="Cam" type="Camera2D" parent="."]
top_level = true
position = Vector2(20, 10)
`,
  },
  {
    case: 'a camera under a Node under a translated Node2D, at its own position',
    path: '/root/World/Group/Cam',
    centre: { x: 20, y: 10 },
    source: `[gd_scene format=3]

[node name="World" type="Node2D"]
position = Vector2(100, 50)

[node name="Group" type="Node" parent="."]

[node name="Cam" type="Camera2D" parent="Group"]
position = Vector2(20, 10)
`,
  },
];

describe('frame_camera_view of a camera the tree places', () => {
  it.each(PLACED)('frames $case', async ({ source, path, centre }) => {
    const camera = await mountStage(source);
    await waitFor(() => camera.call('frame_camera_view', path));
    await waitFor(() => expect(framed()).toEqual({ centre, zoom: 1 }));
  });

  it('frames a camera of an instanced sub-scene at its world position, not the origin', async () => {
    const camera = await mountStage(
      `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="p"]

[node name="Game" type="Node2D"]

[node name="Player" parent="." instance=ExtResource("p")]
position = Vector2(100, 50)
`,
      {
        'res://player.tscn': `[gd_scene format=3]

[node name="PlayerRoot" type="Node2D"]

[node name="Cam" type="Camera2D" parent="."]
position = Vector2(20, 10)
zoom = Vector2(2, 2)
`,
      }
    );
    await waitFor(() => camera.call('frame_camera_view', '/root/Game/Player/Cam'));
    await waitFor(() => expect(framed()).toEqual({ centre: { x: 120, y: 60 }, zoom: 2 }));
  });
});
