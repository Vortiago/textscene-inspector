import { QUAD, SIZE, SPHERE, SPHERE_VIEW, STILL } from './meshShapes.mjs';

/** A sun high to the left and in front of the sphere, so its lit side, its edge and its dark side show. */
const SUN_ROTATION = [-50, -30, 0];

/** A directional light turned by `rotation` in degrees, with the Godot properties `properties`. */
const sun = (properties = {}, rotation = SUN_ROTATION) => ({
  type: 'DirectionalLight3D',
  rotation,
  properties,
});

/** A lit shader with `modes` whose `fragment()` writes `fragment`, and `light()` when given. */
const litShader = ({ modes = [], fragment, light }) => `shader_type spatial;
${modes.length > 0 ? `render_mode ${modes.join(', ')};\n` : ''}
void fragment() {
	${fragment}
}
${light ? `\nvoid light() {\n\t${light}\n}\n` : ''}`;

/** A rough, slightly metallic grey, which shows the diffuse and the specular lobes together. */
const GREY = 'ALBEDO = vec3(0.8, 0.7, 0.6);\n\tROUGHNESS = 0.4;\n\tMETALLIC = 0.1;';

const LIT_ROWS = ['spatial.fragment.ALBEDO', 'spatial.fragment.ROUGHNESS', 'spatial.fragment.METALLIC'];

/** One lit sphere under `lights`, drawn by `shader`. */
const litScene = (name, { lights = [sun()], rows = [], ...shader } = {}) => ({
  name,
  ...SIZE,
  source: litShader({ fragment: GREY, ...shader }),
  camera: SPHERE_VIEW,
  mesh: SPHERE,
  object: STILL,
  lights,
  rows: [...LIT_ROWS, ...rows],
});

/** The sun's values one at a time: each lane of its row in the light buffer. */
const SUN_SCENES = [
  litScene('spatial-lit-ambient-only', { lights: [] }),
  litScene('spatial-lit-sun'),
  litScene('spatial-lit-sun-energy-zero', { lights: [sun({ light_energy: 0 })] }),
  litScene('spatial-lit-sun-energy-large', { lights: [sun({ light_energy: 16 })] }),
  litScene('spatial-lit-sun-negative', { lights: [sun({ light_energy: 0.6, light_negative: true })] }),
  litScene('spatial-lit-sun-colour', { lights: [sun({ light_color: [1, 0.55, 0.2], light_energy: 1.7 })] }),
  litScene('spatial-lit-sun-specular-zero', { lights: [sun({ light_specular: 0 })] }),
  litScene('spatial-lit-sun-specular-large', { lights: [sun({ light_specular: 4 })] }),
  litScene('spatial-lit-sun-angular-distance', { lights: [sun({ light_angular_distance: 20 })] }),
  litScene('spatial-lit-sun-grazing', { lights: [sun({}, [-5, 80, 0])] }),
  litScene('spatial-lit-sun-behind', { lights: [sun({}, [30, 160, 0])] }),
  litScene('spatial-lit-sun-culled', { lights: [sun({ light_cull_mask: 2 })] }),
  litScene('spatial-lit-sun-sky-only', { lights: [sun({ sky_mode: 2 })] }),
  litScene('spatial-lit-suns', {
    lights: [
      sun({ light_color: [0.2, 0.4, 1], light_energy: 0.8 }),
      sun({ light_color: [1, 0.3, 0.2], light_energy: 1.3 }, [-20, 120, 0]),
      sun({ light_energy: 0.4, light_specular: 2 }, [-80, 0, 0]),
    ],
  }),
];

/** The surface's own values: each input of the light function. */
const SURFACE_SCENES = [
  litScene('spatial-lit-metal-smooth', {
    fragment: 'ALBEDO = vec3(0.9, 0.6, 0.3);\n\tROUGHNESS = 0.0;\n\tMETALLIC = 1.0;',
  }),
  litScene('spatial-lit-metal-mid', {
    fragment: 'ALBEDO = vec3(0.9, 0.6, 0.3);\n\tROUGHNESS = 0.2;\n\tMETALLIC = 1.0;',
  }),
  // The alpha pass has no roughness limiter, so a smooth surface there shows no highlight.
  litScene('spatial-lit-alpha-smooth-metal', {
    fragment: 'ALBEDO = vec3(0.9, 0.6, 0.3);\n\tROUGHNESS = 0.0;\n\tMETALLIC = 1.0;\n\tALPHA = 0.8;',
    rows: ['spatial.fragment.ALPHA'],
  }),
  litScene('spatial-lit-rough-dielectric', {
    fragment: 'ALBEDO = vec3(0.3, 0.8, 0.4);\n\tROUGHNESS = 1.0;\n\tMETALLIC = 0.0;',
  }),
  litScene('spatial-lit-default-outputs', { fragment: 'ALBEDO = vec3(0.6);', rows: [] }),
];

