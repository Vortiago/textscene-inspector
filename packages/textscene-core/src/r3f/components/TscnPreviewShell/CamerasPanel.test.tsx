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
