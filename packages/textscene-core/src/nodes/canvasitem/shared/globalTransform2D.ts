/**
 * Global `Transform2D` composition through Godot's canvas parent chain. The linter reads
 * it for the warnings that read `get_global_scale()`, `get_global_skew()` and
 * `is_conformal()` (`node_2d.cpp:353-362`, `:315-320`), and the cameras panel places a
 * Camera2D with it. It composes each Node2D's `position`, `rotation`, `scale` and `skew`
 * (`node_2d.cpp:499-503`), since Node2D's `transform` is `PROPERTY_USAGE_NONE`
 * (`node_2d.cpp:501`).
 */

import { climbAncestors, type ParentLookup } from '../../../linter/parentType.js';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { VECTOR2_REGEX, matchVector2 } from '../../../linter/validators/vectorValidators.js';
import {
  TRANSFORM2D_IDENTITY,
  multiplyTransform2D,
  transform2DFromParts,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import { boolSlotValue, scalarSlotValue } from '../../../godot/variant/variantBool.js';
import type { RawNode } from '../../../parser/types.js';

/**
 * The vector as the slot holds it, `fallback` when absent or malformed, or `null` when
 * a component narrows to a number the file does not state. A NaN in its place would
 * report skew on a node Godot finds unskewed, so the composition stops.
 */
function readVector2Property(
  raw: string | undefined,
  fallback: { x: number; y: number }
): { x: number; y: number } | null {
  if (raw === undefined) return fallback;
  const vector = matchVector2(raw);
  if (vector) return vector;
  // Malformed is linterParser.ts's job, not this helper's.
  return VECTOR2_REGEX.test(raw.trim()) ? null : fallback;
}

function parseScalar(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  // A malformed value is linterParser.ts's job, not this helper's.
  return scalarSlotValue(raw) ?? fallback;
}

/** The parts of a Node2D's pose that something other than its file wrote, such as a RemoteTransform2D. */
export interface Node2DPose {
  readonly position?: { readonly x: number; readonly y: number };
  readonly rotation?: number;
  readonly scale?: { readonly x: number; readonly y: number };
}

/**
 * A Node2D's own local `Transform2D`, built as `Node2D::_update_transform` builds it. An
 * absent key takes Node2D's field default (`node_2d.h`): position `(0, 0)`, rotation `0`,
 * scale `(1, 1)` and skew `0`, together the identity.
 */
function localTransform2D(node: RawNode, pose: Node2DPose | undefined): Transform2DColumns | null {
  const props = node.rawProperties;
  const position = pose?.position ?? readVector2Property(props.position, { x: 0, y: 0 });
  const rotation = pose?.rotation ?? parseScalar(props.rotation, 0);
  const scale = pose?.scale ?? readVector2Property(props.scale, { x: 1, y: 1 });
  if (position === null || scale === null) return null;
  const skew = parseScalar(props.skew, 0);

  return transform2DFromParts(rotation, scale, skew, position);
}

function isTopLevel(node: RawNode): boolean {
  return boolSlotValue(node.rawProperties.top_level) === true;
}

const NO_POSES: ReadonlyMap<RawNode, Node2DPose> = new Map();

type GlobalTransform2DVerdict =
  | { readonly kind: 'known'; readonly transform: Transform2DColumns }
  /** An opaque ancestor, a non-Node2D CanvasItem, or an altered `Vector2i` component. */
  | { readonly kind: 'unknowable' };

/**
 * The CanvasItems whose local transforms make up `node`'s global one, `node` first.
 * `get_parent_item()` (`canvas_item.cpp:565-571`) is null at a `top_level` node and at a
 * parent that is not a CanvasItem, so the climb stops at either. A `top_level` node
 * composes, then stops the climb above itself.
 */
function canvasChain(node: RawNode, parentOf: (child: RawNode) => ParentLookup): RawNode[] | null {
  const chain: RawNode[] = [node];
  if (isTopLevel(node)) return chain;

  const search = climbAncestors<'terminus' | 'control'>(node, parentOf, (parent) => {
    if (!descendsFromClass(parent.type, 'CanvasItem')) return 'terminus';
    // A Control composes, but this decodes only a Node2D's discrete properties.
    if (!descendsFromClass(parent.type, 'Node2D')) return 'control';
    chain.push(parent);
    return isTopLevel(parent) ? 'terminus' : undefined;
  });
  // An opaque ancestor's `top_level` and transform live in a scene this walk never
  // opens, and guessing identity would place the node wrong.
  if (search.kind === 'unknowable') return null;
  if (search.kind === 'found' && search.value === 'control') return null;
  return chain;
}

/**
 * Resolve `node`'s global `Transform2D`. `CanvasItem::get_global_transform()`
 * (`canvas_item.cpp:176-186`) multiplies each local transform into its parent item's
 * global one. `parentOf` is the tree's own parent lookup, so the linter climbs the file
 * and the cameras panel climbs the live tree. `poses` holds the pose that replaces a node's own.
 */
export function resolveGlobalTransform2D(
  node: RawNode,
  parentOf: (child: RawNode) => ParentLookup,
  poses: ReadonlyMap<RawNode, Node2DPose> = NO_POSES
): GlobalTransform2DVerdict {
  const chain = canvasChain(node, parentOf);
  if (chain === null) return { kind: 'unknowable' };

  let composed = TRANSFORM2D_IDENTITY;
  for (let i = chain.length - 1; i >= 0; i--) {
    const local = localTransform2D(chain[i]!, poses.get(chain[i]!));
    if (local === null) return { kind: 'unknowable' };
    composed = multiplyTransform2D(composed, local);
  }
  return { kind: 'known', transform: composed };
}
