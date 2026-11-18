import { FRAMES_BEFORE_READ } from '../../../../scripts/godot-probes/godotRun.mjs';

/** Godot's default spatial shader (`scene_shader_forward_clustered.cpp:910`), drawn unshaded. */
export const DEFAULT_SPATIAL_UNSHADED = `shader_type spatial;
render_mode unshaded;

void vertex() {
	ROUGHNESS = 0.8;
}

void fragment() {
	ALBEDO = vec3(0.6);
	ROUGHNESS = 0.8;
	METALLIC = 0.2;
}
`;

/** The rows of Godot's default spatial shader, drawn unshaded. */
const DEFAULT_ROWS = [
  'spatial render_mode unshaded',
  'spatial.vertex.ROUGHNESS',
  'spatial.fragment.ALBEDO',
  'spatial.fragment.ROUGHNESS',
  'spatial.fragment.METALLIC',
];

const SIZE = { width: 64, height: 64, chapter: 'spatial.md' };

/** A camera two units back from the origin, looking along -Z, with Godot's default field of view. */
const BACK = { fov: 75, rotation: [0, 0, 0], position: [0, 0, 2] };

/** A quad facing +Z as Godot's arrays hold it: two triangles of clockwise front faces, a normal a corner. */
const QUAD = {
  positions: [
    [-0.5, -0.5, 0],
    [-0.5, 0.5, 0],
    [0.5, 0.5, 0],
    [-0.5, -0.5, 0],
    [0.5, 0.5, 0],
    [0.5, -0.5, 0],
  ],
  normals: Array.from({ length: 6 }, () => [0, 0, 1]),
};

const STILL = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };

/** Moved, turned on all three axes and scaled apart, so each lane of the instance transform shows. */
const MOVED = { position: [0.3, -0.2, -0.5], rotation: [20, 35, -10], scale: [1.4, 0.6, 1] };

/** A camera off the axis, turned down and to the side, so each lane of the view matrix shows. */
const TURNED = { fov: 60, rotation: [-10, 15, 0], position: [0.6, 0.4, 2.2] };

/** The rows an attribute scene proves: unshaded, `ALBEDO`, and the attribute it shows. */
const attributeRows = (builtIn) => [
  'spatial render_mode unshaded',
  'spatial.fragment.ALBEDO',
  `spatial.fragment.${builtIn}`,
];

/** The head of an unshaded shader with `modes` after `unshaded`. */
const unshadedHead = (modes) => `shader_type spatial;
render_mode ${['unshaded', ...modes].join(', ')};
`;

/** An unshaded shader with `modes` after `unshaded`, and `fragment()` as given. */
const withModes = (modes, fragment) => `${unshadedHead(modes)}
void fragment() {
	${fragment}
}
`;

/** An unshaded shader that shows `value`, a `vec3` of the fragment stage, as its colour. */
const showing = (value) => withModes([], `ALBEDO = ${value};`);

const RINGS = 8;
const SEGMENTS = 12;

/** A point of the unit sphere, as three's SphereGeometry places it, and its tangent along the segments. */
function spherePoint(ring, segment) {
  const theta = (ring / RINGS) * Math.PI;
  const phi = (segment / SEGMENTS) * 2 * Math.PI;
  const position = [-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)];
  const u = segment / SEGMENTS;
  const v = 1 - ring / RINGS;
  return {
    position,
    normal: position,
    tangent: [Math.sin(phi), 0, Math.cos(phi), 1],
    uv: [u, v],
    uv2: [v * 0.5, u * 0.75 + 0.1],
    color: [u, v, 1 - u, 1],
    custom0: [u, v, 1 - v, 0.8],
    custom1: [v, u * 0.5, 0.3, 0.6],
    custom2: [0.2, u, v, 0.9],
    custom3: [1 - u, 0.4, v, 0.7],
    bones: [ring, segment, ring * segment, 7],
    weights: [u, v, 1 - u, 0.25],
  };
}

