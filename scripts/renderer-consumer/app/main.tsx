import { createRoot } from 'react-dom/client';
import { TscnCanvas, TscnSceneProvider, type ResourceProvider } from '@textscene/renderer';

const FIXTURE_SCENE = `[gd_scene format=3]

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_color = Color(1, 0, 0, 1)

[sub_resource type="BoxMesh" id="BoxMesh_1"]
material = SubResource("Material_1")

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
`;

const noResources: ResourceProvider = { loadResource: async () => null };

createRoot(document.getElementById('root')!).render(
  <TscnSceneProvider source={FIXTURE_SCENE} provider={noResources}>
    <div id="viewport" style={{ width: 320, height: 240 }}>
      <TscnCanvas />
    </div>
  </TscnSceneProvider>
);
