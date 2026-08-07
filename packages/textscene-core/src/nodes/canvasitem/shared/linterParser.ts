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

// The terminal tier. Registration is self-registering on import, so a slice test
// that loads only this chain must pull `Node` explicitly or every Node-level key
// (`process_mode`, `process_priority`, the `editor_description`) resolves to null
// in isolation and only the full barrel sees them.
import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask } from '../../../linter/validators/layerBitmask.js';
import { v } from '../../../linter/validators/index.js';
import { CLIP_CHILDREN_MODES } from '../../../godot/canvasItem.js';
import { CANVAS_ITEM_Z_MIN, CANVAS_ITEM_Z_MAX } from '../../../godot/rendering.js';

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
  // canvas_item.cpp:1476, ENUM 3 labels (matches CLIP_CHILDREN_MAX=3,
  // canvas_item.h:71-75). set_clip_children_mode (canvas_item.cpp:1731-1733)
  // ERR_FAIL_CONDs against CLIP_CHILDREN_MAX.
  clip_children: v.enumInt('clip_children', 0, 2, CLIP_CHILDREN_MODES, { enforced: 'canvas_item.cpp:1731' }),
  // canvas_item.cpp:1477, PROPERTY_HINT_LAYERS_2D_RENDER — not a
  // PROPERTY_HINT_RANGE, so there is no numeric hint to ground a bound on.
  // set_light_mask (canvas_item.cpp:589-596) assigns unconditionally, no
  // ERR_FAIL, no clamp. The 0..2^32-1 `layerBitmask` bound this used to carry
  // was never engine-enforced, so it is removed here (ADR-0032 "none").
  light_mask: layerBitmask('light_mask', { hinted: 'canvas_item.cpp:1477' }),
  // canvas_item.cpp:1478, same PROPERTY_HINT_LAYERS_2D_RENDER shape.
  // set_visibility_layer (canvas_item.cpp:1598-1602) assigns unconditionally.
  visibility_layer: layerBitmask('visibility_layer', { hinted: 'canvas_item.cpp:1478' }),
  // scene/main/canvas_item.cpp:1481 builds the hint from the rendering server's
  // own constants, and set_z_index (canvas_item.cpp:668-669) ERR_FAIL_CONDs
  // against the same two — so this is enforced, not merely hinted.
  z_index: v.strictInt('z_index', {
    min: CANVAS_ITEM_Z_MIN,
    max: CANVAS_ITEM_Z_MAX,
    enforced: 'canvas_item.cpp:668',
  }),
  z_as_relative: v.boolean('z_as_relative'),
  y_sort_enabled: v.boolean('y_sort_enabled'),
  // canvas_item.cpp:1486, ENUM 7 labels (matches TEXTURE_FILTER_MAX=7,
  // canvas_item.h:52-60). set_texture_filter (canvas_item.cpp:1665-1667)
  // ERR_FAIL_INDEXes against TEXTURE_FILTER_MAX.
  texture_filter: v.enumInt('texture_filter', 0, 6, TEXTURE_FILTER, { enforced: 'canvas_item.cpp:1665' }),
  // canvas_item.cpp:1487, ENUM 4 labels (matches TEXTURE_REPEAT_MAX=4,
  // canvas_item.h:63-68). set_texture_repeat (canvas_item.cpp:1720-1722)
  // ERR_FAIL_INDEXes against TEXTURE_REPEAT_MAX.
  texture_repeat: v.enumInt('texture_repeat', 0, 3, TEXTURE_REPEAT, { enforced: 'canvas_item.cpp:1720' }),
  material: v.resourceReference('material'),
  use_parent_material: v.boolean('use_parent_material'),
});
