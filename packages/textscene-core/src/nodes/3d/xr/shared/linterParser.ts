/**
 * Validators shared by every OpenXRCompositionLayer subclass, registered under the abstract key
 * 'OpenXRCompositionLayer', which no .tscn instantiates. The subclasses reach it through the
 * NODE_BASE_TYPES base-walk. Only the members doc/classes/OpenXRCompositionLayer.xml lists without
 * `overrides=` belong here, with the governing source line beside every non-obvious bound.
 */

import '../../../base/node3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const FILTER_LABELS = { 0: 'NEAREST', 1: 'LINEAR', 2: 'CUBIC' };
const MIPMAP_MODE_LABELS = { 0: 'DISABLED', 1: 'NEAREST', 2: 'LINEAR' };
const WRAP_LABELS = {
  0: 'CLAMP_TO_BORDER',
  1: 'CLAMP_TO_EDGE',
  2: 'REPEAT',
  3: 'MIRRORED_REPEAT',
  4: 'MIRROR_CLAMP_TO_EDGE',
};
const SWIZZLE_LABELS = { 0: 'RED', 1: 'GREEN', 2: 'BLUE', 3: 'ALPHA', 4: 'ZERO', 5: 'ONE' };

// `_get_property_list` (:705-719) adds keys from the OpenXR extension wrappers registered at runtime,
// and `_set` (:730-737) stores any name. The list drops a name with no `/` (:713-716), and a
// `WildcardEntry` needs a fixed prefix, so no validator can name these keys. None is needed:
// StrictTscnParser.onProperty accepts an unregistered key silently, and linterParser.test.ts guards it.
validatorRegistry.registerAll('OpenXRCompositionLayer', {
  // openxr_composition_layer.cpp:151, OBJECT + PROPERTY_HINT_NODE_TYPE "SubViewport", which `_parse_node` writes as
  // a NodePath and omits when cleared (packed_scene.cpp:884-891). Whether it names a SubViewport needs the tree, a
  // semantic rule's concern. A bare `null` loads: variant_parser.cpp:699 reads it, NIL converts to OBJECT
  // (variant.cpp:543-545), both set_layer_viewport guards read `p_viewport != nullptr` (:295-305), and :345 passes nullptr.
  layer_viewport: v.nodePath('layer_viewport', { orNull: true }),
  // :152-157, all BOOL/VECTOR2I/INT with PROPERTY_HINT_NONE, and every setter
  // (:337-432) either bare-assigns or early-returns on equality: no ERR_FAIL
  // and no CLAMP anywhere in this group.
  use_android_surface: v.boolean('use_android_surface'),
  protected_content: v.boolean('protected_content'),
  android_surface_size: v.vector2i('android_surface_size'),
  sort_order: v.int('sort_order'),
  alpha_blend: v.boolean('alpha_blend'),
  enable_hole_punch: v.boolean('enable_hole_punch'),

  // "Swapchain State" group (:159-171). Every one of these ENUMs is read by a
  // setter (:455-579) that assigns unconditionally after an equality
  // short-circuit, with no ERR_FAIL_INDEX anywhere in the group, so the
  // PROPERTY_HINT_ENUM string is the only authority and out-of-range warns.
  swapchain_state_min_filter: v.enumInt('swapchain_state_min_filter', 0, 2, FILTER_LABELS, {
    hinted: 'openxr_composition_layer.cpp:160',
  }),
  swapchain_state_mag_filter: v.enumInt('swapchain_state_mag_filter', 0, 2, FILTER_LABELS, {
    hinted: 'openxr_composition_layer.cpp:161',
  }),
  swapchain_state_mipmap_mode: v.enumInt('swapchain_state_mipmap_mode', 0, 2, MIPMAP_MODE_LABELS, {
    hinted: 'openxr_composition_layer.cpp:162',
  }),
  swapchain_state_horizontal_wrap: v.enumInt('swapchain_state_horizontal_wrap', 0, 4, WRAP_LABELS, {
    hinted: 'openxr_composition_layer.cpp:163',
  }),
  swapchain_state_vertical_wrap: v.enumInt('swapchain_state_vertical_wrap', 0, 4, WRAP_LABELS, {
    hinted: 'openxr_composition_layer.cpp:164',
  }),
  swapchain_state_red_swizzle: v.enumInt('swapchain_state_red_swizzle', 0, 5, SWIZZLE_LABELS, {
    hinted: 'openxr_composition_layer.cpp:165',
  }),
  swapchain_state_green_swizzle: v.enumInt('swapchain_state_green_swizzle', 0, 5, SWIZZLE_LABELS, {
    hinted: 'openxr_composition_layer.cpp:166',
  }),
  swapchain_state_blue_swizzle: v.enumInt('swapchain_state_blue_swizzle', 0, 5, SWIZZLE_LABELS, {
    hinted: 'openxr_composition_layer.cpp:167',
  }),
  swapchain_state_alpha_swizzle: v.enumInt('swapchain_state_alpha_swizzle', 0, 5, SWIZZLE_LABELS, {
    hinted: 'openxr_composition_layer.cpp:168',
  }),
  // :169 hints "1.0,16.0,0.001"; set_max_anisotropy (:581-589) assigns
  // unconditionally past an equality short-circuit, so out of range warns.
  swapchain_state_max_anisotropy: v.float('swapchain_state_max_anisotropy', {
    min: 1,
    max: 16,
    hinted: 'openxr_composition_layer.cpp:169',
  }),
  // :170, PropertyInfo(Variant::COLOR, "swapchain_state_border_color") with no
  // hint argument (PROPERTY_HINT_NONE default), so the check is format only.
  swapchain_state_border_color: v.color('swapchain_state_border_color'),
});
