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
  'instance_shader_parameters/*',
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
    // ERR_FAIL_INDEX(p_texture_filter, TEXTURE_FILTER_MAX) at canvas_item.cpp:1667,
    // TEXTURE_FILTER_MAX = 7 (canvas_item.h:52-60); the macro refuses < 0 too.
    const validator = validatorRegistry.findValidator(nodeType, 'texture_filter')!;
    for (const value of ['0', '3', '6']) expect(validator('texture_filter', value, 1)).toBeNull();
    expect(validator('texture_filter', '7', 1)?.severity).toBe('error');
    expect(validator('texture_filter', '-1', 1)?.severity).toBe('error');
  });

  it.each(['Sprite2D', 'Label'])('bounds texture_repeat on %s', (nodeType) => {
    // ERR_FAIL_INDEX(p_texture_repeat, TEXTURE_REPEAT_MAX) at canvas_item.cpp:1722,
    // TEXTURE_REPEAT_MAX = 4 (canvas_item.h:63-68), so 3 (MIRROR) is the ceiling
    // and the macro refuses < 0 at the other end.
    const validator = validatorRegistry.findValidator(nodeType, 'texture_repeat')!;
    for (const value of ['0', '1', '2', '3']) {
      expect(validator('texture_repeat', value, 1)).toBeNull();
    }
    expect(validator('texture_repeat', '4', 1)?.severity).toBe('error');
    expect(validator('texture_repeat', '-1', 1)?.severity).toBe('error');
  });

  it.each(['Sprite2D', 'Label'])('bounds clip_children on %s', (nodeType) => {
    // ERR_FAIL_COND(p_clip_mode >= CLIP_CHILDREN_MAX) at canvas_item.cpp:1733,
    // CLIP_CHILDREN_MAX = 3 (canvas_item.h:71-75). Only the ceiling is guarded;
    // ClipChildrenMode declares no underlying type, so whether -1 survives the
    // cast is compiler-defined and the floor stays unprobed.
    const validator = validatorRegistry.findValidator(nodeType, 'clip_children')!;
    expect(validator('clip_children', '2', 1)).toBeNull();
    expect(validator('clip_children', '3', 1)?.severity).toBe('error');
  });

  it('keeps z_index inside the rendering server range', () => {
    // ERR_FAIL_COND against RS::CANVAS_ITEM_Z_MIN/_MAX = -4096/4096
    // (canvas_item.cpp:668-669, rendering_server.h:103).
    const validator = validatorRegistry.findValidator('Sprite2D', 'z_index')!;
    expect(validator('z_index', '-4096', 1)).toBeNull();
    expect(validator('z_index', '4096', 1)).toBeNull();
    expect(validator('z_index', '-4097', 1)?.severity).toBe('error');
    expect(validator('z_index', '4097', 1)?.severity).toBe('error');
  });

  it('warns on light_mask and visibility_layer outside the 32-bit width', () => {
    // canvas_item.cpp:1477/:1478 hint PROPERTY_HINT_LAYERS_2D_RENDER, a
    // 32-checkbox widget, so the width is stated by the UI. Both setters
    // (:589-596, :1598-1602) assign unconditionally, so it warns, not errors.
    const lightMask = validatorRegistry.findValidator('Sprite2D', 'light_mask')!;
    const visibilityLayer = validatorRegistry.findValidator('Sprite2D', 'visibility_layer')!;
    expect(lightMask('light_mask', '4294967296', 1)?.severity).toBe('warning');
    expect(lightMask('light_mask', '-1', 1)?.severity).toBe('warning');
    expect(visibilityLayer('visibility_layer', '4294967296', 1)?.severity).toBe('warning');
  });

  it.each(['Sprite2D', 'Label'])(
    'accepts any value for instance_shader_parameters/<name> on %s (canvas_item.cpp:604-656, shader-typed)',
    (nodeType) => {
      const validator = validatorRegistry.findValidator(nodeType, 'instance_shader_parameters/tint')!;
      expect(validator).not.toBeNull();
      expect(validator('instance_shader_parameters/tint', 'Color(1, 0, 0, 1)', 1)).toBeNull();
      expect(validator('instance_shader_parameters/speed', '2.5', 1)).toBeNull();
      expect(validator('instance_shader_parameters/enabled', 'true', 1)).toBeNull();
    }
  );

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
