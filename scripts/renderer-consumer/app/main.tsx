import { createRoot } from 'react-dom/client';
import { TscnCanvas, TscnSceneProvider, openScene, type ResourceProvider } from '@textscene/renderer';

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

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = SubResource("Environment_1")
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

/** `?mode=in-game` opens the scene and draws it as the game starts it. The page holds one view. */
function View() {
  if (new URLSearchParams(location.search).get('mode') === 'in-game') {
    return <TscnCanvas scene={gameScene} mode="in-game" />;
  }
  return (
    <TscnSceneProvider source={FIXTURE_SCENE} provider={projectOnly}>
      <TscnCanvas />
    </TscnSceneProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <div id="viewport" style={{ width: 320, height: 240 }}>
    <View />
  </div>
);
