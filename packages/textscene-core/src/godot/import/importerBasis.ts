/**
 * The single-precision `Basis` arithmetic of Godot's glTF scene import: the basis `GLTFNode`
 * builds for a node, and the per-axis scale `ImporterMesh::lightmap_unwrap_cached` takes of a
 * mesh node's transform chain (`importer_mesh.cpp:1051-1053`). Each step rounds to float32 in
 * Godot's operation order, since the unwrap cache is keyed on the bits of what follows.
 */

// Float arithmetic: each `f(...)` rounds as a C++ `float` operation does.
import { storedReal as f } from '../math/real.js';
import { normalizedVector3, vector3Dot } from '../math/vector.js';
import {
  basisDiagonal,
  basisFrom,
  basisFromQuaternion,
  basisInvert,
  basisMultiply,
  type BasisComponents,
} from '../math/basis.js';

/** The transform fields of a glTF node. */
export interface GltfNodeTransform {
  matrix?: readonly number[];
  rotation?: readonly number[];
  scale?: readonly number[];
}

type Triple = [number, number, number];

export const IDENTITY_BASIS: BasisComponents = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/**
 * The node's basis as `_parse_nodes` sets it (`gltf_document.cpp:586-597`): a matrix by columns
 * (`:344-354`), else `set_rotation` then `set_scale` (`gltf_node.cpp:160-170`) on the identity.
 */
export function gltfNodeBasis(node: GltfNodeTransform): BasisComponents {
  if (node.matrix) return basisFromColumns(node.matrix);
  let basis = IDENTITY_BASIS;
  // `set_quaternion_scale(q, get_scale())`, and the identity's scale is exactly one.
  if (node.rotation) basis = basisMultiply(quaternionBasis(node.rotation), IDENTITY_BASIS);
  if (node.scale) basis = basisMultiply(orthonormalized(basis), diagonal(node.scale));
  return basis;
}

/** `Basis::scale` (`basis.cpp:234-238`), which multiplies row `i` by `rowScales[i]`. */
export function rowScaledBasis(basis: BasisComponents, rowScales: readonly number[]): BasisComponents {
  return basisFrom((i) => f(basis[i]! * f(rowScales[Math.floor(i / 3)]!)));
}

/**
 * The column lengths of `xf = n.transform * xf` over `chain`, mesh node first and root last
 * (`resource_importer_scene.cpp:2683-2689`).
 */
export function transformChainScale(chain: readonly BasisComponents[]): Triple {
  const basis = chain.reduce<BasisComponents>((xf, node) => basisMultiply(node, xf), IDENTITY_BASIS);
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
  const normalBasis = transposed(basisInvert(basis));
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
      for (let i = 0; i < xyz.length; i += 3) xyz.set(normalizedVector3(...xform(normalBasis, xyz, i)), i);
    },
  };
}

/** `Basis::xform` (`basis.h:336-341`) of the vector at `xyz[at]`: each row dotted with it. */
function xform(basis: BasisComponents, xyz: Float32Array, at: number): Triple {
  const v: Triple = [xyz[at]!, xyz[at + 1]!, xyz[at + 2]!];
  return [rowDot(basis, 0, v), rowDot(basis, 1, v), rowDot(basis, 2, v)];
}

function rowDot(basis: BasisComponents, row: number, v: Triple): number {
  return f(f(f(basis[3 * row]! * v[0]) + f(basis[3 * row + 1]! * v[1])) + f(basis[3 * row + 2]! * v[2]));
}

function transposed(basis: BasisComponents): BasisComponents {
  return basisFrom((i) => basis[3 * (i % 3) + Math.floor(i / 3)]!);
}

function basisFromColumns(matrix: readonly number[]): BasisComponents {
  const at = (i: number): number => f(matrix[i] ?? 0);
  return [at(0), at(4), at(8), at(1), at(5), at(9), at(2), at(6), at(10)];
}

/** `Basis::set_quaternion` for a glTF rotation: `[x, y, z, w]`, each defaulting to the identity's. */
function quaternionBasis([x = 0, y = 0, z = 0, w = 1]: readonly number[]): BasisComponents {
  return basisFromQuaternion({ x, y, z, w });
}

function diagonal([x = 1, y = 1, z = 1]: readonly number[]): BasisComponents {
  return basisDiagonal(x, y, z);
}

/** `Basis::orthonormalize` (`basis.cpp:56-72`), Gram-Schmidt over the columns. */
function orthonormalized(basis: BasisComponents): BasisComponents {
  const x = normalizedVector3(...column(basis, 0));
  const y = normalizedVector3(...subtract(column(basis, 1), scaled(x, vector3Dot(x, column(basis, 1)))));
  const zColumn = column(basis, 2);
  const z = normalizedVector3(
    ...subtract(subtract(zColumn, scaled(x, vector3Dot(x, zColumn))), scaled(y, vector3Dot(y, zColumn)))
  );
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

function column(basis: BasisComponents, axis: number): Triple {
  return [basis[axis]!, basis[axis + 3]!, basis[axis + 6]!];
}

function scaled(v: Triple, s: number): Triple {
  return [f(v[0] * s), f(v[1] * s), f(v[2] * s)];
}

function subtract(a: Triple, b: Triple): Triple {
  return [f(a[0] - b[0]), f(a[1] - b[1]), f(a[2] - b[2])];
}

/** `Vector3::length` (`vector3.h:532-538`). */
function length(v: Triple): number {
  return f(Math.sqrt(vector3Dot(v, v)));
}
