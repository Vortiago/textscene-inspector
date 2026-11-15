/**
 * The main script and files that run every probe at once: one SubViewport per probe, drawn for a
 * few frames, then each viewport's pixels printed as hex. The parse of that output is split from
 * the run, so its test needs no engine.
 */

import {
  FRAMES_BEFORE_READ,
  inChunksOfAtMost,
  oneGodot,
  printedField,
  printedImages,
  requireGodotVersion,
  runGodotScript,
} from './godotRun.mjs';
import { parameterBits, probeShader, probeWidth } from './probeShader.mjs';

/** The prefix of each output line that carries a probe's pixels. */
const LINE_PREFIX = 'PROBE ';

const PREPROCESSED_PREFIX = 'PREPROCESSED ';

/** The data file the script reads: each probe's name, width, shader file and parameter bits. */
function probeData(probes) {
  return probes.map((probe, index) => ({
    name: probe.name,
    width: probeWidth(probe),
    shader: `res://probe_${index}.gdshader`,
    recordsPreprocessed: probe.recordsPreprocessed === true,
    // GDScript's PackedInt32Array holds the bits as signed integers.
    parameters: parameterBits(probe).map((bits) => bits.map((value) => value | 0)),
  }));
}

/** The shader files, keyed by their file name in the project. */
function probeShaderFiles(probes) {
  return Object.fromEntries(probes.map((probe, index) => [`probe_${index}.gdshader`, probeShader(probe)]));
}

/** Every probe's includes in one project, so a name two probes give two texts throws. */
export function probeIncludeFiles(probes) {
  const files = {};
  for (const [name, text] of probes.flatMap((probe) => Object.entries(probe.includes ?? {}))) {
    if (Object.hasOwn(files, name) && files[name] !== text)
      throw new Error(`expected one text for the include ${name}, got two`);
    files[name] = text;
  }
  return files;
}

/** The files beside the main script, keyed by their names in the project. */
export function probeProjectFiles(probes) {
  return {
    'probes.json': JSON.stringify(probeData(probes)),
    ...probeShaderFiles(probes),
    ...probeIncludeFiles(probes),
  };
}

export const MAIN_SCRIPT = `extends Node

func _ready() -> void:
	var data: Array = JSON.parse_string(FileAccess.get_file_as_string("res://probes.json"))
	var viewports: Array = []
	var preprocessed := {}
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
		if probe.recordsPreprocessed:
			preprocessed[probe.name] = RenderingServer.shader_get_code(material.shader.get_rid())
	for frame in ${FRAMES_BEFORE_READ}:
		await RenderingServer.frame_post_draw
	print("GODOT ", Engine.get_version_info().string)
	print("ADAPTER ", RenderingServer.get_video_adapter_name())
	for name in preprocessed:
		print("${PREPROCESSED_PREFIX}", name, " ", JSON.stringify(preprocessed[name]))
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
  const pixels = new Map();
  for (const [name, bytes] of printedImages(stdout, LINE_PREFIX)) pixels.set(name, pixelBits(bytes));
  return {
    godot: printedField(stdout, 'GODOT '),
    adapter: printedField(stdout, 'ADAPTER '),
    pixels,
    preprocessed: printedTexts(stdout),
  };
}

function printedTexts(stdout) {
  const lines = stdout.split('\n').filter((line) => line.startsWith(PREPROCESSED_PREFIX));
  return new Map(
    lines.map((line) => {
      const rest = line.slice(PREPROCESSED_PREFIX.length);
      const space = rest.indexOf(' ');
      return [rest.slice(0, space), JSON.parse(rest.slice(space + 1))];
    })
  );
}

function pixelBits(bytes) {
  if (bytes.length % 4 !== 0) throw new Error(`expected whole RGBA8 pixels, got ${bytes.length} bytes`);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  return Array.from({ length: bytes.length / 4 }, (_, pixel) => view.getUint32(pixel * 4, true));
}

/**
 * A Godot run keeps each probe's material, about 5 MB, until it ends: 700 probes in each of 4 runs
 * at once passed the 15 GB of the container. 256 keeps 4 runs under 6 GB.
 */
const PROBES_PER_RUN_AT_MOST = 256;

/**
 * Godot's answers to `probes` from runs of the pinned release at once: its version, adapter and
 * pixels. Every run must name the same Godot and adapter, or its pixels would mix two engines.
 */
export async function runProbesInGodot(probes) {
  const outputs = await inChunksOfAtMost(probes, PROBES_PER_RUN_AT_MOST, async (chunk) =>
    parseProbeOutput(await runGodotScript(MAIN_SCRIPT, probeProjectFiles(chunk)))
  );
  const { godot, adapter } = oneGodot(outputs);
  requireGodotVersion(godot);
  return {
    godot,
    adapter,
    pixels: new Map(outputs.flatMap((output) => [...output.pixels])),
    preprocessed: new Map(outputs.flatMap((output) => [...output.preprocessed])),
  };
}
