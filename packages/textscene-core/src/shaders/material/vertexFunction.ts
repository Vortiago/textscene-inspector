import { BILLBOARD, DETAIL_UV_2, SHADING_MODE, type MaterialKey } from './materialKey.js';

const KEEP_SCALE = `
	// Billboard Keep Scale: Enabled
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(
			vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0),
			vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0),
			vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0),
			vec4(0.0, 0.0, 0.0, 1.0));
`;

const NORMAL_MATRIX = '	MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);\n';

/** `MAIN_CAM_INV_VIEW_MATRIX` inverts the camera in a shadow pass too, so a shadow faces the camera. */
const BILLBOARD_MATRICES = [
  '',
  `
	// Billboard Mode: Enabled
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(
			MAIN_CAM_INV_VIEW_MATRIX[0],
			MAIN_CAM_INV_VIEW_MATRIX[1],
			MAIN_CAM_INV_VIEW_MATRIX[2],
			MODEL_MATRIX[3]);
`,
  `
	// Billboard Mode: Y-Billboard
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(
			vec4(normalize(cross(vec3(0.0, 1.0, 0.0), MAIN_CAM_INV_VIEW_MATRIX[2].xyz)), 0.0),
			vec4(0.0, 1.0, 0.0, 0.0),
			vec4(normalize(cross(MAIN_CAM_INV_VIEW_MATRIX[0].xyz, vec3(0.0, 1.0, 0.0))), 0.0),
			MODEL_MATRIX[3]);
`,
  `
	// Billboard Mode: Particles
	mat4 mat_world = mat4(
			normalize(INV_VIEW_MATRIX[0]),
			normalize(INV_VIEW_MATRIX[1]),
			normalize(INV_VIEW_MATRIX[2]),
			MODEL_MATRIX[3]);
	mat_world = mat_world * mat4(
			vec4(cos(INSTANCE_CUSTOM.x), -sin(INSTANCE_CUSTOM.x), 0.0, 0.0),
			vec4(sin(INSTANCE_CUSTOM.x), cos(INSTANCE_CUSTOM.x), 0.0, 0.0),
			vec4(0.0, 0.0, 1.0, 0.0),
			vec4(0.0, 0.0, 0.0, 1.0));
	MODELVIEW_MATRIX = VIEW_MATRIX * mat_world;
`,
];

const PARTICLE_ANIMATION = `
	MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);

	float h_frames = float(particles_anim_h_frames);
	float v_frames = float(particles_anim_v_frames);
	float particle_total_frames = float(particles_anim_h_frames * particles_anim_v_frames);
	float particle_frame = floor(INSTANCE_CUSTOM.z * float(particle_total_frames));
	if (!particles_anim_loop) {
		particle_frame = clamp(particle_frame, 0.0, particle_total_frames - 1.0);
	} else {
		particle_frame = mod(particle_frame, particle_total_frames);
	}
	UV /= vec2(h_frames, v_frames);
	UV += vec2(mod(particle_frame, h_frames) / h_frames, floor((particle_frame + 0.5) / h_frames) / v_frames);
`;

const FIXED_SIZE = `
	// Fixed Size: Enabled
	if (PROJECTION_MATRIX[3][3] != 0.0) {
		// Orthogonal matrix; try to do about the same with viewport size.
		float h = abs(1.0 / (2.0 * PROJECTION_MATRIX[1][1]));
		// Consistent with vertical FOV (Keep Height).
		float sc = (h * 2.0);
		MODELVIEW_MATRIX[0] *= sc;
		MODELVIEW_MATRIX[1] *= sc;
		MODELVIEW_MATRIX[2] *= sc;
	} else {
		// Scale by depth.
		float sc;
		if (IS_MULTIVIEW) {
			// Assuming stereo rendering.
			// Moving in the z-plane gives the illusion of the object growing/shrinking in size.
			// We need to take the full distance to camera to compensate.
			sc = length((MODELVIEW_MATRIX)[3].xyz);
		} else {
			sc = -(MODELVIEW_MATRIX)[3].z;
		}
		MODELVIEW_MATRIX[0] *= sc;
		MODELVIEW_MATRIX[1] *= sc;
		MODELVIEW_MATRIX[2] *= sc;
	}
`;

const FOV_OVERRIDE = `
	if (!IN_SHADOW_PASS) {
		float flip_y = sign(PROJECTION_MATRIX[1][1]);
		float aspect = PROJECTION_MATRIX[1][1] / PROJECTION_MATRIX[0][0];
		float f = flip_y / tan(fov_override * PI / 360.0);
		PROJECTION_MATRIX[0][0] = f / aspect;
		PROJECTION_MATRIX[1][1] = f;
	}
`;

