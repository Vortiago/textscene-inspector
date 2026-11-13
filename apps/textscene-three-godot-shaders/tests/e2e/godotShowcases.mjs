/**
 * The main script and files that draw every showcase: one SubViewport per showcase with a
 * ColorRect that fills it, then each viewport's RGBA8 pixels printed as hex. The parse of that
 * output is split from the run, so its test needs no engine.
 */

import {
  FRAMES_BEFORE_READ,
  printedField,
  printedImages,
} from '../../../../scripts/godot-probes/godotRun.mjs';
import { godotShader } from './showcases.mjs';

const LINE_PREFIX = 'SHOWCASE ';

export const MAIN_SCRIPT = `extends Node

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

/** The files beside the main script, keyed by their names in the project. */
export function showcaseProjectFiles(showcases) {
  const data = showcases.map((showcase, index) => ({
    name: showcase.name,
    width: showcase.width,
    height: showcase.height,
    shader: `res://showcase_${index}.gdshader`,
  }));
  return {
    'showcases.json': JSON.stringify(data),
    ...Object.fromEntries(
      showcases.map((showcase, index) => [`showcase_${index}.gdshader`, godotShader(showcase)])
    ),
  };
}

/** Each showcase's RGBA8 bytes in `stdout`, top row first, keyed by name, with Godot's version. */
export function parseShowcaseOutput(stdout) {
  return { godot: printedField(stdout, 'GODOT '), images: printedImages(stdout, LINE_PREFIX) };
}