/** Each diffuse and specular mode Godot's light function knows, and the mode that drops the ambient light. */
const MODE_SCENES = [
  'ambient_light_disabled',
  'diffuse_burley',
  'diffuse_lambert',
  'diffuse_lambert_wrap',
  'diffuse_toon',
  'specular_schlick_ggx',
  'specular_toon',
  'specular_disabled',
].map((mode) =>
  litScene(`spatial-lit-${mode.replaceAll('_', '-')}`, {
    modes: [mode],
    rows: [`spatial render_mode ${mode}`],
  })
);

/** A sun that casts a shadow, on a surface that takes none. */
const SHADOWS_DISABLED = litScene('spatial-lit-shadows-disabled', {
  modes: ['shadows_disabled'],
  lights: [sun({ shadow_enabled: true })],
  rows: ['spatial render_mode shadows_disabled'],
});

/** An output the light reads, written right of the highlight's left edge only, so a wrong read shows. */
const outputScene = (builtIn, written, extra = []) =>
  litScene(`spatial-lit-${builtIn.toLowerCase().replaceAll('_', '-')}`, {
    fragment: `${GREY}\n\tif (SCREEN_UV.x > 0.35) {\n\t\t${written}\n\t}`,
    rows: [`spatial.fragment.${builtIn}`, 'spatial.fragment.SCREEN_UV', ...extra],
  });

/** Each output only a lit surface reads, against Godot's default for it on the other half. */
const OUTPUT_SCENES = [
  outputScene('NORMAL', 'NORMAL = normalize(NORMAL + vec3(0.0, 0.6, 0.0));'),
  outputScene('NORMAL_MAP', 'NORMAL_MAP = vec3(0.8, 0.3, 0.9);'),
  outputScene('NORMAL_MAP_DEPTH', 'NORMAL_MAP = vec3(0.8, 0.3, 0.9);\n\t\tNORMAL_MAP_DEPTH = 3.0;', [
    'spatial.fragment.NORMAL_MAP',
  ]),
  outputScene('SPECULAR', 'SPECULAR = 1.0;'),
  outputScene('RIM', 'RIM = 1.0;\n\t\tRIM_TINT = 0.3;', ['spatial.fragment.RIM_TINT']),
  outputScene('CLEARCOAT', 'CLEARCOAT = 1.0;\n\t\tCLEARCOAT_ROUGHNESS = 1.0;', [
    'spatial.fragment.CLEARCOAT_ROUGHNESS',
  ]),
  outputScene('ANISOTROPY', 'ANISOTROPY = 0.9;\n\t\tANISOTROPY_FLOW = vec2(0.2, 0.9);', [
    'spatial.fragment.ANISOTROPY_FLOW',
  ]),
  outputScene('BACKLIGHT', 'BACKLIGHT = vec3(0.9, 0.4, 0.1);'),
  outputScene('AO', 'AO = 0.2;\n\t\tAO_LIGHT_AFFECT = 0.8;', ['spatial.fragment.AO_LIGHT_AFFECT']),
  outputScene('EMISSION', 'EMISSION = vec3(0.6, 0.1, 0.4);'),
  outputScene('LIGHT_VERTEX', 'LIGHT_VERTEX = VERTEX + vec3(0.0, 0.4, 0.0);'),
];

