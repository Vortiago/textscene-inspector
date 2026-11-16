import type { Aabb } from '../../math/aabb.js';
import { degToRad, radToDegf } from '../../math/math.js';
import { normalizedPlane, type Plane } from '../../math/plane.js';
import { getFovy } from '../../math/projection.js';
import { atan2Real } from '../../math/realAtan2.js';
import { cosf, sinf } from '../../math/realMath.js';
import type { Rect2 } from '../../math/rect2.js';
import type { Vector2 } from '../../math/vector.js';
import { doubleToInt32 } from '../cInteger.js';
import { multiplyProjection } from '../operators/matrices.js';
import { numberAt, valueAt, type CastArgument } from '../utility/utilityArguments.js';
import { MATH_LAYOUT } from '../value/mathLayout.js';
import { real, variant, type ProjectionValue, type Variant } from '../value/variant.js';
import { methodPort, type MethodParameter, type MethodPort, portOn } from './methodPort.js';

const f = Math.fround;

/** The sixteen components column by column, as `(real_t *)columns` reads them. */
type Matrix = number[];

const IDENTITY: readonly number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const { flat: matrixOf, fromFlat: projectionValue } = MATH_LAYOUT.PROJECTION;

const projectionOf = (m: readonly number[]): Variant => variant('PROJECTION', projectionValue(m));

const port = portOn((base) => matrixOf(base.value as ProjectionValue));

const create = (parameters: readonly MethodParameter[], body: (args: readonly CastArgument[]) => Matrix) =>
  methodPort(parameters, (_base, args) => projectionOf(body(args)));

// projection.cpp:39: each term the product of one component of each column, the signs in Godot's order.
const DETERMINANT_TERMS = [
  '+3210',
  '-2310',
  '-3120',
  '+1320',
  '+2130',
  '-1230',
  '-3201',
  '+2301',
  '+3021',
  '-0321',
  '-2031',
  '+0231',
  '+3102',
  '-1302',
  '-3012',
  '+0312',
  '+1032',
  '-0132',
  '-2103',
  '+1203',
  '+2013',
  '-0213',
  '-1023',
  '+0123',
].map((term) => ({
  isSubtracted: term[0] === '-',
  rows: [...term.slice(1)].map(Number) as [number, number, number, number],
}));

function determinant(m: Matrix): number {
  return DETERMINANT_TERMS.reduce((sum, { isSubtracted, rows: [a, b, c, d] }, index) => {
    const product = f(f(f(m[a]! * m[4 + b]!) * m[8 + c]!) * m[12 + d]!);
    if (index === 0) return product;
    return isSubtracted ? f(sum - product) : f(sum + product);
  }, 0);
}

const zFar = (m: Matrix) => f(f(m[15]! - m[14]!) / f(m[11]! - m[10]!));
const zNear = (m: Matrix) => f(f(m[15]! + m[14]!) / f(m[11]! + m[10]!));

// projection.cpp:94: `adjust_perspective_znear`.
function perspectiveZnearAdjusted(m: Matrix, znear: number): Matrix {
  const far = zFar(m);
  const deltaZ = f(far - znear);
  const adjusted = [...m];
  adjusted[10] = f(-f(far + znear) / deltaZ);
  adjusted[14] = f(f(f(-2 * znear) * far) / deltaZ);
  return adjusted;
}

// projection.cpp:190: the column each plane adds to or takes from the fourth, by `Planes` value.
const PLANE_ROWS = [
  { row: 2, sign: 1 },
  { row: 2, sign: -1 },
  { row: 0, sign: 1 },
  { row: 1, sign: -1 },
  { row: 0, sign: -1 },
  { row: 1, sign: 1 },
] as const;

function projectionPlane(m: Matrix, which: number): Plane {
  const plane = PLANE_ROWS[which];
  if (!plane) return { normal: { x: 0, y: 0, z: 0 }, d: 0 };
  const lane = (column: number) => {
    const [w, v] = [m[column * 4 + 3]!, m[column * 4 + plane.row]!];
    return plane.sign > 0 ? f(w + v) : f(w - v);
  };
  const normal = { x: -lane(0), y: -lane(1), z: -lane(2) };
  return normalizedPlane({ normal, d: lane(3) });
}

const flippedY = (m: Matrix) => m.map((value, index) => (index >= 4 && index < 8 ? -value : value));

function jitterOffseted(m: Matrix, { x, y }: Vector2): Matrix {
  const moved = [...m];
  moved[12] = f(m[12]! + x);
  moved[13] = f(m[13]! + y);
  return moved;
}

