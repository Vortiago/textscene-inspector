/**
 * Global-transform composition for a Node2D-family ancestor chain.
 *
 * Several of Godot's own configuration warnings read `get_global_scale()` /
 * `get_global_skew()` / `get_global_transform().is_conformal()`
 * (`node_2d.cpp:353-362`, `:315-320`; `CanvasItem::get_global_transform()`,
 * `canvas_item.cpp:176-186`). None of that is a single property this linter
 * can read off one node — it is the composition of every ancestor's own
 * local transform, which this module builds statically from what a `.tscn`
 * actually serialises: Node2D's `position`/`rotation`/`scale`/`skew`
 * (`node_2d.cpp:499-503`).
 *
 * `Transform2D` is modelled as Godot lays it out: two axis columns plus an
 * origin, `Transform2D(a, b, c, d, tx, ty)` — x-axis `(a, b)`, y-axis
 * `(c, d)`, origin `(tx, ty)` (`core/math/transform_2d.h`).
 *
 * ## What this composes, and where it stops
 *
 * `CanvasItem::get_global_transform()` recurses through `get_parent_item()`:
 *
 *     Transform2D CanvasItem::get_global_transform() const {
 *         const CanvasItem *pi = get_parent_item();
 *         return pi ? pi->get_global_transform() * get_transform() : get_transform();
 *     }
 *     CanvasItem *CanvasItem::get_parent_item() const {
 *         if (top_level) return nullptr;
 *         return Object::cast_to<CanvasItem>(get_parent());
 *     }
 *
 * So the walk multiplies `node`'s own local transform into its parent's
 * global transform, going up — UNLESS a node's own `top_level` is set
 * (`canvas_item.cpp:520-533`), which makes IT the composition's root (nothing
 * further up contributes, exactly as if it had no parent).
 *
 * Three ancestor shapes end the walk, and they are NOT all the same:
 *
 * - **No parent** (scene root): a known, complete answer — there is nothing
 *   left to compose.
 * - **A non-CanvasItem ancestor** (a plain `Node`, a `CanvasLayer`, ...):
 *   `get_parent_item()`'s `cast_to<CanvasItem>` fails for these exactly as it
 *   does for `top_level`, so this is ALSO a known, complete answer — nothing
 *   above a `Node`/`CanvasLayer` parent enters the CanvasItem transform chain
 *   at all.
 * - **An `instance=`/untyped ancestor, or a CanvasItem ancestor that is NOT a
 *   Node2D** (a `Control`): both are `'unknowable'`. An instanced node's own
 *   `top_level`/transform live in a scene this linter never opens. A
 *   `Control` DOES compose into `get_global_transform()` — the cast only
 *   requires CanvasItem, not specifically Node2D — but this module only knows
 *   how to decode a Node2D-shaped local transform (discrete
 *   position/rotation/scale/skew), so it cannot read one. Guessing either
 *   case as identity would be a false positive waiting to happen; silence is
 *   the honest answer.
 *
 * `transform` is never read as an alternative to the discrete properties:
 * unlike Node3D, Node2D's own `transform` `ADD_PROPERTY` carries
 * `PROPERTY_USAGE_NONE` (`node_2d.cpp:501`), so the engine never serialises
 * it — there is nothing here to fall back to.
 */

import type { TscnNode, TscnScene } from '../parser/types.js';
import { isValidProperties } from './linterUtils.js';
import { searchAncestors } from './parentType.js';
import { descendsFrom } from '../godot/nodeBaseTypes.js';
import { VECTOR2_REGEX } from './validators/vectorValidators.js';
import { TSCN_FLOAT_RE, parseGodotFloat, tupleComponent } from './validators/commonValidators.js';
import { isEqualApprox, isZeroApprox, sign } from '../godot/math.js';
import { slotComponents } from '../godot/int.js';
import { boolSlotValue } from '../godot/index.js';

/** Godot's own `Transform2D` layout: x-axis `(a, b)`, y-axis `(c, d)`, origin `(tx, ty)`. */
export interface Transform2DMatrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;
}

const IDENTITY: Transform2DMatrix = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