/** A `light()` function that reads the light's built-ins and writes both lights, on its own lit shader. */
const LIGHT_FUNCTION_SCENES = [
  litScene('spatial-lit-light-function', {
    light: [
      'float lambert = max(dot(NORMAL, LIGHT), 0.0);',
      'DIFFUSE_LIGHT += ALBEDO * LIGHT_COLOR * ATTENUATION * lambert / PI;',
      'vec3 half_vector = normalize(LIGHT + VIEW);',
      'SPECULAR_LIGHT += LIGHT_COLOR * SPECULAR_AMOUNT * pow(max(dot(NORMAL, half_vector), 0.0), 2.0 / max(ROUGHNESS, 0.05)) * (1.0 - METALLIC);',
    ].join('\n\t'),
    rows: [
      'spatial.light.NORMAL',
      'spatial.light.LIGHT',
      'spatial.light.VIEW',
      'spatial.light.LIGHT_COLOR',
      'spatial.light.ATTENUATION',
      'spatial.light.SPECULAR_AMOUNT',
      'spatial.light.ALBEDO',
      'spatial.light.ROUGHNESS',
      'spatial.light.METALLIC',
      'spatial.light.DIFFUSE_LIGHT',
      'spatial.light.SPECULAR_LIGHT',
    ],
  }),
  litScene('spatial-lit-light-function-directional', {
    lights: [sun({ light_color: [0.3, 0.9, 0.5] })],
    light: 'DIFFUSE_LIGHT += LIGHT_IS_DIRECTIONAL ? LIGHT_COLOR * 0.3 : vec3(1.0, 0.0, 0.0);',
    rows: ['spatial.light.LIGHT_IS_DIRECTIONAL', 'spatial.light.LIGHT_COLOR', 'spatial.light.DIFFUSE_LIGHT'],
  }),
  litScene('spatial-lit-light-function-uv2', {
    light: 'DIFFUSE_LIGHT += vec3(UV2, 0.3) * ATTENUATION;',
    rows: ['spatial.light.UV2', 'spatial.light.ATTENUATION', 'spatial.light.DIFFUSE_LIGHT'],
  }),
  litScene('spatial-lit-light-function-space', {
    light: [
      'vec3 world = (INV_VIEW_MATRIX * vec4(LIGHT, 0.0)).xyz;',
      'DIFFUSE_LIGHT += abs(world) * 0.5 + vec3(SCREEN_UV, FRAGCOORD.z) * 0.2 + vec3(UV, 0.0) * 0.1;',
      'DIFFUSE_LIGHT += vec3(MODEL_MATRIX[3].x + VIEWPORT_SIZE.x / 640.0, (VIEW_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).z * -0.05, (PROJECTION_MATRIX * INV_PROJECTION_MATRIX)[1][1] * 0.1);',
    ].join('\n\t'),
    rows: [
      'spatial.light.INV_VIEW_MATRIX',
      'spatial.light.SCREEN_UV',
      'spatial.light.FRAGCOORD',
      'spatial.light.UV',
      'spatial.light.MODEL_MATRIX',
      'spatial.light.VIEWPORT_SIZE',
      'spatial.light.VIEW_MATRIX',
      'spatial.light.PROJECTION_MATRIX',
      'spatial.light.INV_PROJECTION_MATRIX',
      'spatial.light.DIFFUSE_LIGHT',
    ],
  }),
  litScene('spatial-lit-light-function-backlight-alpha', {
    fragment: `${GREY}\n\tBACKLIGHT = vec3(0.2, 0.5, 0.9);\n\tALPHA = 0.7;`,
    modes: ['depth_draw_always'],
    light: 'DIFFUSE_LIGHT += BACKLIGHT * ALPHA * max(dot(-NORMAL, LIGHT), 0.0) + vec3(0.1) * ATTENUATION;',
    rows: ['spatial.light.BACKLIGHT', 'spatial.light.ALPHA', 'spatial.fragment.ALPHA'],
  }),
];

/** A quad straight at the camera under a sun straight behind it, so N.L and N.H are 1 on every pixel. */
const FLAT_SCENES = [
  {
    ...litScene('spatial-lit-quad-facing-sun', { lights: [sun({}, [0, 0, 0])] }),
    mesh: QUAD,
    camera: { fov: 75, rotation: [0, 0, 0], position: [0, 0, 2] },
  },
];

export const LIT_SCENES = [
  ...SUN_SCENES,
  ...SURFACE_SCENES,
  ...MODE_SCENES,
  SHADOWS_DISABLED,
  ...OUTPUT_SCENES,
  ...LIGHT_FUNCTION_SCENES,
  ...FLAT_SCENES,
];