/** The `vertex()` function Godot writes for the key (`material.cpp:1220`). */
export function vertexFunction(key: MaterialKey): string {
  const { flags } = key;
  let code = `
void vertex() {`;
  if (flags.has('SRGB_VERTEX_COLOR'))
    code += `
	// Vertex Color is sRGB: Enabled
	if (!OUTPUT_IS_SRGB) {
		COLOR.rgb = mix(
				pow((COLOR.rgb + vec3(0.055)) * (1.0 / (1.0 + 0.055)), vec3(2.4)),
				COLOR.rgb * (1.0 / 12.92),
				lessThan(COLOR.rgb, vec3(0.04045)));
	}
`;
  if (flags.has('USE_POINT_SIZE'))
    code += `
	// Use Point Size: Enabled
	POINT_SIZE = point_size;
`;
  if (key.shadingMode === SHADING_MODE.PER_VERTEX)
    code += `
	// Shading Mode: Per Vertex
	ROUGHNESS = roughness;
`;
  code += uvTransforms(key);
  code += billboard(key);
  if (flags.has('FIXED_SIZE')) code += FIXED_SIZE;
  code += triplanar(key);
  if (key.grow)
    code += `
	// Grow: Enabled
	VERTEX += NORMAL * grow;
`;
  if (flags.has('USE_Z_CLIP_SCALE'))
    code += `
	Z_CLIP_SCALE = z_clip_scale;
`;
  if (flags.has('USE_FOV_OVERRIDE')) code += FOV_OVERRIDE;
  return `${code}}\n`;
}

/** UV1 and UV2 sit together: UV2 takes no blank line of its own after UV1's. */
function uvTransforms(key: MaterialKey): string {
  const { flags } = key;
  let code = '';
  if (!flags.has('UV1_USE_TRIPLANAR'))
    code += `
	UV = UV * uv1_scale.xy + uv1_offset.xy;
`;
  if (key.detailUv === DETAIL_UV_2 && !flags.has('UV2_USE_TRIPLANAR')) {
    if (flags.has('UV1_USE_TRIPLANAR')) code += '\n';
    code += `	// Detail UV Layer: UV2
	UV2 = UV2 * uv2_scale.xy + uv2_offset.xy;
`;
  }
  return code;
}

function billboard(key: MaterialKey): string {
  if (key.billboardMode === BILLBOARD.DISABLED) return '';
  const keepScale = key.flags.has('BILLBOARD_KEEP_SCALE') ? KEEP_SCALE : '';
  const after = key.billboardMode === BILLBOARD.PARTICLES ? PARTICLE_ANIMATION : NORMAL_MATRIX;
  return BILLBOARD_MATRICES[key.billboardMode] + keepScale + after;
}

/** The world tangent and binormal of a triplanar map, then each UV's weights and position. */
function triplanar(key: MaterialKey): string {
  const { flags } = key;
  const isWorld = flags.has('UV1_USE_WORLD_TRIPLANAR');
  let code = '';
  if (flags.has('UV1_USE_TRIPLANAR') || flags.has('UV2_USE_TRIPLANAR')) {
    code += isWorld
      ? `
	vec3 normal = MODEL_NORMAL_MATRIX * NORMAL;
`
      : `
	vec3 normal = NORMAL;
`;
    code += `
	TANGENT = vec3(0.0, 0.0, -1.0) * abs(normal.x);
	TANGENT += vec3(1.0, 0.0, 0.0) * abs(normal.y);
	TANGENT += vec3(1.0, 0.0, 0.0) * abs(normal.z);
`;
    code += isWorld
      ? '	TANGENT = inverse(MODEL_NORMAL_MATRIX) * normalize(TANGENT);\n'
      : '	TANGENT = normalize(TANGENT);\n';
    code += `
	BINORMAL = vec3(0.0, 1.0, 0.0) * abs(normal.x);
	BINORMAL += vec3(0.0, 0.0, -1.0) * abs(normal.y);
	BINORMAL += vec3(0.0, 1.0, 0.0) * abs(normal.z);
`;
    code += isWorld
      ? '	BINORMAL = inverse(MODEL_NORMAL_MATRIX) * normalize(BINORMAL);\n'
      : '	BINORMAL = normalize(BINORMAL);\n';
  }
  if (flags.has('UV1_USE_TRIPLANAR')) {
    code += isWorld
      ? `
	// UV1 Triplanar: Enabled (with World Triplanar)
	uv1_power_normal = pow(abs(normal), vec3(uv1_blend_sharpness));
	uv1_triplanar_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz * uv1_scale + uv1_offset;
`
      : `
	// UV1 Triplanar: Enabled
	uv1_power_normal = pow(abs(NORMAL), vec3(uv1_blend_sharpness));
	uv1_triplanar_pos = VERTEX * uv1_scale + uv1_offset;
`;
    code += `	uv1_power_normal /= dot(uv1_power_normal, vec3(1.0));
	uv1_triplanar_pos *= vec3(1.0, -1.0, 1.0);
`;
  }
  if (flags.has('UV2_USE_TRIPLANAR')) {
    code += flags.has('UV2_USE_WORLD_TRIPLANAR')
      ? `
	// UV2 Triplanar: Enabled (with World Triplanar)
	uv2_power_normal = pow(abs(mat3(MODEL_MATRIX) * NORMAL), vec3(uv2_blend_sharpness));
	uv2_triplanar_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz * uv2_scale + uv2_offset;
`
      : `
	// UV2 Triplanar: Enabled
	uv2_power_normal = pow(abs(NORMAL), vec3(uv2_blend_sharpness));
	uv2_triplanar_pos = VERTEX * uv2_scale + uv2_offset;
`;
    code += `	uv2_power_normal /= dot(uv2_power_normal, vec3(1.0));
	uv2_triplanar_pos *= vec3(1.0, -1.0, 1.0);
`;
  }
  return code;
}