/** A unit sphere in Godot's arrays, clockwise from outside. Without tangents, Godot makes them up. */
function sphere(hasTangents, hasCustomArrays = false) {
  const corners = [];
  for (let ring = 0; ring < RINGS; ring++)
    for (let segment = 0; segment < SEGMENTS; segment++) {
      const a = spherePoint(ring, segment);
      const b = spherePoint(ring + 1, segment);
      const c = spherePoint(ring + 1, segment + 1);
      const d = spherePoint(ring, segment + 1);
      if (ring > 0) corners.push(a, d, b);
      if (ring < RINGS - 1) corners.push(b, d, c);
    }
  const each = (key) => corners.map((corner) => corner[key]);
  return {
    positions: each('position'),
    normals: each('normal'),
    ...(hasTangents ? { tangents: each('tangent') } : {}),
    uvs: each('uv'),
    uv2s: each('uv2'),
    colors: each('color'),
    ...(hasCustomArrays
      ? {
          custom0s: each('custom0'),
          custom1s: each('custom1'),
          custom2s: each('custom2'),
          custom3s: each('custom3'),
          bones: each('bones'),
          weights: each('weights'),
        }
      : {}),
  };
}

const SPHERE = sphere(true);
const SPHERE_NO_TANGENTS = sphere(false);
const SPHERE_CUSTOM = sphere(true, true);

/** A camera that sees the unit sphere whole, turned so the normals of each side show. */
const SPHERE_VIEW = { fov: 60, rotation: [-20, 25, 0], position: [1.2, 1.1, 2.4] };

/** One scene of the default shader on the quad, with `object` and `camera`. */
const quadScene = (name, object, camera = BACK, size = SIZE) => ({
  name,
  ...size,
  source: DEFAULT_SPATIAL_UNSHADED,
  camera,
  mesh: QUAD,
  object,
  rows: DEFAULT_ROWS,
});

/** One scene of an attribute shown as colour on the sphere. */
const attributeScene = (name, builtIn, value, mesh = SPHERE) => ({
  name,
  ...SIZE,
  source: showing(value),
  camera: SPHERE_VIEW,
  mesh,
  object: STILL,
  rows: attributeRows(builtIn),
});

/** A scene of a varying on the sphere: its declaration, what `vertex()` writes, what `fragment()` shows. */
const varyingScene = (name, declaration, vertex, fragment, rows) => ({
  name,
  ...SIZE,
  source: `shader_type spatial;
render_mode unshaded;
${declaration}

void vertex() {
	${vertex}
}

void fragment() {
	${fragment}
}
`,
  camera: SPHERE_VIEW,
  mesh: SPHERE,
  object: STILL,
  rows: ['spatial render_mode unshaded', 'spatial.fragment.ALBEDO', 'varying', ...rows],
});

const TURNED_ROTATION = [20, 35, -10];

/** The sphere moved, turned and scaled apart, so each lane of the object's matrices shows. */
const SPHERE_MOVED = { position: [0.3, -0.2, -0.5], rotation: TURNED_ROTATION, scale: [1.1, 0.8, 1] };

/** An unshaded shader on the moved sphere: `vertex()` and `fragment()` as given, with its rows. */
const stageScene = (name, { declaration = '', vertex = '', fragment }, rows, mesh = SPHERE) => ({
  name,
  ...SIZE,
  source: `shader_type spatial;
render_mode unshaded;
${declaration}

void vertex() {
	${vertex}
}

void fragment() {
	${fragment}
}
`,
  camera: SPHERE_VIEW,
  mesh,
  object: SPHERE_MOVED,
  rows: ['spatial render_mode unshaded', 'spatial.fragment.ALBEDO', ...rows],
});

/** A scene of `value`, a `vec3` that `vertex()` works out and `fragment()` shows through a varying. */
const vertexValueScene = (name, value, builtIns, mesh = SPHERE) =>
  stageScene(
    name,
    { declaration: 'varying vec3 shown;', vertex: `shown = ${value};`, fragment: 'ALBEDO = shown;' },
    ['varying', ...builtIns.map((builtIn) => `spatial.vertex.${builtIn}`)],
    mesh
  );

/** A scene of `value`, a `vec3` that `fragment()` works out and shows. */
const fragmentValueScene = (name, value, builtIns) =>
  stageScene(
    name,
    { fragment: `ALBEDO = ${value};` },
    builtIns.map((builtIn) => `spatial.fragment.${builtIn}`)
  );

