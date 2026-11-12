/**
 * Global `Transform2D` composition through Godot's canvas parent chain. The linter reads
 * it for the warnings that read `get_global_scale()`, `get_global_skew()` and
 * `is_conformal()` (`node_2d.cpp:353-362`, `:315-320`), the cameras panel places a
 * Camera2D with it, and the RemoteTransform pass composes through it. It composes each Node2D's
 * `position`, `rotation`, `scale` and `skew` (`node_2d.cpp:499-503`), since Node2D's `transform` is
 * `PROPERTY_USAGE_NONE` (`node_2d.cpp:501`), and each Control: from the transform the Control walk
 * solved where it has one, else from its offsets where they state its rect alone.
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
  readonly skew?: number;
}

/** The anchors that place the position. The right and bottom anchors only size the rect (`control.cpp:1760-1771`). */
const POSITION_ANCHORS = ['anchor_left', 'anchor_top'] as const;
/** A stated `position` is set through the offsets and anchors, so the offsets alone no longer give it. */
const POSITION_KEYS = ['position', 'global_position'] as const;
const PIVOT_KEYS = ['pivot_offset', 'pivot_offset_ratio'] as const;
const GROW_KEYS = ['grow_horizontal', 'grow_vertical'] as const;
/** `Control::GROW_DIRECTION_END` (`control.h`): the left and top edge keep their place. */
const GROW_DIRECTION_END = 1;

/** Whether the raw property is absent or states the zero vector. */
function isZeroVector2(raw: string | undefined): boolean {
  const vector = readVector2Property(raw, { x: 0, y: 0 });
  return vector !== null && vector.x === 0 && vector.y === 0;
}

/**
 * The local `Transform2D` of a Control whose rect the file states alone (`control.cpp:719-737`):
 * rotation and scale at `offset_left` and `offset_top`. A Node2D parent has an empty anchorable
 * rect (`canvas_item.h:414`), so no anchor moves the position below it. Null where the position
 * needs a size or a parent rect the file does not state: a `position`, a left or top anchor, a pivot or a grow direction.
 */
function controlLocalTransform2D(node: RawNode, parent: RawNode | undefined): Transform2DColumns | null {
  const props = node.rawProperties;
  if (POSITION_KEYS.some((key) => props[key] !== undefined)) return null;
  const parentHasRect = parent === undefined || !descendsFromClass(parent.type, 'Node2D');
  if (parentHasRect && !POSITION_ANCHORS.every((key) => parseScalar(props[key], 0) === 0)) return null;
  if (!PIVOT_KEYS.every((key) => isZeroVector2(props[key]))) return null;
  if (!GROW_KEYS.every((key) => parseScalar(props[key], GROW_DIRECTION_END) === GROW_DIRECTION_END))
    return null;
  const scale = readVector2Property(props.scale, { x: 1, y: 1 });
  if (scale === null) return null;
  const position = { x: parseScalar(props.offset_left, 0), y: parseScalar(props.offset_top, 0) };
  return transform2DFromParts(parseScalar(props.rotation, 0), scale, 0, position);
}

/** `Control::get_transform()` (`control.cpp:731-736`) of each Control the Control walk has solved. */
export type SolvedControls = ReadonlyMap<RawNode, Transform2DColumns>;

/**
 * A Node2D's own local `Transform2D`, built as `Node2D::_update_transform` builds it. An
 * absent key takes Node2D's field default (`node_2d.h`): position `(0, 0)`, rotation `0`,
 * scale `(1, 1)` and skew `0`, together the identity. Null for a vector that narrows to a number the
 * file does not state. `parent` is the canvas item above the node, which a Control reads for its rect,
 * and `solved` holds the Controls the Control walk has solved.
 */
export function localTransform2D(
  node: RawNode,
  pose?: Node2DPose,
  parent?: RawNode,
  solved: SolvedControls = NO_SOLVED
): Transform2DColumns | null {
  if (descendsFromClass(node.type, 'Control'))
    return solved.get(node) ?? controlLocalTransform2D(node, parent);
  const props = node.rawProperties;
  const position = pose?.position ?? readVector2Property(props.position, { x: 0, y: 0 });
  const rotation = pose?.rotation ?? parseScalar(props.rotation, 0);
  const scale = pose?.scale ?? readVector2Property(props.scale, { x: 1, y: 1 });
  if (position === null || scale === null) return null;
  const skew = pose?.skew ?? parseScalar(props.skew, 0);

  return transform2DFromParts(rotation, scale, skew, position);
}

function isTopLevel(node: RawNode): boolean {
  return boolSlotValue(node.rawProperties.top_level) === true;
}

const NO_POSES: ReadonlyMap<RawNode, Node2DPose> = new Map();
const NO_SOLVED: SolvedControls = new Map();

type GlobalTransform2DVerdict =
  | { readonly kind: 'known'; readonly transform: Transform2DColumns }
  /** An opaque ancestor, a Control the file does not place alone, or an altered `Vector2i` component. */
  | { readonly kind: 'unknowable' };

/**
 * The CanvasItems whose local transforms make up `node`'s global one, `node` first.
 * `get_parent_item()` (`canvas_item.cpp:565-571`) is null at a `top_level` node and at a
 * parent that is not a CanvasItem, so the climb stops at either. A `top_level` node
 * composes, then stops the climb above itself.
 */
function canvasChain(
  node: RawNode,
  parentOf: (child: RawNode) => ParentLookup,
  solved: SolvedControls
): RawNode[] | null {
  const chain: RawNode[] = [node];
  if (isTopLevel(node)) return chain;

  const search = climbAncestors<'terminus' | 'laidOut'>(node, parentOf, (parent) => {
    // A Container sets the rect of the Control below it, which only the Control walk solves.
    const child = chain[chain.length - 1]!;
    if (
      descendsFromClass(child.type, 'Control') &&
      descendsFromClass(parent.type, 'Container') &&
      !solved.has(child)
    )
      return 'laidOut';
    if (!descendsFromClass(parent.type, 'CanvasItem')) return 'terminus';
    chain.push(parent);
    return isTopLevel(parent) ? 'terminus' : undefined;
  });
  // An opaque ancestor's `top_level` and transform live in a scene this walk never
  // opens, and guessing identity would place the node wrong.
  if (search.kind === 'unknowable') return null;
  if (search.kind === 'found' && search.value === 'laidOut') return null;
  return chain;
}

/**
 * Resolve `node`'s global `Transform2D`. `CanvasItem::get_global_transform()`
 * (`canvas_item.cpp:176-186`) multiplies each local transform into its parent item's
 * global one. `parentOf` is the tree's own parent lookup, so the linter climbs the file
 * and the cameras panel climbs the live tree. `poses` holds the pose that replaces a node's own, and
 * `solved` the Controls the Control walk has solved.
 */
export function resolveGlobalTransform2D(
  node: RawNode,
  parentOf: (child: RawNode) => ParentLookup,
  poses: ReadonlyMap<RawNode, Node2DPose> = NO_POSES,
  solved: SolvedControls = NO_SOLVED
): GlobalTransform2DVerdict {
  const chain = canvasChain(node, parentOf, solved);
  if (chain === null) return { kind: 'unknowable' };

  let composed = TRANSFORM2D_IDENTITY;
  for (let i = chain.length - 1; i >= 0; i--) {
    const local = localTransform2D(chain[i]!, poses.get(chain[i]!), chain[i + 1], solved);
    if (local === null) return { kind: 'unknowable' };
    composed = multiplyTransform2D(composed, local);
  }
  return { kind: 'known', transform: composed };
}
