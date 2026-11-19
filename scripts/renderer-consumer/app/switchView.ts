import { mountScene, openScene, variant, type View } from '@textscene/renderer';
import { projectOf } from './mountChecks';

/** A cube that the In-game and 3D modes draw, and a red bar left of it that the 2D mode draws. */
const SWITCH_SCENE = `[gd_scene format=3]

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="BoxMesh" id="BoxMesh_1"]
material = SubResource("Material_1")

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")

[node name="Camera3D" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2.5)
current = true

[node name="Hud" type="CanvasLayer" parent="."]

[node name="Panel" type="ColorRect" parent="Hud"]
offset_left = 8.0
offset_top = 8.0
offset_right = 88.0
offset_bottom = 232.0
color = Color(1, 0, 0, 1)
`;

/** The game window matches the element, so the In-game mode draws no bars around it. */
export const WINDOW_320_PROJECT = `[display]

window/size/viewport_width=320
window/size/viewport_height=240
`;

export interface SwitchView {
  view: View;
  /** Halves the cube, so a frame drawn after it shows less of the cube. */
  shrinkCube(): Promise<boolean>;
}

declare global {
  interface Window {
    /** The view the runner switches, mounted In-game. */
    switchView?: SwitchView;
  }
}

export function mountSwitchView(element: HTMLElement): SwitchView {
  const scene = openScene({ source: SWITCH_SCENE, provider: projectOf(WINDOW_320_PROJECT) });
  return {
    view: mountScene(element, scene),
    shrinkCube: () => scene.getNode('Cube').set('scale', variant('Vector3(0.5, 0.5, 0.5)')),
  };
}
