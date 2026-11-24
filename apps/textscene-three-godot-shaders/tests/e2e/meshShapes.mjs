/** The size of a scene's image, and the guide chapter that shows it. */
export const SIZE = { width: 64, height: 64, chapter: 'spatial.md' };

/** A camera two units back from the origin, looking along -Z, with Godot's default field of view. */
export const BACK = { fov: 75, rotation: [0, 0, 0], position: [0, 0, 2] };

/** A quad facing +Z as Godot's arrays hold it: two triangles of clockwise front faces, a normal a corner. */
export const QUAD = {
  positions: [
    [-0.5, -0.5, 0],
    [-0.5, 0.5, 0],
    [0.5, 0.5, 0],
    [-0.5, -0.5, 0],
    [0.5, 0.5, 0],
    [0.5, -0.5, 0],
  ],
  normals: Array.from({ length: 6 }, () => [0, 0, 1]),
  // Godot's QuadMesh UV: (0, 0) at the top left, v down.
  uvs: [
    [0, 1],
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
};

export const STILL = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };

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

export const SPHERE = sphere(true);
export const SPHERE_NO_TANGENTS = sphere(false);
export const SPHERE_CUSTOM = sphere(true, true);

/** A camera that sees the unit sphere whole, turned so the normals of each side show. */
export const SPHERE_VIEW = { fov: 60, rotation: [-20, 25, 0], position: [1.2, 1.1, 2.4] };
