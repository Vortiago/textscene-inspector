/**
 * Validators shared by every OpenXRCompositionLayer-derived node.
 *
 * Registered under the abstract key 'OpenXRCompositionLayer', which Godot cannot
 * instantiate, so it appears in no .tscn and owns no slice. It reaches its
 * 3 subclasses through the
 * NODE_BASE_TYPES base-walk.
 *
 * Declare only OpenXRCompositionLayer's OWN members: the ones doc/classes/OpenXRCompositionLayer.xml
 * lists without an `overrides=` attribute, cross-checked against ADD_PROPERTY
 * in the .cpp. Quote the governing source line beside every non-obvious bound.
 *
 * `layer_viewport` is declared `Variant::OBJECT` with `PROPERTY_HINT_NODE_TYPE`
 * (openxr_composition_layer.cpp:151), which reads as an Object-typed property —
 * but `PackedScene::_parse_node` (packed_scene.cpp:884-888) converts any
 * OBJECT+NODE_TYPE property whose value is a Node into a NodePath via
 * `p_node->get_path_to(n)` before writing it, and `continue`s (omits the key
 * entirely) when the value never got set. So the `.tscn` spelling is
 * `NodePath("...")`, not an ExtResource/SubResource, and the key is legitimately
 * absent on a layer with no viewport assigned.
 *
 * `OpenXRCompositionLayer` also owns a second, UNBOUNDED family: its
 * `_get_property_list` override (:705-719) appends `PropertyInfo`s supplied by
 * whichever OpenXR extension wrappers are registered at runtime, and `_set`
 * (:730-737) stores any property name into `extension_property_values` and
 * returns `true` unconditionally. Godot discards a name with no `/`
 * (:713-716), so the only shape guarantee is `<something>/<something>` — the
 * actual key set depends on which extensions are compiled in and cannot be
 * enumerated statically, so no validator is registered for it.
 *
 * This needs no wildcard registration to stay correct: `ValidatorRegistry`'s
 * wildcard support (`ValidatorRegistry.ts`'s `WildcardEntry`) only matches a
 * FIXED, known prefix (`'bones/*'`, `'item_#/*'`) — there is no way to declare
 * "any prefix followed by `/`", because a pattern like `'/*'` slices to a
 * literal prefix of `'/'`, which matches nothing an extension actually writes
 * (`fb_alpha_blend/enable`, not `/enable`). That is moot, though:
 * `StrictTscnParser.onProperty` (`return` when `findValidator` answers null)
 * already treats ANY unregistered key on ANY node type as silently accepted —
 * there is no separate "unknown property" diagnostic anywhere in this linter —
 * so an extension key with no validator here already produces zero errors and
 * zero warnings without anything being added. See `linterParser.test.ts` for a
 * guard that keeps this true on purpose.
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

validatorRegistry.registerAll('OpenXRCompositionLayer', {
  // openxr_composition_layer.cpp:151, OBJECT + PROPERTY_HINT_NODE_TYPE
  // "SubViewport" -> serialises as NodePath (see the docblock above). The
  // NodePath's TARGET being a SubViewport is not checked: that needs
  // resolving the path against the tree and reading the target's own type,
  // which is a semantic-rule concern, not a per-key format one.
  layer_viewport: v.nodePath('layer_viewport'),
  // :152-157, all BOOL/VECTOR2I/INT with PROPERTY_HINT_NONE, and every setter
  // (:337-432) either bare-assigns or early-returns on equality — no ERR_FAIL,
  // no CLAMP anywhere in this group.
  use_android_surface: v.boolean('use_android_surface'),
  protected_content: v.boolean('protected_content'),
  android_surface_size: v.vector2i('android_surface_size'),
  sort_order: v.int('sort_order'),
  alpha_blend: v.boolean('alpha_blend'),
  enable_hole_punch: v.boolean('enable_hole_punch'),

  // "Swapchain State" group (:159-171). Every one of these ENUMs is read by a
  // setter (:455-579) that assigns unconditionally after an equality
  // short-circuit — no ERR_FAIL_INDEX anywhere in the group — so the
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
  // hint argument at all (PROPERTY_HINT_NONE default) — format-only.
  swapchain_state_border_color: v.color('swapchain_state_border_color'),
});
