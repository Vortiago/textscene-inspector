/**
 * The single-precision `Basis` arithmetic of Godot's glTF scene import: the basis `GLTFNode`
 * builds for a node, and the per-axis scale `ImporterMesh::lightmap_unwrap_cached` takes of a
 * mesh node's transform chain (`importer_mesh.cpp:1051-1053`). Each step rounds to float32 in
 * Godot's operation order, since the unwrap cache is keyed on the bits of what follows.
 */

/** A `Basis`'s nine `real_t` components, row-major: `rows[i][j]` is at `3i + j`. */
export type Basis32 = readonly number[];

/** The transform fields of a glTF node. */
export interface GltfNodeTransform {
  matrix?: readonly number[];
  rotation?: readonly number[];
  scale?: readonly number[];
}

type Triple = [number, number, number];

const f = Math.fround;

export const IDENTITY_BASIS: Basis32 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/**
 * The node's basis as `_parse_nodes` sets it (`gltf_document.cpp:586-597`): a matrix by columns
 * (`:344-354`), else `set_rotation` then `set_scale` (`gltf_node.cpp:160-170`) on the identity.
 */
export function gltfNodeBasis(node: GltfNodeTransform): Basis32 {
  if (node.matrix) return basisFromColumns(node.matrix);
  let basis = IDENTITY_BASIS;
  // `set_quaternion_scale(q, get_scale())`, and the identity's scale is exactly one.
  if (node.rotation) basis = multiply(quaternionBasis(node.rotation), IDENTITY_BASIS);
  if (node.scale) basis = multiply(orthonormalized(basis), diagonal(node.scale));
  return basis;
}

/** `Basis::scale` (`basis.cpp:234-238`), which multiplies row `i` by `rowScales[i]`. */
export function rowScaledBasis(basis: Basis32, rowScales: readonly number[]): Basis32 {
  return basis.map((component, i) => f(component * f(rowScales[Math.floor(i / 3)]!)));
}

/**
 * The column lengths of `xf = n.transform * xf` over `chain`, mesh node first and root last
 * (`resource_importer_scene.cpp:2683-2689`).
 */
export function transformChainScale(chain: readonly Basis32[]): Triple {
  const basis = chain.reduce<Basis32>((xf, node) => multiply(node, xf), IDENTITY_BASIS);
  return [0, 1, 2].map((axis) => length(column(basis, axis))) as Triple;
}

/**
 * Where `lightmap_unwrap_cached` puts the vertices and normals, as flat `xyz` arrays it rewrites in
 * place: the transform keeps only `scale` (`importer_mesh.cpp:1051-1056`), and a normal goes
 * through its inverse transpose, normalised (`:1058`, `:1081-1093`).
 */
export function unwrapSpace(scale: readonly number[]): {
  transformPositions: (xyz: Float32Array) => void;
  transformNormals: (xyz: Float32Array) => void;
} {
  const basis = rowScaledBasis(IDENTITY_BASIS, scale);
  const normalBasis = transposed(inverse(basis));
  return {
    transformPositions: (xyz) => {
      for (let i = 0; i < xyz.length; i += 3) {
        // `Transform3D::xform` (`transform_3d.h:177-182`) adds the origin, which is zero, so a `-0` leaves as `+0`.
        xyz.set(
          xform(basis, xyz, i).map((component) => component + 0),
          i
        );
      }
    },
    transformNormals: (xyz) => {
      for (let i = 0; i < xyz.length; i += 3) xyz.set(normalized(xform(normalBasis, xyz, i)), i);
    },
  };
}

/** `Basis::xform` (`basis.h:336-341`) of the vector at `xyz[at]`: each row dotted with it. */
function xform(basis: Basis32, xyz: Float32Array, at: number): Triple {
  const v: Triple = [xyz[at]!, xyz[at + 1]!, xyz[at + 2]!];
  return [rowDot(basis, 0, v), rowDot(basis, 1, v), rowDot(basis, 2, v)];
}

function rowDot(basis: Basis32, row: number, v: Triple): number {
  return f(f(f(basis[3 * row]! * v[0]) + f(basis[3 * row + 1]! * v[1])) + f(basis[3 * row + 2]! * v[2]));
}

