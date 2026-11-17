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
];