function fov(m: Matrix): number {
  if (m[8] === 0) return radToDegf(f(2 * atan2Real(1, m[0]!)));
  const right = atan2Real(f(m[8]! + 1), m[0]!);
  const left = atan2Real(f(m[8]! - 1), m[0]!);
  return radToDegf(f(right - left));
}

function halfExtents(m: Matrix, depth: number): Vector2 {
  const w = f(f(-depth * m[11]!) + m[15]!);
  return { x: f(w / m[0]!), y: f(w / m[5]!) };
}

function pixelsPerMeter(m: Matrix, pixelWidth: number): number {
  const width = f(f(2 * f(f(-zNear(m) * m[11]!) + m[15]!)) / m[0]!);
  return doubleToInt32(f(f(pixelWidth) / width));
}

/** The four rows of the Gauss-Jordan elimination, each the row of `m` and then the identity's. */
function augmentedRows(m: Matrix): Matrix[] {
  return [0, 1, 2, 3].map((row) => [
    ...[0, 1, 2, 3].map((column) => m[column * 4 + row]!),
    ...[0, 1, 2, 3].map((column) => (column === row ? 1 : 0)),
  ]);
}

/** `r[i] -= factor * from[i]` over `columns` of a row. */
function subtractScaled(row: Matrix, factor: number, from: Matrix, columns: readonly number[]): void {
  for (const column of columns) row[column] = f(row[column]! - f(factor * from[column]!));
}

// projection.cpp:640: each pivot pulls the larger magnitude up, starting from the bottom row.
function pivot(rows: Matrix[], column: number): void {
  for (let below = 3; below > column; below--) {
    if (Math.abs(rows[below]![column]!) > Math.abs(rows[below - 1]![column]!)) {
      [rows[below], rows[below - 1]] = [rows[below - 1]!, rows[below]!];
    }
  }
}

const RIGHT = [4, 5, 6, 7];

// projection.cpp:653: the first two eliminations skip a right-hand column whose pivot row holds zero.
function eliminate(rows: Matrix[], column: number): void {
  const top = rows[column]!;
  const right = column === 2 ? RIGHT : RIGHT.filter((next) => top[next] !== 0);
  const columns = [...[1, 2, 3].filter((next) => next > column), ...right];
  for (const row of rows.slice(column + 1)) subtractScaled(row, f(row[column]! / top[column]!), top, columns);
}

/** `r[i] -= lower[i] * r[column]` over the right half. */
function takeOut(row: Matrix, lower: Matrix, column: number): void {
  const factor = row[column]!;
  for (const right of RIGHT) row[right] = f(row[right]! - f(lower[right]! * factor));
}

/** `r[i] = s * (r[i] - lower[i] * r[column])` over the right half, with `s` the pivot's reciprocal. */
function solve(row: Matrix, lower: Matrix, column: number): void {
  const factor = row[column]!;
  const reciprocal = f(1 / row[column - 1]!);
  for (const right of RIGHT) row[right] = f(reciprocal * f(row[right]! - f(lower[right]! * factor)));
}

// projection.cpp:713
function backSubstitute([r0, r1, r2, r3]: Matrix[]): void {
  const reciprocal = f(1 / r3![3]!);
  for (const right of RIGHT) r3![right] = f(r3![right]! * reciprocal);
  solve(r2!, r3!, 3);
  takeOut(r1!, r3!, 3);
  takeOut(r0!, r3!, 3);
  solve(r1!, r2!, 2);
  takeOut(r0!, r2!, 2);
  solve(r0!, r1!, 1);
}

// projection.cpp:581: Mesa's `util_invert_mat4x4`. `ERR_FAIL_COND` on a zero pivot keeps `m`.
function inverse(m: Matrix): Matrix {
  const rows = augmentedRows(m);
  for (const column of [0, 1, 2]) {
    pivot(rows, column);
    if (rows[column]![column] === 0) return m;
    eliminate(rows, column);
  }
  if (rows[3]![3] === 0) return m;
  backSubstitute(rows);
  return [0, 1, 2, 3].flatMap((column) => rows.map((row) => row[4 + column]!));
}

function frustum(
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number
): Matrix {
  if (right <= left || top <= bottom || far <= near) return [...IDENTITY];
  const width = f(right - left);
  const height = f(top - bottom);
  const depth = f(far - near);
  const x = f(f(2 * near) / width);
  const y = f(f(2 * near) / height);
  const a = f(f(right + left) / width);
  const b = f(f(top + bottom) / height);
  const c = f(-f(far + near) / depth);
  const d = f(f(f(-2 * far) * near) / depth);
  return [x, 0, 0, 0, 0, y, 0, 0, a, b, c, -1, 0, 0, d, 0];
}

