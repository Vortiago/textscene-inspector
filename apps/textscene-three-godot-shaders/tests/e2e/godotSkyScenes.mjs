/**
 * The main script and files that draw every sky scene: one 3D SubViewport per scene with its
 * camera, a WorldEnvironment whose sky holds the scene's shader, its fog and its directional
 * lights, then each viewport's RGBA8 pixels printed as hex.
 */

import {
  FRAMES_BEFORE_READ,
  printedField,
  printedImages,
} from '../../../../scripts/godot-probes/godotRun.mjs';

const LINE_PREFIX = 'SKY ';

export const SKY_MAIN_SCRIPT = `extends Node

func degrees(values: Array) -> Vector3:
	return Vector3(deg_to_rad(values[0]), deg_to_rad(values[1]), deg_to_rad(values[2]))

func color(values: Array) -> Color:
	return Color(values[0], values[1], values[2])

func environment(scene: Dictionary) -> Environment:
	var material := ShaderMaterial.new()
	material.shader = load(scene.shader)
	var sky := Sky.new()
	sky.sky_material = material
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	if scene.has("fog"):
		env.fog_enabled = true
		env.fog_light_color = color(scene.fog.color)
		env.fog_light_energy = scene.fog.energy
		env.fog_sun_scatter = scene.fog.sunScatter
		env.fog_sky_affect = scene.fog.skyAffect
		env.fog_aerial_perspective = scene.fog.aerialPerspective
	return env

func _ready() -> void:
	var data: Array = JSON.parse_string(FileAccess.get_file_as_string("res://skies.json"))
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
		viewport.add_child(camera)
		var world := WorldEnvironment.new()
		world.environment = environment(scene)
		viewport.add_child(world)
		for light in scene.lights:
			var sun := DirectionalLight3D.new()
			sun.rotation = degrees(light.rotation)
			sun.light_color = color(light.color)
			sun.light_energy = light.energy
			sun.light_angular_distance = light.size
			viewport.add_child(sun)
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
export function skyProjectFiles(scenes) {
  const data = scenes.map((scene, index) => ({
    name: scene.name,
    width: scene.width,
    height: scene.height,
    camera: scene.camera,
    lights: scene.lights,
    ...(scene.fog ? { fog: scene.fog } : {}),
    shader: `res://sky_${index}.gdshader`,
  }));
  return {
    'skies.json': JSON.stringify(data),
    ...Object.fromEntries(scenes.map((scene, index) => [`sky_${index}.gdshader`, scene.source])),
  };
}

/** Each scene's RGBA8 bytes in `stdout`, top row first, keyed by name, with Godot's version. */
export function parseSkyOutput(stdout) {
  return { godot: printedField(stdout, 'GODOT '), images: printedImages(stdout, LINE_PREFIX) };
}
