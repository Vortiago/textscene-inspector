import { parseViewportOutput, viewportProjectFiles, viewportScript } from './godotViewports.mjs';

const LINE_PREFIX = 'SKY ';
const FILES = { dataFile: 'skies.json', shaderPrefix: 'sky' };

/** A WorldEnvironment of the scene's sky shader or sky material class, and its suns, in each viewport. */
export const SKY_MAIN_SCRIPT = viewportScript({
  dataFile: FILES.dataFile,
  linePrefix: LINE_PREFIX,
  functions: `
func color(values: Array) -> Color:
	return Color(values[0], values[1], values[2])

func sky_material(scene: Dictionary) -> Material:
	if not scene.has("material"):
		var shader_material := ShaderMaterial.new()
		shader_material.shader = load(scene.shader)
		return shader_material
	var material: Material = ClassDB.instantiate(scene.material["class"])
	for name in scene.material.properties:
		material.set(name, str_to_var(scene.material.properties[name]))
	return material

func environment(scene: Dictionary) -> Environment:
	var sky := Sky.new()
	sky.sky_material = sky_material(scene)
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
    ...(scene.material ? { material: scene.material } : {}),
  }));

export const parseSkyOutput = (stdout) => parseViewportOutput(stdout, LINE_PREFIX);
