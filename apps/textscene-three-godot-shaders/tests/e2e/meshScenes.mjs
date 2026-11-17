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

/** An unshaded shader that shows `value`, a `vec3` of the fragment stage, as its colour. */
const showing = (value) => `shader_type spatial;
render_mode unshaded;

void fragment() {
	ALBEDO = ${value};
}
`;

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
  };
}

/** A unit sphere in Godot's arrays, clockwise from outside. Without tangents, Godot makes them up. */
function sphere(hasTangents) {
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
  };
}

const SPHERE = sphere(true);
const SPHERE_NO_TANGENTS = sphere(false);

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
    'spatial-varying-fragment',
    'varying vec3 tint;',
    '',
    'tint = vec3(0.8, 0.4, 0.2); ALBEDO = tint * UV.x;',
    []
  ),
];