/** A viewport wider than high, so a swap of the size's lanes shows. */
const WIDE = { width: 96, height: 48 };

/** A point off every axis, so each column of a matrix weighs into each lane of a product. */
const PROBE = 'vec4(0.3, -0.2, 0.5, 1.0)';

/** Each lane of a clip-space product, x and y summed so all four fit a colour. */
const clipLanes = (product) => `vec3(${product}.x + ${product}.y, ${product}.z, ${product}.w) * 0.3 + 0.5`;

/** The built-ins both stages read: the name of their scenes, the rows, and a `vec3` that shows them. */
const STAGE_VALUES = [
  ['model-matrix', ['MODEL_MATRIX'], `(MODEL_MATRIX * ${PROBE}).xyz * 0.3 + 0.5`],
  ['model-normal-matrix', ['MODEL_NORMAL_MATRIX'], `(MODEL_NORMAL_MATRIX * ${PROBE}.xyz) * 0.5 + 0.5`],
  ['view-matrix', ['VIEW_MATRIX'], `(VIEW_MATRIX * ${PROBE}).xyz * 0.15 + 0.5`],
  ['inv-view-matrix', ['INV_VIEW_MATRIX'], `(INV_VIEW_MATRIX * ${PROBE}).xyz * 0.2 + 0.4`],
  [
    'inv-projection-matrix',
    ['INV_PROJECTION_MATRIX'],
    `(INV_PROJECTION_MATRIX * ${PROBE}).xyw * vec3(0.3, 0.3, 0.03) + vec3(0.5, 0.5, 0.5)`,
  ],
  ['viewport-size', ['VIEWPORT_SIZE'], 'vec3(VIEWPORT_SIZE / vec2(128.0, 96.0), 0.5)'],
  ['node-position-world', ['NODE_POSITION_WORLD'], 'NODE_POSITION_WORLD * 0.5 + 0.5'],
  ['camera-position-world', ['CAMERA_POSITION_WORLD'], 'CAMERA_POSITION_WORLD * 0.2 + 0.5'],
  ['camera-direction-world', ['CAMERA_DIRECTION_WORLD'], 'CAMERA_DIRECTION_WORLD * 0.5 + 0.5'],
  ['node-position-view', ['NODE_POSITION_VIEW'], 'NODE_POSITION_VIEW * 0.12 + 0.5'],
  [
    'camera-visible-layers',
    ['CAMERA_VISIBLE_LAYERS'],
    'vec3(float(CAMERA_VISIBLE_LAYERS & 0xffu) / 510.0, float(CAMERA_VISIBLE_LAYERS >> 16u) / 30.0, 0.2)',
  ],
  [
    'views',
    ['VIEW_INDEX', 'VIEW_MONO_LEFT', 'VIEW_RIGHT', 'EYE_OFFSET'],
    'vec3(float(VIEW_INDEX) + 0.25, float(VIEW_MONO_LEFT) + 0.5, float(VIEW_RIGHT) * 0.75) + EYE_OFFSET',
  ],
];

/** Each value of `STAGE_VALUES` once in `vertex()` and once in `fragment()`. */
const STAGE_VALUE_SCENES = STAGE_VALUES.flatMap(([name, builtIns, value]) =>
  [
    vertexValueScene(`spatial-vertex-${name}`, value, builtIns),
    fragmentValueScene(`spatial-fragment-${name}`, value, builtIns),
  ].map((scene) => (name === 'viewport-size' ? { ...scene, ...WIDE } : scene))
);