/**
 * `Transform2D::operator*` (`transform_2d.cpp:198-217`): composes `local`'s
 * space INTO `parent`'s — the result maps a point the way applying `local`
 * then `parent` would.
 */
function multiply(parent: Transform2DMatrix, local: Transform2DMatrix): Transform2DMatrix {
  return {
    a: parent.a * local.a + parent.c * local.b,
    b: parent.b * local.a + parent.d * local.b,
    c: parent.a * local.c + parent.c * local.d,
    d: parent.b * local.c + parent.d * local.d,
    tx: parent.a * local.tx + parent.c * local.ty + parent.tx,
    ty: parent.b * local.tx + parent.d * local.ty + parent.ty,
  };
}


function parseVector2(raw: string | undefined, fallback: { x: number; y: number }): { x: number; y: number } {
  if (raw === undefined) return fallback;
  const match = VECTOR2_REGEX.exec(raw);
  if (!match) return fallback; // malformed is linterParser.ts's job, not this helper's
  // `slotComponents`: the grammar admits the `Vector2i(...)` spelling Godot
  // converts, whose arguments are narrowed to int32 before the widening, so a
  // fractional or wrapping component stores a different number than it states.
  const [x, y] = slotComponents(raw, 'Vector2', [match[1], match[2]], tupleComponent);
  return { x: x!, y: y! };
}

function parseScalar(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  if (!TSCN_FLOAT_RE.test(raw)) return fallback; // malformed is linterParser.ts's job, not this helper's
  return parseGodotFloat(raw) ?? fallback;
}

/**
 * A Node2D's own LOCAL `Transform2D`, from its discrete properties — the same
 * formula as the `Transform2D(rot, scale, skew, pos)` constructor
 * (`transform_2d.cpp:104-110`):
 *
 *     columns[0][0] = cos(rot) * scale.x;         columns[0][1] = sin(rot) * scale.x;
 *     columns[1][0] = -sin(rot + skew) * scale.y; columns[1][1] = cos(rot + skew) * scale.y;
 *     columns[2] = pos;
 *
 * Every input defaults to Node2D's own field default when absent
 * (`node_2d.h`): position `(0, 0)`, rotation `0`, scale `(1, 1)`, skew `0` —
 * together the identity transform, matching what an absent key means.
 */
function localTransform2D(node: TscnNode): Transform2DMatrix {
  if (!isValidProperties(node.properties)) return IDENTITY;
  const props = node.properties;

  const position = parseVector2(props.position, { x: 0, y: 0 });
  const rotation = parseScalar(props.rotation, 0);
  const scale = parseVector2(props.scale, { x: 1, y: 1 });
  const skew = parseScalar(props.skew, 0);

  return {
    a: Math.cos(rotation) * scale.x,
    b: Math.sin(rotation) * scale.x,
    c: -Math.sin(rotation + skew) * scale.y,
    d: Math.cos(rotation + skew) * scale.y,
    tx: position.x,
    ty: position.y,
  };
}

function isTopLevel(node: TscnNode): boolean {
  return isValidProperties(node.properties) && boolSlotValue(node.properties.top_level) === true;
}

export type GlobalTransform2DVerdict =
  | { readonly kind: 'known'; readonly transform: Transform2DMatrix }
  /** See the module docblock for exactly which ancestor shapes land here. */
  | { readonly kind: 'unknowable' };

/** Resolve `node`'s global `Transform2D`, composed statically. See the module docblock. */
export function resolveGlobalTransform2D(scene: TscnScene, node: TscnNode): GlobalTransform2DVerdict {
  const chain: TscnNode[] = [node];

  // `top_level` detaches a node from its parent's transform, so the climb never
  // starts — not even to ask whether the parent is knowable.
  if (!isTopLevel(node)) {
    const search = searchAncestors<'terminus' | 'control'>(scene, node, (parent) => {
      if (!descendsFrom(parent.type, 'CanvasItem')) return 'terminus'; // Node, CanvasLayer, ...
      if (!descendsFrom(parent.type, 'Node2D')) return 'control'; // composes, undecodable here
      chain.push(parent);
      // A `top_level` ancestor composes, then stops the climb above itself.
      return isTopLevel(parent) ? 'terminus' : undefined;
    });
    if (search.kind === 'unknowable') return { kind: 'unknowable' };
    if (search.kind === 'found' && search.value === 'control') return { kind: 'unknowable' };
  }

  let composed = IDENTITY;
  for (let i = chain.length - 1; i >= 0; i--) {
    composed = multiply(composed, localTransform2D(chain[i]!));
  }
  return { kind: 'known', transform: composed };
}

