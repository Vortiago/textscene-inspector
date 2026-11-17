import {
  FRAMES_BEFORE_READ,
  printedField,
  printedImages,
} from '../../../../scripts/godot-probes/godotRun.mjs';

const LINE_PREFIX = 'MESH ';

/** One SubViewport per scene: its camera, and one MeshInstance3D of an uncompressed ArrayMesh. */
export const MESH_MAIN_SCRIPT = `extends Node

func degrees(values: Array) -> Vector3:
	return Vector3(deg_to_rad(values[0]), deg_to_rad(values[1]), deg_to_rad(values[2]))

func vector(values: Array) -> Vector3:
	return Vector3(values[0], values[1], values[2])

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

func _ready() -> void:
	var data: Array = JSON.parse_string(FileAccess.get_file_as_string("res://meshes.json"))
	var viewports: Array = []
	for scene in data:
		var viewport := SubViewport.new()
		viewport.size = Vector2i(int(scene.width), int(scene.height))
		viewport.own_world_3d = true
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		add_child(viewport)
		var camera := Camera3D.new()
		camera.fov = scene.camera.fov
		camera.rotation = degrees(scene.camera.rotation)
		camera.position = vector(scene.camera.position)
		viewport.add_child(camera)
		var material := ShaderMaterial.new()
		material.shader = load(scene.shader)
		var instance := MeshInstance3D.new()
		instance.mesh = mesh_of(scene)
		instance.material_override = material
		instance.position = vector(scene.object.position)
		instance.rotation = degrees(scene.object.rotation)
		instance.scale = vector(scene.object.scale)
		viewport.add_child(instance)
		viewports.append(viewport)
	for frame in ${FRAMES_BEFORE_READ}:
		await RenderingServer.frame_post_draw
	print("GODOT ", Engine.get_version_info().string)
	for index in data.size():
		var image: Image = viewports[index].get_texture().get_image()
		image.convert(Image.FORMAT_RGBA8)
		print("${LINE_PREFIX}", data[index].name, " ", image.get_data().hex_encode())
	get_tree().quit()
`;

/** The files beside the main script, keyed by their names in the project. */
export function meshProjectFiles(scenes) {
  const data = scenes.map((scene, index) => ({
    name: scene.name,
    width: scene.width,
    height: scene.height,
    camera: scene.camera,
    mesh: scene.mesh,
    object: scene.object,
    shader: `res://mesh_${index}.gdshader`,
  }));
  return {
    'meshes.json': JSON.stringify(data),
    ...Object.fromEntries(scenes.map((scene, index) => [`mesh_${index}.gdshader`, scene.source])),
  };
}

/** Each scene's RGBA8 bytes in `stdout`, top row first, keyed by name, with Godot's version. */
export function parseMeshOutput(stdout) {
  return { godot: printedField(stdout, 'GODOT '), images: printedImages(stdout, LINE_PREFIX) };
}
