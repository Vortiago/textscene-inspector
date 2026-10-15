/**
 * The scenes the measurement compiles: a ground and a post under shadowed suns, on Godot's
 * default material or on a material three draws as `MeshPhysicalMaterial`, with five maps,
 * clearcoat, a sky and fog. A soft sun has an angular distance, which turns Godot's directional
 * soft shadows on.
 */

/** The angle of a soft sun, in degrees. Any angle above zero compiles the soft shadow. */
const SOFT_SUN_ANGLE = 5;

const PHYSICAL_RESOURCES = `[sub_resource type="FastNoiseLite" id="Noise"]

[sub_resource type="NoiseTexture2D" id="Map"]
width = 64
height = 64
noise = SubResource("Noise")

[sub_resource type="StandardMaterial3D" id="Physical"]
albedo_texture = SubResource("Map")
metallic_texture = SubResource("Map")
roughness_texture = SubResource("Map")
normal_enabled = true
normal_texture = SubResource("Map")
emission_enabled = true
emission_texture = SubResource("Map")
clearcoat_enabled = true

[sub_resource type="ProceduralSkyMaterial" id="SkyMaterial"]

[sub_resource type="Sky" id="Sky"]
sky_material = SubResource("SkyMaterial")

[sub_resource type="Environment" id="Environment"]
background_mode = 2
sky = SubResource("Sky")
fog_enabled = true
`;

const PHYSICAL_ENVIRONMENT = `
[node name="Environment" type="WorldEnvironment" parent="."]
environment = SubResource("Environment")
`;

/**
 * @param {{ suns: number, soft: boolean, physical: boolean }} measured
 * @returns {string} the scene's `.tscn` text.
 */
export function measuredScene({ suns, soft, physical }) {
  const material = physical ? 'material = SubResource("Physical")\n' : '';
  const sunNodes = Array.from({ length: suns }, (_, index) => sunNode(index + 1, soft)).join('');
  return `[gd_scene format=3]

${physical ? PHYSICAL_RESOURCES : ''}
[sub_resource type="PlaneMesh" id="Ground"]
size = Vector2(4, 4)
${material}
[sub_resource type="BoxMesh" id="Post"]
size = Vector3(0.3, 1.2, 0.3)
${material}
[node name="Measured" type="Node3D"]
${physical ? PHYSICAL_ENVIRONMENT : ''}
[node name="Ground" type="MeshInstance3D" parent="."]
mesh = SubResource("Ground")

[node name="Post" type="MeshInstance3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.6, 0)
mesh = SubResource("Post")
${sunNodes}`;
}

function sunNode(number, soft) {
  return `
[node name="Sun${number}" type="DirectionalLight3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 0.5, 0.866, 0, -0.866, 0.5, 0, 2, 0)
shadow_enabled = true
${soft ? `light_angular_distance = ${SOFT_SUN_ANGLE}\n` : ''}`;
}
