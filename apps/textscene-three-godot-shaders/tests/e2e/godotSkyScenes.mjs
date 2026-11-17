import { parseViewportOutput, viewportProjectFiles, viewportScript } from './godotViewports.mjs';

const LINE_PREFIX = 'SKY ';
const FILES = { dataFile: 'skies.json', shaderPrefix: 'sky' };

/** A WorldEnvironment of the scene's sky and its suns in each viewport. */
export const SKY_MAIN_SCRIPT = viewportScript({
  dataFile: FILES.dataFile,
  linePrefix: LINE_PREFIX,
  functions: `
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
`,
  fill: `		var world := WorldEnvironment.new()
		world.environment = environment(scene)
		viewport.add_child(world)
		for light in scene.lights:
			var sun := DirectionalLight3D.new()
			sun.rotation = degrees(light.rotation)
			sun.light_color = color(light.color)
			sun.light_energy = light.energy
			sun.light_angular_distance = light.size
			viewport.add_child(sun)`,
});

/** The files beside the main script, keyed by their names in the project. */
export const skyProjectFiles = (scenes) =>
  viewportProjectFiles(FILES, scenes, (scene) => ({
    lights: scene.lights,
    ...(scene.fog ? { fog: scene.fog } : {}),
  }));

/** One Godot run per clock, the scenes of no clock first: Godot holds one step and one rollover per run. */
export function skyRuns(scenes) {
  const runs = new Map();
  for (const scene of scenes) {
    const key = scene.clock ? JSON.stringify(scene.clock) : '';
    if (!runs.has(key)) runs.set(key, { scenes: [], options: runOptions(scene.clock) });
    runs.get(key).scenes.push(scene);
  }
  return [...runs.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : 0)).map(([, run]) => run);
}

/** `--fixed-fps` steps `TIME` by 1/fps, with no jitter fix to shorten a step (`rasterizer_gles3.cpp:101`). */
function runOptions(clock) {
  if (!clock) return { arguments: [], settings: '' };
  return {
    arguments: ['--fixed-fps', String(clock.fixedFps)],
    settings: `${ROLLOVER_SECTION}${clock.rolloverSeconds}\n${NO_JITTER_FIX}`,
  };
}

const ROLLOVER_SECTION = '[rendering]\nlimits/time/time_rollover_secs=';
const NO_JITTER_FIX = '\n[physics]\ncommon/physics_jitter_fix=0.0\n';

export const parseSkyOutput = (stdout) => parseViewportOutput(stdout, LINE_PREFIX);
