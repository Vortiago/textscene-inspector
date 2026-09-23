/**
 * Validators shared by every CanvasItem-derived node: the 2D world (`Node2D`) and the UI overlay
 * (`Control`), under the abstract key `'CanvasItem'`, as `3d/lights/shared/linterParser.ts` does
 * for `Light3D` and `viewport/shared/linterParser.ts` for `Viewport`. CanvasItem has no slice:
 * Godot cannot instantiate it, so it never appears as a node type in a `.tscn`.
 */

// The terminal tier. Registration happens on import, so a slice test that loads only this chain
// imports `Node` explicitly, or every Node-level key (`process_mode`, `process_priority`,
// `editor_description`) resolves to null in isolation.
import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { layerBitmask } from '../../../linter/validators/layerBitmask.js';
import { shape, v } from '../../../linter/validators/index.js';
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
  // One-ended: `ERR_FAIL_COND(p_clip_mode >= CLIP_CHILDREN_MAX)` (canvas_item.cpp:1733) has no
  // floor, so the PROPERTY_HINT_ENUM at :1476 grounds the rest. Measured on 4.6.3, `4294967295`,
  // which the serialiser writes for -1, narrows to -1, passes the guard and clips, while `3` and
  // `-3000000000` trip it and keep 0.
  clip_children: v.enumInt('clip_children', 0, 2, CLIP_CHILDREN_MODES, {
    hinted: { min: 'canvas_item.cpp:1476' },
    enforced: { max: 'canvas_item.cpp:1733' },
  }),
  // canvas_item.cpp:1477, PROPERTY_HINT_LAYERS_2D_RENDER, not a PROPERTY_HINT_RANGE, so no numeric
  // hint grounds a bound. set_light_mask (canvas_item.cpp:589-596) assigns unconditionally, with no
  // ERR_FAIL and no clamp, so no 0..2^32-1 bound is declared (ADR-0032 "none").
  light_mask: layerBitmask('light_mask', { hinted: 'canvas_item.cpp:1477', width: 'int32' /* canvas_item.h:278 */ }),
  // canvas_item.cpp:1478, same PROPERTY_HINT_LAYERS_2D_RENDER shape.
  // set_visibility_layer (canvas_item.cpp:1598-1602) assigns unconditionally.
  visibility_layer: layerBitmask('visibility_layer', { hinted: 'canvas_item.cpp:1478', width: 'uint32' /* canvas_item.h:288 */ }),
  // scene/main/canvas_item.cpp:1481 builds the hint from the rendering server's
  // own constants, and set_z_index (canvas_item.cpp:668-669) ERR_FAIL_CONDs
  // against the same two, so this is enforced, not only hinted.
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
  texture_filter: v.enumInt('texture_filter', 0, 6, TEXTURE_FILTER, { enforced: 'canvas_item.cpp:1667' }),
  // canvas_item.cpp:1487, ENUM 4 labels (matches TEXTURE_REPEAT_MAX=4,
  // canvas_item.h:63-68). set_texture_repeat (canvas_item.cpp:1720-1722)
  // ERR_FAIL_INDEXes against TEXTURE_REPEAT_MAX.
  texture_repeat: v.enumInt('texture_repeat', 0, 3, TEXTURE_REPEAT, { enforced: 'canvas_item.cpp:1722' }),
  // Format-checked only. A ShaderMaterial is valid Godot here, though the renderer applies only a
  // CanvasItemMaterial.
  material: v.resourceReference('material'),
  use_parent_material: v.boolean('use_parent_material'),

  // canvas_item.cpp:604-656, a hand-rolled `_set`/`_get`/`_get_property_list` route beside
  // ADD_PROPERTY. Storage is per-instance state (:637-656, once an override exists), and the type
  // and hint come at runtime from RS::canvas_item_get_instance_shader_parameter_list. As with
  // ShaderGlobalsOverride's params/* (shaderglobalsoverride/linterParser.ts), only the key is checked.
  'instance_shader_parameters/*': shape(
    () => null,
    "any Variant — the type comes from the attached shader's uniform declarations, not the .tscn"
  ),
});
