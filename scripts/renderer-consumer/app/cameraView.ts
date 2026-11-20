import { mountScene, openScene, type View, type ViewOptions } from '@textscene/renderer';
import { projectOf } from './mountChecks';
import { WINDOW_320_PROJECT } from './switchView';
import { exposeCameraSettleChecks } from './cameraSettleView';

/** Two cameras that are not current. The scene's own light and environment keep the preview sun out. */
const CAMERA_SCENE = `[gd_scene format=3]

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="BoxMesh" id="BoxMesh_1"]
material = SubResource("Material_1")

[sub_resource type="Environment" id="Environment_1"]
background_mode = 1
background_color = Color(0.2, 0.3, 0.5, 1)
ambient_light_source = 2
ambient_light_color = Color(0.3, 0.3, 0.3, 1)

[node name="Root" type="Node3D"]

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = SubResource("Environment_1")

[node name="Sun" type="DirectionalLight3D" parent="."]
transform = Transform3D(0.866025, -0.25, 0.433013, 0, 0.866025, 0.5, -0.5, -0.433013, 0.75, 0, 2, 0)

[node name="Cube" type="MeshInstance3D" parent="."]
transform = Transform3D(0.707107, 0, 0.707107, 0, 1, 0, -0.707107, 0, 0.707107, 0, 0, 0)
mesh = SubResource("BoxMesh_1")

[node name="Rig" type="Node3D" parent="."]

[node name="Front" type="Camera3D" parent="Rig"]
transform = Transform3D(1, 0, 0, 0, 0.939693, 0.34202, 0, -0.34202, 0.939693, 0, 1.2, 3)
fov = 50.0

[node name="Above" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 0, 1, 0, -1, 0, 0, 4, 0)
projection = 1
size = 3.0
`;

const openCameraScene = () => openScene({ source: CAMERA_SCENE, provider: projectOf(WINDOW_320_PROJECT) });

declare global {
  interface Window {
    /** The view the runner moves between cameras, mounted in the 3D mode through `Rig/Front`. */
    cameraView?: View;
    /** Disposes the view in the element, and mounts a new view of a new scene with `options`. */
    mountCamera?: (options: ViewOptions) => void;
    /** Disposes the view in the element, and mounts the game's view of a new scene through `camera`. */
    mountGame?: (camera: string) => Promise<void>;
  }
}

/** Mounts the moved view in `element`, and gives the runner the views it compares. */
export function exposeCameraChecks(element: HTMLElement): void {
  window.cameraView = mountScene(element, openCameraScene(), { mode: '3D', camera: 'Rig/Front' });
  const remount = (options: ViewOptions, scene = openCameraScene()) => {
    window.cameraView?.dispose();
    window.cameraView = mountScene(element, scene, options);
  };
  window.mountCamera = (options) => remount(options);
  window.mountGame = async (camera) => {
    const scene = openCameraScene();
    await scene.getNode(camera).call('make_current');
    remount({ mode: 'in-game' }, scene);
    await window.cameraView?.settled;
  };
  exposeCameraSettleChecks(element, openCameraScene);
}