/** The built-ins only `vertex()` has, and the vertex-stage writes. */
const VERTEX_SCENES = [
  vertexValueScene('spatial-vertex-vertex', 'VERTEX * 0.5 + 0.5', ['VERTEX']),
  stageScene(
    'spatial-vertex-vertex-write',
    { vertex: 'VERTEX *= vec3(0.6, 1.0, 1.2);', fragment: 'ALBEDO = NORMAL * 0.5 + 0.5;' },
    ['spatial.vertex.VERTEX', 'spatial.fragment.NORMAL']
  ),
  stageScene(
    'spatial-vertex-position',
    {
      vertex: 'POSITION = PROJECTION_MATRIX * MODELVIEW_MATRIX * vec4(VERTEX * 0.8, 1.0);',
      fragment: 'ALBEDO = vec3(UV, 0.5);',
    },
    [
      'spatial.vertex.POSITION',
      'spatial.vertex.PROJECTION_MATRIX',
      'spatial.vertex.MODELVIEW_MATRIX',
      'spatial.fragment.UV',
    ]
  ),
  vertexValueScene('spatial-vertex-modelview-normal', 'MODELVIEW_NORMAL_MATRIX * NORMAL * 0.5 + 0.5', [
    'MODELVIEW_NORMAL_MATRIX',
    'NORMAL',
  ]),
  vertexValueScene('spatial-vertex-projection-matrix', clipLanes(`(PROJECTION_MATRIX * ${PROBE})`), [
    'PROJECTION_MATRIX',
  ]),
  vertexValueScene('spatial-vertex-main-camera', `(MAIN_CAM_INV_VIEW_MATRIX * ${PROBE}).xyz * 0.2 + 0.4`, [
    'MAIN_CAM_INV_VIEW_MATRIX',
  ]),
  stageScene(
    'spatial-vertex-color',
    { vertex: 'COLOR.rgb = COLOR.bgr * 0.8;', fragment: 'ALBEDO = COLOR.rgb;' },
    ['spatial.vertex.COLOR', 'spatial.fragment.COLOR']
  ),
  stageScene(
    'spatial-vertex-ids',
    {
      declaration: 'varying vec3 shown;',
      vertex: 'shown = vec3(fract(float(VERTEX_ID) / 7.0), float(INSTANCE_ID) + 0.25, 0.5);',
      fragment: 'ALBEDO = shown;',
    },
    ['varying', 'spatial.vertex.VERTEX_ID', 'spatial.vertex.INSTANCE_ID']
  ),
  vertexValueScene('spatial-vertex-instance-custom', 'INSTANCE_CUSTOM.rgb + 0.25', ['INSTANCE_CUSTOM']),
  ...[0, 1, 2, 3].map((custom) =>
    vertexValueScene(
      `spatial-vertex-custom${custom}`,
      `CUSTOM${custom}.rgb * CUSTOM${custom}.a`,
      [`CUSTOM${custom}`],
      SPHERE_CUSTOM
    )
  ),
  stageScene(
    'spatial-color-missing',
    { fragment: 'ALBEDO = COLOR.rgb * 0.7 + vec3(UV, 0.0) * 0.2;' },
    ['spatial.fragment.COLOR', 'spatial.fragment.UV'],
    { positions: SPHERE.positions, normals: SPHERE.normals }
  ),
  vertexValueScene('spatial-vertex-custom-missing', 'CUSTOM0.rgb * 0.5 + CUSTOM0.a * 0.25', ['CUSTOM0']),
  vertexValueScene(
    'spatial-vertex-bone-indices',
    'vec3(BONE_INDICES.xyz % uvec3(8u)) / 8.0 + float(BONE_INDICES.w) * 0.02',
    ['BONE_INDICES'],
    SPHERE_CUSTOM
  ),
  vertexValueScene(
    'spatial-vertex-bone-weights',
    'BONE_WEIGHTS.rgb + BONE_WEIGHTS.a * 0.4',
    ['BONE_WEIGHTS'],
    SPHERE_CUSTOM
  ),
  {
    ...stageScene(
      'spatial-vertex-z-clip-scale',
      { vertex: 'Z_CLIP_SCALE = 0.05;', fragment: 'ALBEDO = vec3(0.9, 0.3, 0.1);' },
      ['spatial.vertex.Z_CLIP_SCALE']
    ),
    others: [
      {
        object: { position: [0.1, 0, 0.6], rotation: [0, 0, 0], scale: [0.6, 0.6, 0.6] },
        source: showing('vec3(0.2, 0.4, 0.8)'),
      },
    ],
  },
];

