/**
 * GraphNode parser: GraphElement plus `title`, `ignore_invalid_connection_type`, `slots_focus_mode`
 * and the `slot/<index>/<leaf>` family. `GraphNode::_set` (`graph_node.cpp:38-88`) applies one leaf,
 * and `set_slot` erases an entry whose leaves other than `draw_stylebox` are default (`:705-713`), so
 * a later write restarts from `Slot()`. `Object.entries` keeps file order for these non-index keys.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import { parseColorOrUndefined } from '../../../../utils/colorParser';
import { indexedKeyRegex, toIntIndex } from '../../../../godot/index.js';
import type { GraphNodeProperties, GraphNodeSlot } from './types';
import { parseGraphElement } from '../graphelement/parser';

/** `graph_node.cpp:45`: bare `str.get_slicec('/', 1).to_int()`, no validity gate. */
const SLOT_KEY_RE = indexedKeyRegex('^slot/(#)/(.+)$', 'to_int');

/**
 * `Slot`'s own class defaults (`graph_node.h:41-52`): also what
 * `HashMap<int, Slot>::operator[]` auto-vivifies for an undeclared index
 * during `_resort`/`NOTIFICATION_DRAW` (`nativeSolver.ts`'s own doc).
 */
export function defaultGraphNodeSlot(): GraphNodeSlot {
  return {
    leftEnabled: false,
    leftType: 0,
    leftColor: { r: 1, g: 1, b: 1, a: 1 },
    rightEnabled: false,
    rightType: 0,
    rightColor: { r: 1, g: 1, b: 1, a: 1 },
    drawStylebox: true,
  };
}

function colorEquals(a: GraphNodeSlot['leftColor'], b: GraphNodeSlot['leftColor']): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

/**
 * `GraphNode::set_slot`'s erase condition (`graph_node.cpp:708-713`):
 * `draw_stylebox` is not one of its tested fields, so a slot authoring only
 * `draw_stylebox = false` (every other leaf at its class default) is erased
 * outright, not stored with `drawStylebox: false`.
 */
function isEraseCondition(slot: GraphNodeSlot): boolean {
  const white = { r: 1, g: 1, b: 1, a: 1 };
  return (
    !slot.leftEnabled &&
    slot.leftType === 0 &&
    colorEquals(slot.leftColor, white) &&
    !slot.rightEnabled &&
    slot.rightType === 0 &&
    colorEquals(slot.rightColor, white) &&
    slot.leftIcon === undefined &&
    slot.rightIcon === undefined
  );
}

/** Applies one `_set` leaf write onto a copy of `slot`. Unparseable text leaves that leaf untouched (this renderer's lenient-parse convention). */
function applyLeaf(slot: GraphNodeSlot, leaf: string, value: string): GraphNodeSlot {
  switch (leaf) {
    case 'left_enabled': {
      const v = parseOptionalBool(value);
      return v === undefined ? slot : { ...slot, leftEnabled: v };
    }
    case 'left_type': {
      const v = parseOptionalInt(value);
      return v === undefined ? slot : { ...slot, leftType: v };
    }
    case 'left_color': {
      const v = parseColorOrUndefined(value);
      return v === undefined ? slot : { ...slot, leftColor: v };
    }
    case 'left_icon':
      return { ...slot, leftIcon: value };
    case 'right_enabled': {
      const v = parseOptionalBool(value);
      return v === undefined ? slot : { ...slot, rightEnabled: v };
    }
    case 'right_type': {
      const v = parseOptionalInt(value);
      return v === undefined ? slot : { ...slot, rightType: v };
    }
    case 'right_color': {
      const v = parseColorOrUndefined(value);
      return v === undefined ? slot : { ...slot, rightColor: v };
    }
    case 'right_icon':
      return { ...slot, rightIcon: value };
    case 'draw_stylebox': {
      const v = parseOptionalBool(value);
      return v === undefined ? slot : { ...slot, drawStylebox: v };
    }
    default:
      // `_set` returns false for any other leaf name: no-op (graph_node.cpp:71-73).
      return slot;
  }
}

function parseSlots(properties: Record<string, string>): Map<number, GraphNodeSlot> {
  const slots = new Map<number, GraphNodeSlot>();
  for (const [key, value] of Object.entries(properties)) {
    const m = SLOT_KEY_RE.exec(key);
    if (!m) continue;
    const index = toIntIndex(m[1]!);
    // `set_slot`'s own `ERR_FAIL_COND_MSG(p_slot_index < 0, ...)` (:706) refuses
    // a negative index outright: the write never lands.
    if (!(index >= 0)) continue;
    const leaf = m[2]!;
    const current = slots.get(index) ?? defaultGraphNodeSlot();
    const next = applyLeaf(current, leaf, value);
    if (isEraseCondition(next)) {
      slots.delete(index);
    } else {
      slots.set(index, next);
    }
  }
  return slots;
}

export function parseGraphNode(
  heading: ParsedHeading,
  properties: Record<string, string>
): GraphNodeProperties {
  const result: GraphNodeProperties = {
    ...parseGraphElement(heading, properties),
    slots: parseSlots(properties),
  };

  if (properties.title !== undefined) result.title = unquoteString(properties.title);
  result.ignoreInvalidConnectionType = parseOptionalBool(properties.ignore_invalid_connection_type);
  result.slotsFocusMode = parseOptionalInt(properties.slots_focus_mode);

  return result;
}