/** `Basis::invert` (`basis.cpp:39-54`), cofactors over the determinant. */
function inverse(basis: Basis32): Basis32 {
  const at = (row: number, col: number): number => basis[3 * row + col]!;
  const cofactor = (r1: number, c1: number, r2: number, c2: number): number =>
    f(f(at(r1, c1) * at(r2, c2)) - f(at(r1, c2) * at(r2, c1)));
  const co = [cofactor(1, 1, 2, 2), cofactor(1, 2, 2, 0), cofactor(1, 0, 2, 1)];
  const det = f(f(f(at(0, 0) * co[0]!) + f(at(0, 1) * co[1]!)) + f(at(0, 2) * co[2]!));
  const s = f(1 / det);
  return [
    f(co[0]! * s),
    f(cofactor(0, 2, 2, 1) * s),
    f(cofactor(0, 1, 1, 2) * s),
    f(co[1]! * s),
    f(cofactor(0, 0, 2, 2) * s),
    f(cofactor(0, 2, 1, 0) * s),
    f(co[2]! * s),
    f(cofactor(0, 1, 2, 0) * s),
    f(cofactor(0, 0, 1, 1) * s),
  ];
}

function transposed(basis: Basis32): Basis32 {
  return [0, 3, 6, 1, 4, 7, 2, 5, 8].map((i) => basis[i]!);
}

function basisFromColumns(matrix: readonly number[]): Basis32 {
  const at = (i: number): number => f(matrix[i] ?? 0);
  return [at(0), at(4), at(8), at(1), at(5), at(9), at(2), at(6), at(10)];
}

function diagonal(scale: readonly number[]): Basis32 {
  const [x = 1, y = 1, z = 1] = scale.map(f);
  return [x, 0, 0, 0, y, 0, 0, 0, z];
}

/** `Basis::set_quaternion` (`basis.cpp:828-838`). */
function quaternionBasis(rotation: readonly number[]): Basis32 {
  const [x = 0, y = 0, z = 0, w = 1] = rotation.map(f);
  const d = f(f(f(f(x * x) + f(y * y)) + f(z * z)) + f(w * w));
  const s = f(2 / d);
  const xs = f(x * s);
  const ys = f(y * s);
  const zs = f(z * s);
  const [wx, wy, wz] = [f(w * xs), f(w * ys), f(w * zs)];
  const [xx, xy, xz] = [f(x * xs), f(x * ys), f(x * zs)];
  const [yy, yz, zz] = [f(y * ys), f(y * zs), f(z * zs)];
  return [
    f(1 - f(yy + zz)),
    f(xy - wz),
    f(xz + wy),
    f(xy + wz),
    f(1 - f(xx + zz)),
    f(yz - wx),
    f(xz - wy),
    f(yz + wx),
    f(1 - f(xx + yy)),
  ];
}

/** `Basis::operator*` (`basis.h:281-286`): each component is `tdot` of the right over the left's row. */
function multiply(left: Basis32, right: Basis32): Basis32 {
  const product: number[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const terms = [0, 1, 2].map((k) => f(right[3 * k + col]! * left[3 * row + k]!));
      product.push(f(f(terms[0]! + terms[1]!) + terms[2]!));
    }
  }
  return product;
}

/** `Basis::orthonormalize` (`basis.cpp:56-72`), Gram-Schmidt over the columns. */
function orthonormalized(basis: Basis32): Basis32 {
  const x = normalized(column(basis, 0));
  const y = normalized(subtract(column(basis, 1), scaled(x, dot(x, column(basis, 1)))));
  const zColumn = column(basis, 2);
  const z = normalized(subtract(subtract(zColumn, scaled(x, dot(x, zColumn))), scaled(y, dot(y, zColumn))));
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

function column(basis: Basis32, axis: number): Triple {
  return [basis[axis]!, basis[axis + 3]!, basis[axis + 6]!];
}

function dot(a: Triple, b: Triple): number {
  return f(f(f(a[0] * b[0]) + f(a[1] * b[1])) + f(a[2] * b[2]));
}

function scaled(v: Triple, s: number): Triple {
  return [f(v[0] * s), f(v[1] * s), f(v[2] * s)];
}

function subtract(a: Triple, b: Triple): Triple {
  return [f(a[0] - b[0]), f(a[1] - b[1]), f(a[2] - b[2])];
}

/** `Vector3::length` (`vector3.h:532-538`). */
function length(v: Triple): number {
  return f(Math.sqrt(dot(v, v)));
}

/** `Vector3::normalize` (`vector3.h:548-558`): a zero vector stays zero. */
function normalized(v: Triple): Triple {
  const lengthSquared = dot(v, v);
  if (lengthSquared === 0) return [0, 0, 0];
  const vectorLength = f(Math.sqrt(lengthSquared));
  return [f(v[0] / vectorLength), f(v[1] / vectorLength), f(v[2] / vectorLength)];
}