/**
 * `Transform2D::get_scale()` (`transform_2d.cpp:115-118`): the x column's
 * unsigned length, and the y column's length signed by the transform's shared
 * determinant sign.
 *
 * The engine's `SIGN` (`typedefs.h:123-126`), not `Math.sign`: they part ways
 * on NaN, which a serialised `nan` component puts into the determinant while
 * leaving the y column itself finite.
 */
export function globalScale(transform: Transform2DMatrix): { x: number; y: number } {
  const det = transform.a * transform.d - transform.c * transform.b;
  return {
    x: Math.hypot(transform.a, transform.b),
    y: sign(det) * Math.hypot(transform.c, transform.d),
  };
}

/**
 * `Transform2D::is_conformal()` (`transform_2d.cpp:167-179`): the axes are
 * equal-length and perpendicular, allowing a single shared reflection.
 */
export function isConformal(transform: Transform2DMatrix): boolean {
  const { a, b, c, d } = transform;
  const nonFlipped = isEqualApprox(a, d) && isEqualApprox(b, -c);
  const flipped = isEqualApprox(a, -d) && isEqualApprox(b, c);
  return nonFlipped || flipped;
}

/**
 * Whether the transform's two axes are orthogonal — the zero-skew case
 * `Transform2D::get_skew()` (`transform_2d.cpp:72-75`) tests via
 * `acos(...) - PI/2`, which is zero exactly when the (sign-adjusted) axes are
 * perpendicular, i.e. `col0 . col1 == 0` (the shared determinant-sign factor
 * cancels out of that equality).
 *
 * Godot's own check is `get_global_skew() != 0.0`, an EXACT compare against
 * the engine's cached value. This module recomputes the transform by a
 * different path (matrix composition rather than the engine's incrementally
 * cached one), so bit-identical output isn't realistic — an exact `!== 0`
 * here would false-positive on an ordinary rotated-but-not-skewed scene the
 * moment `cos`/`sin` rounding leaves the tiniest residue. Testing the
 * equivalent orthogonality predicate with `isZeroApprox` on the NORMALISED dot
 * product (so the tolerance means the same thing regardless of the axes'
 * length) keeps genuine skew — even a few degrees of it — well clear of the
 * tolerance while absorbing that float dust.
 *
 * Two degenerate cases short-circuit, and they are different:
 *
 * A zero-LENGTH axis — `Vector2::normalize()` (`core/math/vector2.cpp:52-58`)
 * guards `if (l != 0)` and otherwise leaves the vector at `(0, 0)`, so
 * `columns[0].normalized().dot(...)` is exactly `0`, making `get_skew()` exactly
 * `0` too. Dividing by a zero length instead would produce `NaN`, which
 * `isZeroApprox` calls not-zero — the opposite answer.
 *
 * A zero DETERMINANT with two non-zero axes — the axes are parallel, and
 * `get_skew()` multiplies `columns[1].normalized()` by `SIGN(det)`, which is
 * exactly `0` (`typedefs.h:123-126`). Same silence, and the length guard above
 * does not reach it. Exact, matching `SIGN`: at `det == 1e-30` the sign is `+1`
 * and Godot really does report skew.
 *
 * Godot stays SILENT on skew in both, even though either transform trips the
 * separate zero-scale check.
 */
export function hasZeroGlobalSkew(transform: Transform2DMatrix): boolean {
  const { a, b, c, d } = transform;
  const len0 = Math.hypot(a, b);
  const len1 = Math.hypot(c, d);
  if (len0 === 0 || len1 === 0) return true; // Vector2::normalize()'s zero-vector guard
  if (a * d - c * b === 0) return true; // SIGN(det) == 0 zeroes the second axis
  const normalizedDot = (a * c + b * d) / (len0 * len1);
  return isZeroApprox(normalizedDot);
}
