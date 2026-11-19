import { mountScene, openScene, type NodeHandle, type Scene, type View } from '@textscene/renderer';
import { projectOf } from './mountChecks';
import { WINDOW_320_PROJECT } from './switchView';

// No Camera3D: its gizmo lies over the cube in the editor's view, and a click picks the gizmo.
const PICK_SCENE = `[gd_scene format=3]

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="BoxMesh" id="BoxMesh_1"]
material = SubResource("Material_1")

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")

[node name="Hud" type="CanvasLayer" parent="."]

[node name="Panel" type="ColorRect" parent="Hud"]
offset_left = 0.0
offset_top = 0.0
offset_right = 320.0
offset_bottom = 240.0
color = Color(1, 0, 0, 1)
`;

export interface PickView {
  view: View;
  scene: Scene;
  /** The path of each node `onSelect` heard, in order: null for a click on nothing. */
  picks: (string | null)[];
}

declare global {
  interface Window {
    /** The view the runner clicks, mounted in the 3D mode with `onSelect`. */
    pickView?: PickView;
  }
}

/** Mounts the 3D view the runner clicks. The page logs the path of each pick, as a host would. */
export function exposePickView(element: HTMLElement): void {
  const scene = openScene({ source: PICK_SCENE, provider: projectOf(WINDOW_320_PROJECT) });
  const picks: (string | null)[] = [];
  const onSelect = (node: NodeHandle | null) => {
    picks.push(node?.path ?? null);
    console.log(`[pick] ${node?.path ?? 'nothing'}`);
  };
  window.pickView = { view: mountScene(element, scene, { mode: '3D', onSelect }), scene, picks };
}
