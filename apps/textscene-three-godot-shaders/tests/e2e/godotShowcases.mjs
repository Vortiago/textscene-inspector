/**
 * The scratch Godot project that draws every showcase: one SubViewport per showcase with a
 * ColorRect that fills it, then each viewport's RGBA8 pixels printed as hex. The parse of that
 * output is split from the run, so its test needs no engine.
 */

import { godotShader } from './showcases.mjs';

/** Frames the viewports draw before the read: the first frames compile the pipelines. */
const FRAMES_BEFORE_READ = 4;

const LINE_PREFIX = 'SHOWCASE ';

const PROJECT_GODOT = `config_version=5

[application]
run/main_scene="res://main.tscn"

[display]
window/size/viewport_width=64
window/size/viewport_height=64
`;

const MAIN_SCENE = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://main.gd" id="1"]

[node name="Main" type="Node"]
script = ExtResource("1")
`;

const MAIN_SCRIPT = `extends Node

func _ready() -> void:
	var data: Array = JSON.parse_string(FileAccess.get_file_as_string("res://showcases.json"))
	var viewports: Array = []
	for showcase in data:
		var viewport := SubViewport.new()
		viewport.size = Vector2i(int(showcase.width), int(showcase.height))
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		add_child(viewport)
		var rect := ColorRect.new()
		rect.size = Vector2(showcase.width, showcase.height)
		var material := ShaderMaterial.new()
		material.shader = load(showcase.shader)
		rect.material = material
		viewport.add_child(rect)
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

/** The project's files, keyed by their names in the project. */
export function showcaseProjectFiles(showcases) {
  const data = showcases.map((showcase, index) => ({
    name: showcase.name,
    width: showcase.width,
    height: showcase.height,
    shader: `res://showcase_${index}.gdshader`,
  }));
  return {
    'project.godot': PROJECT_GODOT,
    'main.tscn': MAIN_SCENE,
    'main.gd': MAIN_SCRIPT,
    'showcases.json': JSON.stringify(data),
    ...Object.fromEntries(
      showcases.map((showcase, index) => [`showcase_${index}.gdshader`, godotShader(showcase)])
    ),
  };
}

/** Each showcase's RGBA8 bytes in `stdout`, top row first, keyed by name, with Godot's version. */
export function parseShowcaseOutput(stdout) {
  const lines = stdout.split('\n');
  const version = lines.find((line) => line.startsWith('GODOT '));
  if (!version) throw new Error('expected a "GODOT " line in Godot\'s output, found none');
  const images = new Map();
  for (const line of lines.filter((text) => text.startsWith(LINE_PREFIX))) {
    const [name, hex = ''] = line.slice(LINE_PREFIX.length).trim().split(' ');
    images.set(name, Uint8Array.from(Buffer.from(hex, 'hex')));
  }
  return { godot: version.slice('GODOT '.length).trim(), images };
}
