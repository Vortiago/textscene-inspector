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

func vector2s(values: Array) -> PackedVector2Array:
	var packed := PackedVector2Array()
	for value in values:
		packed.append(Vector2(value[0], value[1]))
	return packed

func floats(values: Array) -> PackedFloat32Array:
	var packed := PackedFloat32Array()
	for value in values:
		packed.append_array(PackedFloat32Array(value))
	return packed

func colors(values: Array) -> PackedColorArray:
	var packed := PackedColorArray()
	for value in values:
		packed.append(Color(value[0], value[1], value[2], value[3]))
	return packed

func mesh_of(scene: Dictionary) -> ArrayMesh:
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vectors(scene.mesh.positions)
	arrays[Mesh.ARRAY_NORMAL] = vectors(scene.mesh.normals)
	if scene.mesh.has("tangents"):
		arrays[Mesh.ARRAY_TANGENT] = floats(scene.mesh.tangents)
	if scene.mesh.has("uvs"):
		arrays[Mesh.ARRAY_TEX_UV] = vector2s(scene.mesh.uvs)
	if scene.mesh.has("uv2s"):
		arrays[Mesh.ARRAY_TEX_UV2] = vector2s(scene.mesh.uv2s)
	if scene.mesh.has("colors"):
		arrays[Mesh.ARRAY_COLOR] = colors(scene.mesh.colors)
	var flags := Mesh.ARRAY_FLAG_COMPRESS_ATTRIBUTES if scene.get("compressed", false) else 0
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays, [], {}, flags)
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
		var holder: Node = viewport
		if scene.has("parent"):
			var parent := Node3D.new()
			parent.position = vector(scene.parent.position)
			parent.rotation = degrees(scene.parent.rotation)
			parent.scale = vector(scene.parent.scale)
			viewport.add_child(parent)
			holder = parent
		holder.add_child(instance)
		for other in scene.get("others", []):
			var drawn := MeshInstance3D.new()
			drawn.mesh = instance.mesh
			drawn.material_override = material
			if other.has("shader"):
				drawn.material_override = ShaderMaterial.new()
				drawn.material_override.shader = load(other.shader)
			drawn.position = vector(other.object.position)
			drawn.rotation = degrees(other.object.rotation)
			drawn.scale = vector(other.object.scale)
			holder.add_child(drawn)`,
});

/** The shader file of the other object `other` of scene `index`, which has a source of its own. */
const otherShader = (index, other) => `mesh_${index}_${other}.gdshader`;

/** The files beside the main script, keyed by their names in the project. */
export function meshProjectFiles(scenes) {
  const files = viewportProjectFiles(FILES, scenes, (scene, index) => ({
    mesh: scene.mesh,
    object: scene.object,
    ...(scene.parent ? { parent: scene.parent } : {}),
    ...(scene.compressed ? { compressed: true } : {}),
    ...(scene.others
      ? {
          others: scene.others.map(({ object, source }, other) => ({
            object,
            ...(source ? { shader: `res://${otherShader(index, other)}` } : {}),
          })),
        }
      : {}),
  }));
  const ownShaders = scenes.flatMap((scene, index) =>
    (scene.others ?? []).flatMap(({ source }, other) => (source ? [[otherShader(index, other), source]] : []))
  );
  return { ...files, ...Object.fromEntries(ownShaders) };
}

export const parseMeshOutput = (stdout) => parseViewportOutput(stdout, LINE_PREFIX);
