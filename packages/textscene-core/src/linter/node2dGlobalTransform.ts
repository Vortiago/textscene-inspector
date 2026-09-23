/**
 * Global `Transform2D` composition for a Node2D-family chain, for the warnings that
 * read `get_global_scale()`, `get_global_skew()` and `is_conformal()` (`node_2d.cpp:353-362`,
 * `:315-320`). It composes each ancestor's `position`, `rotation`, `scale` and `skew`
 * (`node_2d.cpp:499-503`), since Node2D's `transform` is `PROPERTY_USAGE_NONE` (`node_2d.cpp:501`).
 */

import type { TscnNode, TscnScene } from '../parser/types.js';
import { isValidProperties } from './linterUtils.js';
import { searchAncestors } from './parentType.js';
import { descendsFrom } from '../godot/nodeBaseTypes.js';
import { VECTOR2_REGEX } from './validators/vectorValidators.js';
import { TSCN_FLOAT_RE, parseGodotFloat, tupleComponent } from './validators/commonValidators.js';
import { isEqualApprox, isZeroApprox, sign } from '../godot/math.js';
import { slotComponents, slotComponentsAltered } from '../godot/int.js';
import { boolSlotValue } from '../godot/index.js';

/** Godot's `Transform2D` layout (`core/math/transform_2d.h`): x-axis `(a, b)`, y-axis `(c, d)`, origin `(tx, ty)`. */
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
 * `Transform2D::operator*` (`transform_2d.cpp:198-217`): composes `local`'s space
 * into `parent`'s, so the result maps a point as applying `local`, then `parent`, would.
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

/** The vector as the slot holds it; `null` when the composition must not proceed. */
function parseVector2(
  raw: string | undefined,
  fallback: { x: number; y: number }
): { x: number; y: number } | null {
  if (raw === undefined) return fallback;
  const match = VECTOR2_REGEX.exec(raw);
  if (!match) return fallback; // malformed is linterParser.ts's job, not this helper's
  const captures = [match[1], match[2]];
  // An altered component withholds the whole answer: `_to_int`'s float branch is
  // undefined behaviour (`variant.h:369-370`), and the NaN `slotComponents` answers
  // with would report skew on a node Godot finds unskewed, and scale nowhere.
  if (slotComponentsAltered(raw, 'Vector2', captures)) return null;
  // `slotComponents`: the grammar admits the `Vector2i(...)` spelling Godot
  // converts, whose arguments are narrowed to int32 before the widening, so a
  // fractional or wrapping component stores a different number than it states.
  const [x, y] = slotComponents(raw, 'Vector2', captures, tupleComponent);
  return { x: x!, y: y! };
}

function parseScalar(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  if (!TSCN_FLOAT_RE.test(raw)) return fallback; // malformed is linterParser.ts's job, not this helper's
  return parseGodotFloat(raw) ?? fallback;
}

/**
 * A Node2D's own local `Transform2D`, by the `Transform2D(rot, scale, skew, pos)`
 * constructor's formula (`transform_2d.cpp:104-110`). An absent key takes Node2D's
 * field default (`node_2d.h`): position `(0, 0)`, rotation `0`, scale `(1, 1)` and
 * skew `0`, together the identity.
 */
function localTransform2D(node: TscnNode): Transform2DMatrix | null {
  if (!isValidProperties(node.properties)) return IDENTITY;
  const props = node.properties;

  const position = parseVector2(props.position, { x: 0, y: 0 });
  const rotation = parseScalar(props.rotation, 0);
  const scale = parseVector2(props.scale, { x: 1, y: 1 });
  if (position === null || scale === null) return null;
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
  /** An instanced or untyped ancestor, a non-Node2D CanvasItem, or an altered `Vector2i` component. */
  | { readonly kind: 'unknowable' };

/**
 * Resolve `node`'s global `Transform2D`. `CanvasItem::get_global_transform()`
 * (`canvas_item.cpp:176-186`) multiplies each local transform into its parent's global
 * one through `get_parent_item()`, which is null at a `top_level` node
 * (`canvas_item.cpp:520-533`) and at a parent that is not a CanvasItem.
 */
export function resolveGlobalTransform2D(scene: TscnScene, node: TscnNode): GlobalTransform2DVerdict {
  const chain: TscnNode[] = [node];

  // `top_level` detaches a node from its parent's transform, so the climb never
  // starts, not even to ask whether the parent is knowable.
  if (!isTopLevel(node)) {
    const search = searchAncestors<'terminus' | 'control'>(scene, node, (parent) => {
      // A Node or CanvasLayer fails the cast to CanvasItem: a complete answer.
      if (!descendsFrom(parent.type, 'CanvasItem')) return 'terminus';
      // A Control composes, but this decodes only a Node2D's discrete properties.
      if (!descendsFrom(parent.type, 'Node2D')) return 'control';
      chain.push(parent);
      // A `top_level` ancestor composes, then stops the climb above itself.
      return isTopLevel(parent) ? 'terminus' : undefined;
    });
    // An instanced ancestor's `top_level` and transform live in a scene this
    // linter never opens, and guessing identity would be a false positive.
    if (search.kind === 'unknowable') return { kind: 'unknowable' };
    if (search.kind === 'found' && search.value === 'control') return { kind: 'unknowable' };
  }

  let composed = IDENTITY;
  for (let i = chain.length - 1; i >= 0; i--) {
    const local = localTransform2D(chain[i]!);
    if (local === null) return { kind: 'unknowable' };
    composed = multiply(composed, local);
  }
  return { kind: 'known', transform: composed };
}

/**
 * `Transform2D::get_scale()` (`transform_2d.cpp:115-118`): the x column's length, and
 * the y column's signed by the determinant. The engine's `SIGN` (`typedefs.h:123-126`),
 * not `Math.sign`: they differ on NaN, which a serialised `nan` puts into the
 * determinant while the y column stays finite.
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
 * Whether the two axes are orthogonal, the zero-skew case of `Transform2D::get_skew()`
 * (`transform_2d.cpp:72-75`). Godot compares its cached `get_global_skew()` exactly
 * against 0.0, but this recomputes by another path, so `isZeroApprox` on the normalised
 * dot product absorbs `cos`/`sin` residue while a few degrees of real skew stay clear.
 */
export function hasZeroGlobalSkew(transform: Transform2DMatrix): boolean {
  const { a, b, c, d } = transform;
  const len0 = Math.hypot(a, b);
  const len1 = Math.hypot(c, d);
  // `Vector2::normalize()` (`core/math/vector2.cpp:52-58`) leaves a zero vector at
  // `(0, 0)`, so `get_skew()` is exactly 0, where a division would give NaN. Godot
  // stays silent on skew here and below, though the zero-scale check trips.
  if (len0 === 0 || len1 === 0) return true;
  // Parallel non-zero axes: `get_skew()` multiplies by `SIGN(det)`, exactly 0
  // (`typedefs.h:123-126`). Exact, like `SIGN`: at `det == 1e-30` the sign is `+1`
  // and Godot reports skew.
  if (a * d - c * b === 0) return true;
  const normalizedDot = (a * c + b * d) / (len0 * len1);
  return isZeroApprox(normalizedDot);
}
