import { createRoot } from 'react-dom/client';
import {
  TscnCanvas,
  TscnSceneProvider,
  openScene,
  variant,
  type ResourceProvider,
} from '@textscene/renderer';
import { runHeldResourceChecks, type HeldResourceCheckResults } from './heldResourceChecks';
import { runMountChecks, type MountCheckResults } from './mountChecks';

const FIXTURE_SCENE = `[gd_scene format=3]

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="BoxMesh" id="BoxMesh_1"]
material = SubResource("Material_1")

[sub_resource type="Environment" id="Environment_1"]
background_mode = 1
background_color = Color(0.2, 0.3, 0.5, 1)
ambient_light_source = 2
ambient_light_color = Color(1, 1, 1, 1)

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")

[node name="Camera3D" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2.5)
current = true

[node name="Close" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1.6)

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = SubResource("Environment_1")
`;

/** A red rectangle in the middle of the window, which only a view that draws 2D shows. */
const FIXTURE_2D_SCENE = `[gd_scene format=3]

[node name="Menu" type="Control"]
layout_mode = 3
anchors_preset = 0

[node name="Panel" type="ColorRect" parent="."]
offset_left = 40.0
offset_top = 30.0
offset_right = 280.0
offset_bottom = 210.0
color = Color(1, 0, 0, 1)
`;

/** The game window matches the element, so the In-game mode draws no bars around it. */
const PROJECT = `[display]

window/size/viewport_width=320
window/size/viewport_height=240
`;

const projectOnly: ResourceProvider = {
  loadResource: async (path) => (path === 'res://project.godot' ? PROJECT : null),
};

const gameScene = openScene({ source: FIXTURE_SCENE, provider: projectOnly });
const query = new URLSearchParams(location.search);

/** `?write=scale` halves the cube from the host's code before the view mounts, so it draws a quarter. */
const written =
  query.get('write') === 'scale'
    ? gameScene.getNode('Cube').set('scale', variant('Vector3(0.5, 0.5, 0.5)'))
    : Promise.resolve(true);

/** `?call=close` makes the nearer camera current from the host's code, so the cube draws larger. */
const called =
  query.get('call') === 'close' ? gameScene.getNode('Close').call('make_current') : Promise.resolve(null);

const menuScene = openScene({ source: FIXTURE_2D_SCENE, provider: projectOnly });

/** `?mode=in-game` draws the game's start, `?mode=2D` the editor's 2D view. The page holds one view. */
function View() {
  if (query.get('mode') === 'in-game') {
    return <TscnCanvas scene={gameScene} mode="in-game" />;
  }
  if (query.get('mode') === '2D') {
    return <TscnCanvas scene={menuScene} mode="2D" />;
  }
  return (
    <TscnSceneProvider source={FIXTURE_SCENE} provider={projectOnly}>
      <TscnCanvas />
    </TscnSceneProvider>
  );
}

declare global {
  interface Window {
    /** Written once the checks of `mountScene` end, for the runner to read. */
    mountChecks?: MountCheckResults;
    /** Written once the checks of a resource the scene file holds end. */
    heldResourceChecks?: HeldResourceCheckResults;
  }
}

/** `?checks=mount` and `?checks=held` run checks that mount views of their own. */
if (query.get('checks') === 'mount') {
  void runMountChecks().then((results) => (window.mountChecks = results));
} else if (query.get('checks') === 'held') {
  void runHeldResourceChecks().then((results) => (window.heldResourceChecks = results));
} else {
  void Promise.all([written, called]).then(() =>
    createRoot(document.getElementById('root')!).render(
      <div id="viewport" style={{ width: 320, height: 240 }}>
        <View />
      </div>
    )
  );
}
