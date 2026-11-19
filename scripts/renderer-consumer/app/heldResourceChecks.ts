import { mountScene, openScene, variant, type ResourceProvider } from '@textscene/renderer';

const ROOT_SCENE_PATH = 'res://main.tscn';

/** A cube, with a sphere the file also holds, and a ball that draws the sphere off to the left. */
function sceneWithCube(cubeMesh: string | null): string {
  return `[gd_scene format=3]

[sub_resource type="StandardMaterial3D" id="Material_1"]
albedo_color = Color(0.2, 0.6, 1, 1)

[sub_resource type="BoxMesh" id="BoxMesh_1"]
material = SubResource("Material_1")

[sub_resource type="SphereMesh" id="SphereMesh_1"]
material = SubResource("Material_1")

[node name="Root" type="Node3D"]

[node name="Camera3D" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 3)
current = true

[node name="Sun" type="DirectionalLight3D" parent="."]
transform = Transform3D(0.866025, -0.25, 0.433013, 0, 0.866025, 0.5, -0.5, -0.433013, 0.75, 0, 2, 0)

[node name="Ball" type="MeshInstance3D" parent="."]
transform = Transform3D(0.5, 0, 0, 0, 0.5, 0, 0, 0, 0.5, -1.5, 0, 0)
mesh = SubResource("SphereMesh_1")

[node name="Cube" type="MeshInstance3D" parent="."]
${cubeMesh === null ? '' : `mesh = ${cubeMesh}`}
`;
}

const NO_FILES: ResourceProvider = { loadResource: async () => null };

const open = (source: string) => openScene({ source, provider: NO_FILES, rootScenePath: ROOT_SCENE_PATH });

async function base64Of(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function capture(scene: ReturnType<typeof openScene>): Promise<string> {
  const element = document.createElement('div');
  element.style.width = '320px';
  element.style.height = '240px';
  document.body.append(element);
  const view = mountScene(element, scene);
  await view.settled;
  const png = await view.captureImage();
  view.dispose();
  return base64Of(png);
}

/** The cube after the host writes `text` to its mesh, which starts as the box. */
async function captureCubeWrite(text: string): Promise<string> {
  const scene = open(sceneWithCube('SubResource("BoxMesh_1")'));
  await scene.getNode('Cube').set('mesh', variant(text));
  return capture(scene);
}

export interface HeldResourceCheckResults {
  /** A write of the sphere by its path, as Godot's `load` names a resource the scene file holds. */
  writtenSpherePng: string;
  authoredSpherePng: string;
  /** A write of the material to the mesh, which the `Ref<Mesh>` check turns into null. */
  writtenMaterialPng: string;
  authoredNoMeshPng: string;
}

/** One view at a time, as the mount checks draw them. */
export async function runHeldResourceChecks(): Promise<HeldResourceCheckResults> {
  const writtenSpherePng = await captureCubeWrite(`Resource("${ROOT_SCENE_PATH}::SphereMesh_1")`);
  const authoredSpherePng = await capture(open(sceneWithCube('SubResource("SphereMesh_1")')));
  const writtenMaterialPng = await captureCubeWrite(`Resource("${ROOT_SCENE_PATH}::Material_1")`);
  const authoredNoMeshPng = await capture(open(sceneWithCube(null)));
  return { writtenSpherePng, authoredSpherePng, writtenMaterialPng, authoredNoMeshPng };
}
