import { parseViewportOutput, viewportProjectFiles, viewportScript } from './godotViewports.mjs';

const LINE_PREFIX = 'MESH ';
const FILES = { dataFile: 'meshes.json', shaderPrefix: 'mesh' };

/** One MeshInstance3D of an uncompressed ArrayMesh in each viewport. */
export const MESH_MAIN_SCRIPT = viewportScript({
  dataFile: FILES.dataFile,
  linePrefix: LINE_PREFIX,
  functions: `
func vectors(values: Array) -> PackedVector3Array:
	var packed := PackedVector3Array()
	for value in values:
		packed.append(vector(value))
	return packed

func mesh_of(scene: Dictionary) -> ArrayMesh:
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vectors(scene.mesh.positions)
	arrays[Mesh.ARRAY_NORMAL] = vectors(scene.mesh.normals)
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays, [], {}, 0)
	return mesh
`,
  fill: `		var material := ShaderMaterial.new()
		material.shader = load(scene.shader)
		var instance := MeshInstance3D.new()
		instance.mesh = mesh_of(scene)
		instance.material_override = material
		instance.position = vector(scene.object.position)
		instance.rotation = degrees(scene.object.rotation)
		instance.scale = vector(scene.object.scale)
		viewport.add_child(instance)`,
});

/** The files beside the main script, keyed by their names in the project. */
export const meshProjectFiles = (scenes) =>
  viewportProjectFiles(FILES, scenes, (scene) => ({ mesh: scene.mesh, object: scene.object }));

export const parseMeshOutput = (stdout) => parseViewportOutput(stdout, LINE_PREFIX);
