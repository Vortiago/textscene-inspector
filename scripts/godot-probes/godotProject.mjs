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
    materialValues: probe.materialValues ?? {},
    textures: probe.textures ?? {},
    hdr2d: probe.hdr2d === true,
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
		viewport.use_hdr_2d = probe.hdr2d
		add_child(viewport)
		var rect := ColorRect.new()
		rect.size = Vector2(probe.width, 1)
		var material := ShaderMaterial.new()
		material.shader = load(probe.shader)
		for index in probe.parameters.size():
			material.set_shader_parameter("p%d" % index, PackedInt32Array(probe.parameters[index]))
		for name in probe.materialValues:
			var value = str_to_var(probe.materialValues[name])
			# str_to_var gives null for text it cannot read, and the shader would read a silent zero.
			if value == null:
				push_error("probe %s: str_to_var cannot read %s" % [probe.name, probe.materialValues[name]])
				get_tree().quit(1)
				return
			material.set_shader_parameter(name, value)
		for name in probe.textures:
			material.set_shader_parameter(name, texture_value(probe.textures[name]))
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
		print("${LINE_PREFIX}", data[index].name, " ", bytes_of(image).hex_encode())
	get_tree().quit()

# A texture spec, a list of them, or null, as the probe's textures hold it.
func texture_value(spec):
	if spec is Array:
		return spec.map(func(each): return texture_of(each))
	return texture_of(spec)

func texture_of(spec):
	if spec == null:
		return null
	var width := int(spec.width)
	var height := int(spec.height)
	var levels: Array = spec.levels
	var count := 6 if spec.kind == "cube" else int(spec.get("depth", 1))
	match spec.kind:
		"flat":
			return ImageTexture.create_from_image(image_of(width, height, levels, 0, spec.get("format", "rgba8")))
		"layers", "cube":
			var images: Array[Image] = []
			for layer in count:
				images.append(image_of(width, height, levels, layer, spec.get("format", "rgba8")))
			var layered = Texture2DArray.new() if spec.kind == "layers" else Cubemap.new()
			layered.create_from_images(images)
			return layered
		"volume":
			var slices: Array[Image] = []
			for level in levels.size():
				var bytes: PackedByteArray = levels[level].hex_decode()
				var size := level_size(width, level) * level_size(height, level) * 4
				for slice in level_size(count, level):
					slices.append(Image.create_from_data(level_size(width, level), level_size(height, level), false, Image.FORMAT_RGBA8, bytes.slice(slice * size, (slice + 1) * size)))
			var volume := ImageTexture3D.new()
			volume.create(Image.FORMAT_RGBA8, width, height, count, levels.size() > 1, slices)
			return volume
	push_error("unknown texture kind %s" % spec.kind)
	get_tree().quit(1)

func level_size(size: int, level: int) -> int:
	return max(size >> level, 1)

# One layer of each level, one after the other, as Image keeps a mip chain.
const IMAGE_FORMATS := { "rgba8": [Image.FORMAT_RGBA8, 4], "rg8": [Image.FORMAT_RG8, 2] }

func image_of(width: int, height: int, levels: Array, layer: int, format: String) -> Image:
	var data := PackedByteArray()
	var texel_bytes: int = IMAGE_FORMATS[format][1]
	for level in levels.size():
		var size := level_size(width, level) * level_size(height, level) * texel_bytes
		data.append_array(levels[level].hex_decode().slice(layer * size, (layer + 1) * size))
	return Image.create_from_data(width, height, levels.size() > 1, IMAGE_FORMATS[format][0], data)

# An HDR 2D viewport holds half floats, which Image.convert truncates: k / 255 comes back as k - 1.
func bytes_of(image: Image) -> PackedByteArray:
	if image.get_format() == Image.FORMAT_RGBA8:
		return image.get_data()
	var bytes := PackedByteArray()
	for y in image.get_height():
		for x in image.get_width():
			var pixel := image.get_pixel(x, y)
			for channel in [pixel.r, pixel.g, pixel.b, pixel.a]:
				bytes.append(roundi(channel * 255.0))
	return bytes
`;

/** A pixel's four bytes are little-endian, as the shader wrote them. */
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

/** About 5 MB per kept material: 700 probes in 4 runs passed 15 GB, 256 keeps them under 6 GB. */
const PROBES_PER_RUN_AT_MOST = 256;

/** Every run must name the same Godot and adapter, or its pixels would mix two engines. */
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
