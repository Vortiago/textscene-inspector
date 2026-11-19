import {
  FRAMES_BEFORE_READ,
  printedField,
  printedImages,
} from '../../../../scripts/godot-probes/godotRun.mjs';

/**
 * One SubViewport and Camera3D per scene; `fill` adds the rest of a scene to `viewport`.
 * @canonical a Godot run that prints one viewport image per scene
 */
export function viewportScript({ dataFile, linePrefix, functions = '', fill }) {
  return `extends Node

func degrees(values: Array) -> Vector3:
	return Vector3(deg_to_rad(values[0]), deg_to_rad(values[1]), deg_to_rad(values[2]))

const MSAA_OF_SAMPLES := {1: Viewport.MSAA_DISABLED, 2: Viewport.MSAA_2X, 4: Viewport.MSAA_4X, 8: Viewport.MSAA_8X}

func vector(values: Array) -> Vector3:
	return Vector3(values[0], values[1], values[2])
${functions}
func _ready() -> void:
	var data: Array = JSON.parse_string(FileAccess.get_file_as_string("res://${dataFile}"))
	var viewports: Array = []
	for scene in data:
		var viewport := SubViewport.new()
		viewport.size = Vector2i(int(scene.width), int(scene.height))
		viewport.own_world_3d = true
		viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		viewport.msaa_3d = MSAA_OF_SAMPLES[int(scene.get("msaa", 1))]
		add_child(viewport)
		var camera := Camera3D.new()
		camera.fov = scene.camera.fov
		camera.rotation = degrees(scene.camera.rotation)
		if scene.camera.has("position"):
			camera.position = vector(scene.camera.position)
		if scene.camera.has("near"):
			camera.near = scene.camera.near
		if scene.camera.has("far"):
			camera.far = scene.camera.far
		if scene.camera.get("projection", "") == "orthogonal":
			camera.projection = Camera3D.PROJECTION_ORTHOGONAL
			camera.size = scene.camera.size
		if scene.camera.get("projection", "") == "frustum":
			camera.projection = Camera3D.PROJECTION_FRUSTUM
			camera.size = scene.camera.size
			camera.frustum_offset = Vector2(scene.camera.offset[0], scene.camera.offset[1])
		viewport.add_child(camera)
${fill}
		viewports.append(viewport)
	for frame in ${FRAMES_BEFORE_READ}:
		await RenderingServer.frame_post_draw
	print("GODOT ", Engine.get_version_info().string)
	for index in data.size():
		var image: Image = viewports[index].get_texture().get_image()
		image.convert(Image.FORMAT_RGBA8)
		print("${linePrefix}", data[index].name, " ", image.get_data().hex_encode())
	get_tree().quit()
`;
}

/** The data file and one shader file per scene, keyed by their names in the project. */
export function viewportProjectFiles({ dataFile, shaderPrefix }, scenes, fieldsOf) {
  const data = scenes.map((scene, index) => ({
    name: scene.name,
    width: scene.width,
    height: scene.height,
    camera: scene.camera,
    ...(scene.msaa ? { msaa: scene.msaa } : {}),
    ...fieldsOf(scene, index),
    shader: `res://${shaderPrefix}_${index}.gdshader`,
  }));
  return {
    [dataFile]: JSON.stringify(data),
    ...Object.fromEntries(scenes.map((scene, index) => [`${shaderPrefix}_${index}.gdshader`, scene.source])),
  };
}

/** Each scene's RGBA8 bytes in `stdout`, top row first, keyed by name, with Godot's version. */
export function parseViewportOutput(stdout, linePrefix) {
  return { godot: printedField(stdout, 'GODOT '), images: printedImages(stdout, linePrefix) };
}

/** One Godot run per clock and rendering method, plain scenes first: Godot holds one of each per run. */
export function godotRuns(scenes) {
  const runs = new Map();
  for (const scene of scenes) {
    const { clock, renderingMethod, depthPrepass } = scene;
    const key =
      clock || renderingMethod || depthPrepass === false
        ? JSON.stringify([clock, renderingMethod, depthPrepass])
        : '';
    if (!runs.has(key)) runs.set(key, { scenes: [], options: runOptions(scene) });
    runs.get(key).scenes.push(scene);
  }
  return [...runs.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : 0)).map(([, run]) => run);
}

function runOptions({ clock, renderingMethod, depthPrepass }) {
  const method = renderingMethod ? `renderer/rendering_method="${renderingMethod}"\n` : '';
  const rendering = `${method}${depthPrepass === false ? 'driver/depth_prepass/enable=false\n' : ''}`;
  if (!clock) return { arguments: [], settings: rendering && `[rendering]\n${rendering}` };
  // `--fixed-fps` steps `TIME` by 1/fps, with no jitter fix to shorten a step (`rasterizer_gles3.cpp:101`).
  return {
    arguments: ['--fixed-fps', String(clock.fixedFps)],
    settings: `[rendering]\n${rendering}${ROLLOVER_KEY}${clock.rolloverSeconds}\n${NO_JITTER_FIX}`,
  };
}

const ROLLOVER_KEY = 'limits/time/time_rollover_secs=';
const NO_JITTER_FIX = '\n[physics]\ncommon/physics_jitter_fix=0.0\n';
