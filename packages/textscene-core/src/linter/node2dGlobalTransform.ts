/**
 * Global `Transform2D` composition for a Node2D-family chain, for the warnings that
 * read `get_global_scale()`, `get_global_skew()` and `is_conformal()` (`node_2d.cpp:353-362`,
 * `:315-320`), which `godot/transform2d.ts` answers. It composes each ancestor's `position`,
 * `rotation`, `scale` and `skew` (`node_2d.cpp:499-503`), since Node2D's `transform` is
 * `PROPERTY_USAGE_NONE` (`node_2d.cpp:501`).
 */

import type { TscnNode, TscnScene } from '../parser/types.js';
import { isValidProperties } from './linterUtils.js';
import { searchAncestors } from './parentType.js';
import { descendsFrom } from '../godot/nodeBaseTypes.js';
import { VECTOR2_REGEX } from './validators/vectorValidators.js';
import { TSCN_FLOAT_RE, parseGodotFloat, tupleComponent } from './validators/commonValidators.js';
import { slotComponents, slotComponentsAltered } from '../godot/int.js';
import {
  TRANSFORM2D_IDENTITY,
  boolSlotValue,
  multiplyTransform2D,
  transform2DFromParts,
  type Transform2DColumns,
} from '../godot/index.js';

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
 * A Node2D's own local `Transform2D`, built as `Node2D::_update_transform` builds it. An
 * absent key takes Node2D's field default (`node_2d.h`): position `(0, 0)`, rotation `0`,
 * scale `(1, 1)` and skew `0`, together the identity.
 */
function localTransform2D(node: TscnNode): Transform2DColumns | null {
  if (!isValidProperties(node.properties)) return TRANSFORM2D_IDENTITY;
  const props = node.properties;

  const position = parseVector2(props.position, { x: 0, y: 0 });
  const rotation = parseScalar(props.rotation, 0);
  const scale = parseVector2(props.scale, { x: 1, y: 1 });
  if (position === null || scale === null) return null;
  const skew = parseScalar(props.skew, 0);

  return transform2DFromParts(rotation, scale, skew, position);
}

function isTopLevel(node: TscnNode): boolean {
  return isValidProperties(node.properties) && boolSlotValue(node.properties.top_level) === true;
}

export type GlobalTransform2DVerdict =
  | { readonly kind: 'known'; readonly transform: Transform2DColumns }
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

  let composed = TRANSFORM2D_IDENTITY;
  for (let i = chain.length - 1; i >= 0; i--) {
    const local = localTransform2D(chain[i]!);
    if (local === null) return { kind: 'unknowable' };
    composed = multiplyTransform2D(composed, local);
  }
  return { kind: 'known', transform: composed };
}
