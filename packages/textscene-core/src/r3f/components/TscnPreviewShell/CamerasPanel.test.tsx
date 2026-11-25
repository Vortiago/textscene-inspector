import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { CamerasPanel } from './CamerasPanel';
import { TestPreviewCamera } from './previewCamera.testkit';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { createEditorCameras } from '../../editorView/editorCamera/editorCameras';
import { PreviewViewProvider } from './previewView';
import type { SceneValue } from '../../../scene/variant';
import { ViewportModeProvider, useViewportMode } from '../ViewportMode/ViewportModeContext';
import { openScene } from '../../../scene/openScene';
import '../../sceneLiveTree.js';

const SCENE = `[gd_scene format=3]

[node name="World" type="Node2D"]

[node name="Player" type="Node2D" parent="."]
position = Vector2(100, 50)

[node name="Cam" type="Camera2D" parent="Player"]
position = Vector2(20, 10)
zoom = Vector2(2, 2)

[node name="Eye" type="Camera3D" parent="."]
`;

/** The calls the panel made on the 2D mode's editor camera, each as `method(arguments)`. */
let called2D: string[] = [];

/** A view whose editor camera follows the mode, as a `TscnCanvas` ref does, and records 2D calls. */
function FakeView({ children }: { children: ReactNode }) {
  const { mode } = useViewportMode();
  const currentMode = useRef(mode);
  useLayoutEffect(() => {
    currentMode.current = mode;
  }, [mode]);
  const view = useRef<{ editorCamera: ReturnType<ReturnType<typeof createEditorCameras>['of']> } | null>(
    null
  );
  if (!view.current) {
    const cameras = createEditorCameras();
    called2D = [];
    cameras.slot('Camera2D').bind({
      get: () => null,
      set: () => false,
      call: (method: string, args: readonly SceneValue[]) => {
        called2D.push(`${method}(${args.join(', ')})`);
        return null;
      },
      pose: () => null,
      setPose: () => {},
      scene: () => '',
    });
    view.current = {
      get editorCamera() {
        return cameras.of(currentMode.current);
      },
    };
  }
  return <PreviewViewProvider value={view.current as never}>{children}</PreviewViewProvider>;
}

function Probe() {
  const { mode } = useViewportMode();
  return <div data-testid="probe" data-mode={mode} />;
}

function renderPanel(source = SCENE, files: Record<string, string> = {}, previewedCameraPath?: string) {
  const provider = { loadResource: async (path: string) => files[path] ?? null };
  const scene = openScene({ source, provider, rootScenePath: 'res://main.tscn' });
  render(
    <HierarchyProvider value={{ sceneGraph: scene.written(), panelId: 'cams-test', scene }}>
      <TestPreviewCamera initialCamera={previewedCameraPath}>
        <ViewportModeProvider>
          <FakeView>
            <Probe />
            <CamerasPanel />
          </FakeView>
        </ViewportModeProvider>
      </TestPreviewCamera>
    </HierarchyProvider>
  );
  return scene;
}

const findRow = (name: RegExp) => screen.findByRole('button', { name });

describe('<CamerasPanel> with 2D cameras', () => {
  it('lists Camera2D nodes alongside Camera3D nodes', async () => {
    renderPanel();
    expect(await findRow(/Cam/)).toBeTruthy();
    expect(await findRow(/Eye/)).toBeTruthy();
  });

  it('frames the 2D editor camera on a clicked Camera2D', async () => {
    renderPanel();
    fireEvent.click(await findRow(/Cam/));
    await waitFor(() => expect(called2D).toEqual(['frame_camera_view(/root/World/Player/Cam)']));
  });

  it('opens the 2D workspace for a clicked Camera2D', async () => {
    renderPanel();
    fireEvent.click(await findRow(/Cam/));
    expect(screen.getByTestId('probe').getAttribute('data-mode')).toBe('2D');
  });
});

describe('<CamerasPanel> editor camera row', () => {
  // A `?camera=` path that names no camera previews nothing, so the editor camera draws.
  it('marks the editor camera active while the previewed path names no camera', () => {
    renderPanel(SCENE, {}, 'World/Missing');
    expect(screen.getByRole('button', { name: /Editor camera/ }).getAttribute('data-active')).toBe('true');
  });
});

describe('<CamerasPanel> with a SubViewport', () => {
  // A Camera2D in a SubViewport is that viewport's camera (`camera_2d.cpp:342`), so
  // its view is not a place on the root stage.
  it('offers no stage framing for a Camera2D inside a SubViewport', async () => {
    renderPanel(`[gd_scene format=3]

[node name="World" type="Node2D"]

[node name="Booth" type="SubViewport" parent="."]

[node name="Inner" type="Camera2D" parent="Booth"]
position = Vector2(500, 400)

[node name="Outer" type="Camera2D" parent="."]
`);
    expect(await findRow(/Outer/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Inner/ })).toBeNull();
  });
});

describe('<CamerasPanel> with a camera inside an instanced sub-scene', () => {
  it('lists the camera once the sub-scene loads', async () => {
    const scene = renderPanel(
      `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://player.tscn" id="p"]

[node name="Game" type="Node3D"]

[node name="Player" parent="." instance=ExtResource("p")]
`,
      {
        'res://player.tscn': `[gd_scene format=3]

[node name="Player" type="CharacterBody3D"]

[node name="Target" type="Node3D" parent="."]

[node name="FollowCam" type="Camera3D" parent="Target"]
`,
      }
    );
    // A walk into the instance loads it, as the mounted view's walk does.
    scene.getNodeOrNull('Player');
    expect(await findRow(/FollowCam/)).toBeTruthy();
  });
});

describe('<CamerasPanel> with a Camera3D subclass', () => {
  // The panel follows Godot's class tree: an XRCamera3D is a Camera3D, so it belongs in the 3D list.
  it('lists an XRCamera3D as a 3D camera row and activates it on click', async () => {
    renderPanel(`[gd_scene format=3]

[node name="World" type="Node3D"]

[node name="Origin" type="XROrigin3D" parent="."]

[node name="Headset" type="XRCamera3D" parent="Origin"]
`);
    fireEvent.click(await findRow(/Headset/));

    // `data-active` marks only a 3D row. A 2D row switches the workspace instead.
    expect(screen.getByRole('button', { name: /Headset/ }).getAttribute('data-active')).toBe('true');
    expect(screen.getByTestId('probe').getAttribute('data-mode')).not.toBe('2D');
  });
});