function orthogonal(
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number
): Matrix {
  const m = [...IDENTITY];
  m[0] = f(2 / f(right - left));
  m[12] = f(-f(f(right + left) / f(right - left)));
  m[5] = f(2 / f(top - bottom));
  m[13] = f(-f(f(top + bottom) / f(top - bottom)));
  m[10] = f(-2 / f(far - near));
  m[14] = f(-f(f(far + near) / f(far - near)));
  m[15] = 1;
  return m;
}

const flippedFovy = (fovy: number, aspect: number, isFlipped: boolean) =>
  isFlipped ? getFovy(fovy, 1 / aspect) : fovy;

// projection.cpp:251
function perspective(
  fovyDegrees: number,
  aspect: number,
  near: number,
  far: number,
  isFlipped: boolean
): Matrix {
  const radians = f(degToRad(flippedFovy(fovyDegrees, aspect, isFlipped) / 2));
  const deltaZ = f(far - near);
  const sine = sinf(radians);
  if (deltaZ === 0 || sine === 0 || aspect === 0) return [...IDENTITY];
  const cotangent = f(cosf(radians) / sine);
  return [
    f(cotangent / aspect),
    0,
    0,
    0,
    0,
    cotangent,
    0,
    0,
    0,
    0,
    f(-f(far + near) / deltaZ),
    -1,
    0,
    0,
    f(f(f(-2 * near) * far) / deltaZ),
    0,
  ];
}

// projection.cpp:276: eye 1 is the left eye, 2 the right one, any other the middle.
function perspectiveForEye(args: readonly CastArgument[]): Matrix {
  const [fovy, aspect, near, far] = [0, 1, 2, 3].map((index) => numberAt(args, index)) as [
    number,
    number,
    number,
    number,
  ];
  const [eye, intraocular, convergence] = [numberAt(args, 5), numberAt(args, 6), numberAt(args, 7)];
  const ymax = f(near * Math.tan(degToRad(flippedFovy(fovy, aspect, args[4] as boolean) / 2)));
  const xmax = f(ymax * aspect);
  const shift = f(((intraocular / 2) * near) / convergence);
  const side = eye === 1 ? 1 : eye === 2 ? -1 : 0;
  const left = side === 0 ? -xmax : f(-xmax + side * shift);
  const right = side === 0 ? xmax : f(xmax + side * shift);
  const translation = side === 0 ? 0 : f((side * intraocular) / 2);
  const moved = [...IDENTITY];
  moved[12] = translation;
  return matrixOf(
    multiplyProjection(projectionValue(frustum(left, right, -ymax, ymax, near, far)), projectionValue(moved))
  );
}

// projection.cpp:314
function forHmd(args: readonly CastArgument[]): Matrix {
  const [eye, aspect, intraocular, width, toLens, oversample, near, far] = [0, 1, 2, 3, 4, 5, 6, 7].map(
    (index) => numberAt(args, index)
  ) as [number, number, number, number, number, number, number, number];
  if (eye !== 1 && eye !== 2) return [...IDENTITY];
  const inner = f((intraocular * 0.5) / toLens);
  const outer = f((f(width - intraocular) * 0.5) / toLens);
  const added = f((f(inner + outer) * (oversample - 1)) / 2);
  const [f1, f2] = [f(inner + added), f(outer + added)];
  const f3 = f(f(f(width / 4 / toLens) * oversample) / aspect);
  const [left, right] = eye === 1 ? [f2, f1] : [f1, f2];
  return frustum(f(-left * near), f(right * near), f(-f3 * near), f(f3 * near), near, far);
}

function fitAabb({ position, size }: Aabb): Matrix {
  const max = { x: f(position.x + size.x), y: f(position.y + size.y), z: f(position.z + size.z) };
  const scale = (lane: 'x' | 'y' | 'z') => f(2 / f(max[lane] - position[lane]));
  const offset = (lane: 'x' | 'y' | 'z') => f(-f(max[lane] + position[lane]) / f(max[lane] - position[lane]));
  return [
    scale('x'),
    0,
    0,
    0,
    0,
    scale('y'),
    0,
    0,
    0,
    0,
    scale('z'),
    0,
    offset('x'),
    offset('y'),
    offset('z'),
    1,
  ];
}

function orthogonalAspect(args: readonly CastArgument[]): Matrix {
  const [size, aspect, near, far] = [0, 1, 2, 3].map((index) => numberAt(args, index)) as [
    number,
    number,
    number,
    number,
  ];
  const width = (args[4] as boolean) ? size : f(size * aspect);
  return orthogonal(
    f(-width / 2),
    f(width / 2),
    f(f(-width / aspect) / 2),
    f(f(width / aspect) / 2),
    near,
    far
  );
}

