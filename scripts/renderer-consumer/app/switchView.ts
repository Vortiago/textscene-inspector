import { mountScene, openScene, variant, type Scene, type View, type ViewOptions } from '@textscene/renderer';
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

/** The writes a fresh view of the scene gets, to match the switched view at the same point. */
export interface SceneWrites {
  isCubeShrunk: boolean;
  isBarGreen: boolean;
}

const shrinkCube = (scene: Scene) => scene.getNode('Cube').set('scale', variant('Vector3(0.5, 0.5, 0.5)'));
const recolourBar = (scene: Scene) => scene.getNode('Hud/Panel').set('color', variant('Color(0, 1, 0, 1)'));

const openSwitchScene = () => openScene({ source: SWITCH_SCENE, provider: projectOf(WINDOW_320_PROJECT) });

export interface SwitchView {
  view: View;
  /** Halves the cube, so a frame drawn after it shows less of the cube. */
  shrinkCube(): Promise<boolean>;
  /** Turns the bar green, which the 2D and In-game modes draw. */
  recolourBar(): Promise<boolean>;
}

declare global {
  interface Window {
    /** The view the runner switches, mounted In-game. */
    switchView?: SwitchView;
    /** Disposes the view in the element, and mounts a new view of a new scene in `mode`. */
    mountFresh?: (mode: ViewOptions['mode'], writes: SceneWrites) => Promise<void>;
    /** The view `mountFresh` mounted last. */
    freshView?: View;
  }
}

function mountSwitchView(element: HTMLElement): SwitchView {
  const scene = openSwitchScene();
  return {
    view: mountScene(element, scene),
    shrinkCube: () => shrinkCube(scene),
    recolourBar: () => recolourBar(scene),
  };
}

async function mountFreshView(element: HTMLElement, mode: ViewOptions['mode'], writes: SceneWrites) {
  const scene = openSwitchScene();
  if (writes.isCubeShrunk) await shrinkCube(scene);
  if (writes.isBarGreen) await recolourBar(scene);
  return mountScene(element, scene, { mode });
}

/** Mounts the switched view in `element`, and gives the runner `mountFresh` for the views it compares. */
export function exposeSwitchChecks(element: HTMLElement): void {
  window.switchView = mountSwitchView(element);
  window.mountFresh = async (mode, writes) => {
    window.switchView?.view.dispose();
    window.switchView = undefined;
    window.freshView?.dispose();
    window.freshView = await mountFreshView(element, mode, writes);
  };
}