/** The built-ins only `fragment()` has. */
const FRAGMENT_SCENES = [
  fragmentValueScene('spatial-fragment-vertex', 'VERTEX * 0.15 + 0.6', ['VERTEX']),
  stageScene(
    'spatial-fragment-light-vertex',
    { fragment: 'LIGHT_VERTEX = VERTEX * 0.5;\n\tALBEDO = LIGHT_VERTEX * 0.3 + 0.6;' },
    ['spatial.fragment.LIGHT_VERTEX']
  ),
  fragmentValueScene('spatial-fragment-fragcoord', 'vec3(FRAGCOORD.xy / 64.0, FRAGCOORD.z)', ['FRAGCOORD']),
  fragmentValueScene(
    'spatial-fragment-front-facing',
    'FRONT_FACING ? vec3(0.2, 0.7, 0.3) : vec3(0.8, 0.1, 0.1)',
    ['FRONT_FACING']
  ),
  fragmentValueScene('spatial-fragment-view', 'VIEW * 0.5 + 0.5', ['VIEW']),
  fragmentValueScene('spatial-fragment-screen-uv', 'vec3(SCREEN_UV, 0.5)', ['SCREEN_UV']),
  fragmentValueScene('spatial-fragment-projection-matrix', clipLanes(`(PROJECTION_MATRIX * ${PROBE})`), [
    'PROJECTION_MATRIX',
  ]),
];

/** The global built-ins and the constants, which every stage reads. */
const GLOBAL_SCENES = [
  stageScene(
    'spatial-constants',
    {
      fragment:
        'ALBEDO = vec3(PI / 4.0, TAU / 8.0 - 0.3, E / 3.0) * 0.8 + vec3(OUTPUT_IS_SRGB ? 0.1 : 0.0, CLIP_SPACE_FAR * 0.5 + 0.1, IS_MULTIVIEW ? 0.1 : 0.0);',
    },
    ['PI', 'TAU', 'E', 'OUTPUT_IS_SRGB', 'CLIP_SPACE_FAR', 'IS_MULTIVIEW'].map(
      (name) => `spatial.constants.${name}`
    )
  ),
  ...[
    ['spatial-time-fraction', { fixedFps: 3, rolloverSeconds: 3600 }],
    ['spatial-time-rolled-over', { fixedFps: 3, rolloverSeconds: 1.2 }],
  ].map(([name, clock]) => ({
    ...stageScene(
      name,
      {
        declaration: 'varying float early;',
        vertex: 'early = TIME;',
        fragment: 'ALBEDO = vec3(fract(early), TIME * 0.2, 0.5);',
      },
      ['varying', 'spatial.global.TIME']
    ),
    clock: { ...clock, frames: FRAMES_BEFORE_READ },
  })),
  stageScene(
    'spatial-exposure',
    { fragment: 'ALBEDO = vec3(EXPOSURE * 0.5, IN_SHADOW_PASS ? 0.9 : 0.1, 0.4);' },
    ['spatial.global.EXPOSURE', 'spatial.global.IN_SHADOW_PASS']
  ),
];

/** The rows of a render mode scene: unshaded, `ALBEDO`, and each mode. */
const modeRows = (modes, rows = []) => [
  'spatial render_mode unshaded',
  'spatial.fragment.ALBEDO',
  ...modes.map((mode) => `spatial render_mode ${mode}`),
  ...rows,
];

/** Front faces show their UV, back faces a red of their own, so a culled side shows as missing. */
const SIDES = 'ALBEDO = FRONT_FACING ? vec3(UV, 0.3) : vec3(0.9, 0.3, UV.y);';

/** A render mode scene: one quad under `modes` showing `fragment()`, seen from the back camera. */
const modeScene = (name, modes, fragment, placement, rows) => ({
  name,
  ...SIZE,
  source: withModes(modes, fragment),
  camera: BACK,
  mesh: QUAD,
  ...placement,
  rows: modeRows(modes, rows),
});

/** A quad that faces the camera, on the left, and one turned away from it, on the right. */
const facingAndTurned = (scale) => ({
  object: { position: [-0.45, 0, 0], rotation: [0, 20, 0], scale },
  others: [{ object: { position: [0.45, 0, 0], rotation: [0, 160, 0], scale } }],
});

