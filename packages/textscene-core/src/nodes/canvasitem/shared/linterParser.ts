/**
 * Validators shared by every CanvasItem-derived node — the whole 2D world
 * (`Node2D`) and the whole UI overlay (`Control`).
 *
 * Registered under the abstract key `'CanvasItem'`, the same shape
 * `3d/lights/shared/linterParser.ts` uses for `Light3D` and
 * `viewport/shared/linterParser.ts` for `Viewport`. CanvasItem gets no slice of
 * its own because Godot cannot instantiate it, so it never appears as a node
 * type in a `.tscn` and has nothing to parse or render.
 *
 * These fifteen properties had no owner before, so they were split across the
 * two siblings by whoever needed one first: `Sprite2D` validated `z_index` and
 * `material` while `Label` did not; `Label` validated `visible` and `modulate`
 * while `Sprite2D` did not. Not one of the fifteen was checked on both, and six
 * — including the three bounded enums — were checked on neither. Exactly the
 * SubViewport/Window split that ADR-0008's Viewport tier fixed, one level down.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask, v } from '../../../linter/validators/index.js';

// scene/main/canvas_item.cpp:1476, PROPERTY_HINT_ENUM "Disabled,Clip Only,Clip + Draw"
const CLIP_CHILDREN = { 0: 'DISABLED', 1: 'ONLY', 2: 'AND_DRAW' };

// scene/main/canvas_item.cpp:1486, and BIND_ENUM_CONSTANT at :1510-1516.
const TEXTURE_FILTER = {
  0: 'PARENT_NODE',
  1: 'NEAREST',
  2: 'LINEAR',
  3: 'NEAREST_WITH_MIPMAPS',
  4: 'LINEAR_WITH_MIPMAPS',
  5: 'NEAREST_WITH_MIPMAPS_ANISOTROPIC',
  6: 'LINEAR_WITH_MIPMAPS_ANISOTROPIC',
};

// scene/main/canvas_item.cpp:1487, and BIND_ENUM_CONSTANT at :1519-1522.
const TEXTURE_REPEAT = { 0: 'PARENT_NODE', 1: 'DISABLED', 2: 'ENABLED', 3: 'MIRROR' };

validatorRegistry.registerAll('CanvasItem', {
  visible: v.boolean('visible'),
  modulate: v.color('modulate'),
  self_modulate: v.color('self_modulate'),
  show_behind_parent: v.boolean('show_behind_parent'),
  top_level: v.boolean('top_level'),
  clip_children: v.enumInt('clip_children', 0, 2, CLIP_CHILDREN),
  // PROPERTY_HINT_LAYERS_2D_RENDER — the same 32-bit shape as the 3D masks.
  light_mask: layerBitmask('light_mask'),
  visibility_layer: layerBitmask('visibility_layer'),
  // scene/main/canvas_item.cpp:1481 takes its bounds from the rendering server:
  // servers/rendering/rendering_server.h:103, CANVAS_ITEM_Z_MIN = -4096, and
  // CANVAS_ITEM_Z_MAX its positive mirror.
  z_index: v.strictInt('z_index', { min: -4096, max: 4096 }),
  z_as_relative: v.boolean('z_as_relative'),
  y_sort_enabled: v.boolean('y_sort_enabled'),
  texture_filter: v.enumInt('texture_filter', 0, 6, TEXTURE_FILTER),
  texture_repeat: v.enumInt('texture_repeat', 0, 3, TEXTURE_REPEAT),
  material: v.resourceReference('material'),
  use_parent_material: v.boolean('use_parent_material'),
});
