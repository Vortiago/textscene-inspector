/**
 * The scratch Godot project that runs every probe at once: one SubViewport per probe, drawn for a
 * few frames, then each viewport's pixels printed as hex. The parse of that output is split from
 * the run, so its test needs no engine.
 */

import { parameterBits, probeShader, probeWidth } from './probeShader.mjs';

/** Frames the viewports draw before the read: the first frames compile the pipelines. */
const FRAMES_BEFORE_READ = 4;

/** The prefix of each output line that carries a probe's pixels. */
const LINE_PREFIX = 'PROBE ';

export const PROJECT_GODOT = `config_version=5

[application]
run/main_scene="res://main.tscn"

[display]
window/size/viewport_width=64
window/size/viewport_height=64
`;

export const MAIN_SCENE = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://main.gd" id="1"]

[node name="Main" type="Node"]
script = ExtResource("1")
`;

/** The data file the script reads: each probe's name, width, shader file and parameter bits. */
export function probeData(probes) {
  return probes.map((probe, index) => ({
    name: probe.name,
    width: probeWidth(probe),
    shader: `res://probe_${index}.gdshader`,
    // GDScript's PackedInt32Array holds the bits as signed integers.
    parameters: parameterBits(probe).map((bits) => bits.map((value) => value | 0)),
  }));
}

/** The shader files, keyed by their file name in the project. */
export function probeShaderFiles(probes) {
  return Object.fromEntries(probes.map((probe, index) => [`probe_${index}.gdshader`, probeShader(probe)]));
}

export const MAIN_SCRIPT = `extends Node

func _ready() -> void:
	var data: Array = JSON.parse_string(FileAccess.get_file_as_string("res://probes.json"))
	var viewports: Array = []
	for probe in data:
		var viewport := SubViewport.new()
		viewport.size = Vector2i(int(probe.width), 1)
		viewport.transparent_bg = true
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		add_child(viewport)
		var rect := ColorRect.new()
		rect.size = Vector2(probe.width, 1)
		var material := ShaderMaterial.new()
		material.shader = load(probe.shader)
		for index in probe.parameters.size():
			material.set_shader_parameter("p%d" % index, PackedInt32Array(probe.parameters[index]))
		rect.material = material
		viewport.add_child(rect)
		viewports.append(viewport)
	for frame in ${FRAMES_BEFORE_READ}:
		await RenderingServer.frame_post_draw
	print("GODOT ", Engine.get_version_info().string)
	print("ADAPTER ", RenderingServer.get_video_adapter_name())
	for index in data.size():
		var image: Image = viewports[index].get_texture().get_image()
		image.convert(Image.FORMAT_RGBA8)
		print("${LINE_PREFIX}", data[index].name, " ", image.get_data().hex_encode())
	get_tree().quit()
`;

/**
 * The bits of each probe's pixels in `stdout`, keyed by probe name, with Godot's version and
 * adapter. A pixel's four bytes are little-endian, as the shader wrote them.
 */
export function parseProbeOutput(stdout) {
  const lines = stdout.split('\n');
  const field = (prefix) => {
    const line = lines.find((text) => text.startsWith(prefix));
    if (!line) throw new Error(`expected a "${prefix}" line in Godot's output, found none`);
    return line.slice(prefix.length).trim();
  };
  const pixels = new Map();
  for (const line of lines.filter((text) => text.startsWith(LINE_PREFIX))) {
    const [name, hex] = line.slice(LINE_PREFIX.length).trim().split(' ');
    pixels.set(name, pixelBits(hex ?? ''));
  }
  return { godot: field('GODOT '), adapter: field('ADAPTER '), pixels };
}

function pixelBits(hex) {
  if (hex.length % 8 !== 0) throw new Error(`expected whole RGBA8 pixels, got ${hex.length} hex digits`);
  const bits = [];
  for (let offset = 0; offset < hex.length; offset += 8) {
    const bytes = hex
      .slice(offset, offset + 8)
      .match(/../g)
      .map((byte) => Number.parseInt(byte, 16));
    bits.push((bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0);
  }
  return bits;
}