/** A cull mode scene: the two quads, `fragment()` shown on each face, with the scale `scale`. */
const cullScene = (name, modes, fragment = SIDES, scale = [0.8, 0.8, 0.8], rows = []) =>
  modeScene(name, modes, fragment, facingAndTurned(scale), [
    'spatial.fragment.FRONT_FACING',
    'spatial.fragment.UV',
    ...rows,
  ]);

/** An opaque quad in front, at the lower right, that the scene's own quad meets. */
const ORANGE_IN_FRONT = {
  object: { position: [0.25, -0.2, 0.4], rotation: [0, 0, 0], scale: [0.7, 0.7, 0.7] },
  source: showing('vec3(0.9, 0.3, 0.1)'),
};

/** A depth test scene: the scene's quad, behind the orange quad. */
const depthTestScene = (name, modes) =>
  modeScene(
    name,
    modes,
    'ALBEDO = vec3(0.2, 0.5, UV.y);',
    {
      object: { position: [-0.1, 0.1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      others: [ORANGE_IN_FRONT],
    },
    ['spatial.fragment.UV']
  );

/** Two crossing quads: the alpha pass draws the far one first, so its depth write cuts the near one. */
const crossingScene = (name, modes) =>
  modeScene(
    name,
    modes,
    'ALBEDO = vec3(0.1, UV.x * 0.5, 0.6);',
    {
      object: { position: [-0.15, 0, 0.1], rotation: [0, 45, 0], scale: [1.2, 0.8, 1] },
      others: [
        {
          object: { position: [0.15, 0, -0.2], rotation: [0, -45, 0], scale: [1.2, 0.8, 1] },
          source: withModes(modes, 'ALBEDO = vec3(0.6, 0.2, UV.y * 0.5);'),
        },
      ],
    },
    ['spatial.fragment.UV']
  );

/** A blend scene: the scene's quad over the orange quad and the clear colour, each blended in. */
const blendScene = (name, modes) =>
  modeScene(
    name,
    modes,
    'ALBEDO = vec3(UV * 0.4, 0.3);',
    {
      object: { position: [-0.1, 0.1, 0.5], rotation: [0, 0, 0], scale: [1, 1, 1] },
      others: [{ ...ORANGE_IN_FRONT, object: { ...ORANGE_IN_FRONT.object, position: [0.25, -0.2, 0] } }],
    },
    ['spatial.fragment.UV']
  );

/** A shader that moves the sphere in `vertex()` under `modes`, and shows its normal. */
const vertexSpaceScene = (name, modes, vertex, rows) => ({
  name,
  ...SIZE,
  source: `${unshadedHead(modes)}
void vertex() {
	${vertex}
}

void fragment() {
	ALBEDO = NORMAL * 0.5 + 0.5;
}
`,
  camera: SPHERE_VIEW,
  mesh: SPHERE,
  object: SPHERE_MOVED,
  rows: modeRows(modes, ['spatial.fragment.NORMAL', ...rows]),
});

/** Each render mode the pipeline or a template define reads, against Godot. */
const RENDER_MODE_SCENES = [
  cullScene('spatial-cull-back', ['cull_back']),
  cullScene('spatial-cull-front', ['cull_front']),
  cullScene('spatial-cull-disabled', ['cull_disabled']),
  cullScene('spatial-cull-front-mirrored', ['cull_front'], SIDES, [-0.8, 0.8, 0.8]),
  cullScene('spatial-cull-disabled-normal', ['cull_disabled'], 'ALBEDO = NORMAL * 0.5 + 0.5;', undefined, [
    'spatial.fragment.NORMAL',
  ]),
  depthTestScene('spatial-depth-test-default', ['depth_test_default']),
  depthTestScene('spatial-depth-test-disabled', ['depth_test_disabled']),
  depthTestScene('spatial-depth-test-inverted', ['depth_test_inverted']),
  crossingScene('spatial-depth-draw-opaque', ['depth_draw_opaque']),
  crossingScene('spatial-depth-draw-always', ['blend_add', 'depth_draw_always']),
  crossingScene('spatial-depth-draw-opaque-alpha-pass', ['blend_add', 'depth_draw_opaque']),
  crossingScene('spatial-depth-draw-never', ['depth_draw_never']),
  ...['blend_mix', 'blend_add', 'blend_sub', 'blend_mul', 'blend_premul_alpha'].map((mode) =>
    blendScene(`spatial-${mode.replaceAll('_', '-')}`, [mode])
  ),
  vertexSpaceScene(
    'spatial-skip-vertex-transform',
    ['skip_vertex_transform'],
    'VERTEX = (MODELVIEW_MATRIX * vec4(VERTEX * vec3(1.0, 0.7, 1.0), 1.0)).xyz;\n\tNORMAL = normalize(MODELVIEW_NORMAL_MATRIX * NORMAL);',
    [
      'spatial.vertex.VERTEX',
      'spatial.vertex.NORMAL',
      'spatial.vertex.MODELVIEW_MATRIX',
      'spatial.vertex.MODELVIEW_NORMAL_MATRIX',
    ]
  ),
  vertexSpaceScene(
    'spatial-world-vertex-coords',
    ['world_vertex_coords'],
    'VERTEX.y += 0.4 * VERTEX.x;\n\tNORMAL = normalize(NORMAL + vec3(0.0, 0.3, 0.0));',
    ['spatial.vertex.VERTEX', 'spatial.vertex.NORMAL']
  ),
  vertexSpaceScene('spatial-ensure-correct-normals', ['ensure_correct_normals'], '', []),
];

/** A quad at half size, at `position` and turned by `rotation`. */
const SMALL_AT = (position, rotation) => ({ position, rotation, scale: [0.5, 0.5, 0.5] });

/** A second unshaded material, so the objects of two materials draw in turn. */
const ORANGE = showing('vec3(0.9, 0.3, 0.1)');

export const MESH_SCENES = [
  {
    name: 'spatial-default-unshaded',
    ...SIZE,
    source: DEFAULT_SPATIAL_UNSHADED,
    camera: BACK,
    mesh: QUAD,
    object: STILL,
    rows: DEFAULT_ROWS,
  },
  {
    name: 'spatial-unshaded-moved',
    ...SIZE,
    source: DEFAULT_SPATIAL_UNSHADED,
    camera: TURNED,
    mesh: QUAD,
    object: MOVED,
    rows: DEFAULT_ROWS,
  },
  quadScene('spatial-mirrored-x', { position: [0, 0, 0], rotation: TURNED_ROTATION, scale: [-1.3, 0.8, 1] }),
  quadScene('spatial-mirrored-xyz', {
    position: [0, 0, 0],
    rotation: [20, 215, -10],
    scale: [-1.3, -0.8, -1],
  }),
  quadScene('spatial-uniform-scale', {
    position: [0.1, 0.1, 0],
    rotation: TURNED_ROTATION,
    scale: [1.6, 1.6, 1.6],
  }),
  quadScene(
    'spatial-far-translation',
    { position: [5000.25, -3000.5, -2], rotation: [0, 15, 0], scale: [1, 1, 1] },
    { fov: 75, rotation: [0, 0, 0], position: [5000, -3000.5, 0.5] }
  ),
  {
    ...quadScene('spatial-parent', { position: [0.2, 0, 0], rotation: [0, 0, 30], scale: [1, 1.5, 1] }),
    parent: { position: [-0.3, 0.2, -0.4], rotation: [0, 40, 0], scale: [0.8, 0.8, 0.8] },
  },
  {
    ...quadScene('spatial-shared-material', SMALL_AT([-0.8, 0.5, 0], [0, 0, 15])),
    others: [
      { object: SMALL_AT([0, 0.5, -0.3], [20, 0, 0]), source: ORANGE },
      { object: SMALL_AT([0.8, 0.5, 0], [0, 30, 0]) },
      { object: SMALL_AT([-0.4, -0.5, 0.2], [0, 0, -40]), source: ORANGE },
      { object: SMALL_AT([0.4, -0.5, -0.1], [-25, 10, 5]) },
    ],
  },
  quadScene('spatial-fov-narrow', MOVED, { ...TURNED, fov: 30 }),
  quadScene('spatial-fov-wide', MOVED, { ...TURNED, fov: 110 }),
  quadScene('spatial-orthogonal', MOVED, { ...TURNED, projection: 'orthogonal', size: 1.8 }),
  quadScene('spatial-frustum', MOVED, {
    ...TURNED,
    projection: 'frustum',
    size: 0.2,
    offset: [0.05, -0.03],
    near: 0.2,
  }),
  quadScene('spatial-near-far', MOVED, { ...TURNED, near: 1.5, far: 2.6 }),
  quadScene('spatial-wide-viewport', MOVED, TURNED, { ...SIZE, width: 96, height: 48 }),
  attributeScene('spatial-normal', 'NORMAL', 'NORMAL * 0.5 + 0.5'),
  attributeScene('spatial-tangent', 'TANGENT', 'TANGENT * 0.5 + 0.5'),
  attributeScene('spatial-binormal', 'BINORMAL', 'BINORMAL * 0.5 + 0.5'),
  attributeScene('spatial-tangent-made-up', 'TANGENT', 'TANGENT * 0.5 + 0.5', SPHERE_NO_TANGENTS),
  attributeScene('spatial-binormal-made-up', 'BINORMAL', 'BINORMAL * 0.5 + 0.5', SPHERE_NO_TANGENTS),
  attributeScene('spatial-uv', 'UV', 'vec3(UV, 0.0)'),
  attributeScene('spatial-uv2', 'UV2', 'vec3(UV2, 0.0)'),
  attributeScene('spatial-color', 'COLOR', 'COLOR.rgb'),
  { ...attributeScene('spatial-compressed', 'NORMAL', 'NORMAL * 0.5 + 0.5'), compressed: true },
  varyingScene('spatial-varying-smooth', 'varying vec3 v;', 'v = NORMAL * 0.5 + 0.5;', 'ALBEDO = v;', [
    'smooth',
    'spatial.vertex.NORMAL',
  ]),
  varyingScene('spatial-varying-flat', 'varying flat vec3 v;', 'v = NORMAL * 0.5 + 0.5;', 'ALBEDO = v;', [
    'flat',
    'spatial.vertex.NORMAL',
  ]),
  varyingScene(
    'spatial-varying-int',
    'varying flat int band;',
    'band = int(UV.y * 6.0);',
    'ALBEDO = vec3(float(band) / 6.0);',
    ['flat', 'spatial.vertex.UV']
  ),
  varyingScene(
    'spatial-varying-matrix',
    'varying mat3 frame;',
    'frame = mat3(TANGENT, BINORMAL, NORMAL);',
    'ALBEDO = frame[0] * 0.5 + 0.5;',
    ['spatial.vertex.TANGENT', 'spatial.vertex.BINORMAL', 'spatial.vertex.NORMAL']
  ),
  varyingScene(
    'spatial-varying-array',
    'varying vec2 pair[2];',
    'pair[0] = UV; pair[1] = UV2;',
    'ALBEDO = vec3(pair[0], pair[1].x);',
    ['NODE_TYPE_ARRAY', 'spatial.vertex.UV', 'spatial.vertex.UV2']
  ),
  varyingScene(
    'spatial-varying-array-computed',
    'varying float bands[12];',
    'for (int i = 0; i < 12; i++) { bands[i] = fract(UV.x * float(i + 1)); }',
    'ALBEDO = vec3(bands[int(UV.y * 11.99)], bands[11], bands[int(UV.x * 5.0)]);',
    ['NODE_TYPE_ARRAY', 'spatial.vertex.UV', 'spatial.fragment.UV']
  ),
  varyingScene(
    'spatial-varying-fragment',
    'varying vec3 tint;',
    '',
    'tint = vec3(0.8, 0.4, 0.2); ALBEDO = tint * UV.x;',
    []
  ),
  ...STAGE_VALUE_SCENES,
  ...VERTEX_SCENES,
  ...FRAGMENT_SCENES,
  ...GLOBAL_SCENES,
  ...RENDER_MODE_SCENES,
];

/** Scenes whose program the GPU refuses: each must reach the material as a fault with this log. */
export const FAULT_SCENES = [
  {
    ...stageScene('spatial-fault-broken-fragment', { fragment: 'ALBEDO = vec3(0.5);' }, []),
    // Every shader Godot accepts links in the test Chromium, so the page breaks the GLSL itself.
    breaksFragment: true,
    log: /undeclared_in_glsl/,
  },
];
