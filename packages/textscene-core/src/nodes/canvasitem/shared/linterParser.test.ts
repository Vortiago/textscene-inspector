/**
 * The CanvasItem set must reach BOTH families, which is the whole point of the
 * tier.
 *
 * Before it existed these fifteen keys had no owner and were split across
 * `Node2D` and `Control` by whoever needed one first. Measured at the time: not
 * one of the fifteen was validated on both, and six — including all three
 * bounded enums — were validated on neither, so `texture_filter = 99` was
 * silently accepted everywhere in the 2D world and the whole UI overlay.
 *
 * `Sprite2D` and `Label` stand in for the two families: one leaf per side,
 * neither of which declares any of these itself.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import './linterParser.js';
import '../../base/node2d/linterParser.js';
import '../../2d/ui/control/linterParser.js';
import '../../2d/sprite2d/linterParser.js';

/** Every member scene/main/canvas_item.cpp binds. */
const CANVAS_ITEM_KEYS = [
  'visible',
  'modulate',
  'self_modulate',
  'show_behind_parent',
  'top_level',
  'clip_children',
  'light_mask',
  'visibility_layer',
  'z_index',
  'z_as_relative',
  'y_sort_enabled',
  'texture_filter',
  'texture_repeat',
  'material',
  'use_parent_material',
] as const;

describe('CanvasItem shared validators', () => {
  it('registers the whole set under the abstract CanvasItem key', () => {
    expect(validatorRegistry.getOwnKeys('CanvasItem').sort()).toEqual(
      [...CANVAS_ITEM_KEYS].sort()
    );
  });

  it.each(['Node2D', 'Control'])('delivers every CanvasItem key to %s', (nodeType) => {
    const missing = CANVAS_ITEM_KEYS.filter(
      (key) => !validatorRegistry.findValidator(nodeType, key)
    );
    expect(missing).toEqual([]);
  });

  it.each(['Sprite2D', 'Label'])('reaches the %s leaf through the base-walk', (nodeType) => {
    const missing = CANVAS_ITEM_KEYS.filter(
      (key) => !validatorRegistry.findValidator(nodeType, key)
    );
    expect(missing).toEqual([]);
  });

  it.each(['Sprite2D', 'Label'])('bounds texture_filter on %s, silent on both before', (nodeType) => {
    const validator = validatorRegistry.findValidator(nodeType, 'texture_filter')!;
    for (const value of ['0', '3', '6']) expect(validator('texture_filter', value, 1)).toBeNull();
    expect(validator('texture_filter', '7', 1)).not.toBeNull();
  });

  it.each(['Sprite2D', 'Label'])('bounds clip_children on %s', (nodeType) => {
    const validator = validatorRegistry.findValidator(nodeType, 'clip_children')!;
    expect(validator('clip_children', '2', 1)).toBeNull();
    expect(validator('clip_children', '3', 1)).not.toBeNull();
  });

  it('keeps z_index inside the rendering server range', () => {
    const validator = validatorRegistry.findValidator('Sprite2D', 'z_index')!;
    expect(validator('z_index', '-4096', 1)).toBeNull();
    expect(validator('z_index', '4096', 1)).toBeNull();
    expect(validator('z_index', '5000', 1)).not.toBeNull();
  });

  it('leaves each family its own keys', () => {
    // Node2D keeps the 2D transform; Control keeps anchors. Neither should have
    // absorbed the other's, and neither keeps a CanvasItem key of its own.
    expect(validatorRegistry.getOwnKeys('Node2D')).toContain('position');
    expect(validatorRegistry.getOwnKeys('Control')).toContain('anchor_right');
    for (const key of CANVAS_ITEM_KEYS) {
      expect(validatorRegistry.getOwnKeys('Node2D')).not.toContain(key);
      expect(validatorRegistry.getOwnKeys('Control')).not.toContain(key);
    }
  });
});