function frustumAspect(args: readonly CastArgument[]): Matrix {
  const [size, aspect] = [numberAt(args, 0), numberAt(args, 1)];
  const offset = valueAt<Vector2>(args, 2);
  const width = (args[5] as boolean) ? size : f(size * aspect);
  return frustum(
    f(f(-width / 2) + offset.x),
    f(f(width / 2) + offset.x),
    f(f(f(-width / aspect) / 2) + offset.y),
    f(f(f(width / aspect) / 2) + offset.y),
    numberAt(args, 3),
    numberAt(args, 4)
  );
}

const depthCorrection = (isFlipped: boolean): Matrix => [
  1,
  0,
  0,
  0,
  0,
  isFlipped ? -1 : 1,
  0,
  0,
  0,
  0,
  -0.5,
  0,
  0,
  0,
  0.5,
  1,
];

function lightAtlasRect({ x, y, w, h }: Rect2): Matrix {
  return [w, 0, 0, 0, 0, h, 0, 0, 0, 0, 1, 0, x, y, 0, 1];
}

const FLOATS_6 = ['float', 'float', 'float', 'float', 'float', 'float'] as const;
const sixFloats = (args: readonly CastArgument[]) =>
  [0, 1, 2, 3, 4, 5].map((index) => numberAt(args, index)) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];

export const PROJECTION_METHODS: Readonly<Record<string, MethodPort>> = {
  create_depth_correction: create(['bool'], (args) => depthCorrection(args[0] as boolean)),
  create_light_atlas_rect: create(['RECT2'], (args) => lightAtlasRect(valueAt<Rect2>(args, 0))),
  create_perspective: create(['float', 'float', 'float', 'float', 'bool'], (args) =>
    perspective(
      numberAt(args, 0),
      numberAt(args, 1),
      numberAt(args, 2),
      numberAt(args, 3),
      args[4] as boolean
    )
  ),
  create_perspective_hmd: create(
    ['float', 'float', 'float', 'float', 'bool', 'int32_t', 'float', 'float'],
    perspectiveForEye
  ),
  create_for_hmd: create(['int32_t', ...FLOATS_6, 'float'], forHmd),
  create_orthogonal: create(FLOATS_6, (args) => orthogonal(...sixFloats(args))),
  create_orthogonal_aspect: create(['float', 'float', 'float', 'float', 'bool'], orthogonalAspect),
  create_frustum: create(FLOATS_6, (args) => frustum(...sixFloats(args))),
  create_frustum_aspect: create(['float', 'float', 'VECTOR2', 'float', 'float', 'bool'], frustumAspect),
  create_fit_aabb: create(['AABB'], (args) => fitAabb(valueAt<Aabb>(args, 0))),
  determinant: port([], (m) => real(determinant(m))),
  perspective_znear_adjusted: port(['float'], (m, args) =>
    projectionOf(perspectiveZnearAdjusted(m, numberAt(args, 0)))
  ),
  get_projection_plane: port(['Projection::Planes'], (m, args) =>
    variant('PLANE', projectionPlane(m, numberAt(args, 0)))
  ),
  flipped_y: port([], (m) => projectionOf(flippedY(m))),
  jitter_offseted: port(['VECTOR2'], (m, args) => projectionOf(jitterOffseted(m, valueAt<Vector2>(args, 0)))),
  get_fovy: methodPort(['float', 'float'], (_base, args) =>
    real(getFovy(numberAt(args, 0), numberAt(args, 1)))
  ),
  get_z_far: port([], (m) => real(zFar(m))),
  get_z_near: port([], (m) => real(zNear(m))),
  get_aspect: port([], (m) => real(f(m[5]! / m[0]!))),
  get_fov: port([], (m) => real(fov(m))),
  is_orthogonal: port([], (m) => variant('BOOL', m[11] === 0)),
  get_viewport_half_extents: port([], (m) => variant('VECTOR2', halfExtents(m, zNear(m)))),
  get_far_plane_half_extents: port([], (m) => variant('VECTOR2', halfExtents(m, zFar(m)))),
  inverse: port([], (m) => projectionOf(inverse(m))),
  get_pixels_per_meter: port(['int32_t'], (m, args) =>
    variant('INT', BigInt(pixelsPerMeter(m, numberAt(args, 0))))
  ),
  get_lod_multiplier: port([], (m) => real(f(2 / m[0]!))),
};
