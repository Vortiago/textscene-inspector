/**
 * Validators shared by every Viewport-derived node — SubViewport and Window —
 * covering the members `doc/classes/Viewport.xml` declares rather than the
 * handful its subclasses add.
 *
 * Registered under the abstract key `'Viewport'` so the base-walk in
 * ValidatorRegistry delivers them to both subclasses, the same shape
 * `3d/lights/shared/linterParser.ts` uses for `Light3D`. `Viewport` gets no
 * slice of its own because Godot cannot instantiate it
 * (`ClassDB.can_instantiate('Viewport') == false`), so it never appears as a
 * node type in a `.tscn` and has nothing to parse or render.
 *
 * These lived on `SubViewport` until `Window` arrived and inherited nothing:
 * `own_world_3d = garbage` errored on one and passed silently on the other,
 * for the same property on the same base class.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const MSAA = { 0: 'DISABLED', 1: '2X', 2: '4X', 3: '8X' };

/**
 * scene/main/viewport.h:188-193. LINEAR_WITH_MIPMAPS is 2 and
 * NEAREST_WITH_MIPMAPS is 3, which is the opposite of the order the two names
 * suggest and the opposite of what this map used to say. The numeric range was
 * right, so nothing rejected a legal value: the labels simply told a reader the
 * wrong thing about their own scene.
 */
const TEXTURE_FILTER = {
  0: 'NEAREST',
  1: 'LINEAR',
  2: 'LINEAR_WITH_MIPMAPS',
  3: 'NEAREST_WITH_MIPMAPS',
};

validatorRegistry.registerAll('Viewport', {
  own_world_3d: v.boolean('own_world_3d'),
  disable_3d: v.boolean('disable_3d'),
  transparent_bg: v.boolean('transparent_bg'),
  handle_input_locally: v.boolean('handle_input_locally'),
  use_debanding: v.boolean('use_debanding'),
  audio_listener_enable_2d: v.boolean('audio_listener_enable_2d'),
  gui_embed_subwindows: v.boolean('gui_embed_subwindows'),
  // viewport.cpp:5166 — PROPERTY_HINT_ENUM, 4 labels. set_msaa_3d
  // (viewport.cpp:3763): `ERR_FAIL_INDEX(p_msaa, MSAA_MAX)` — genuinely
  // enforced, MSAA_MAX=4 (scene/main/viewport.h:119-125).
  msaa_3d: v.enumInt('msaa_3d', 0, 3, MSAA, { enforced: 'viewport.cpp:3763' }),
  // viewport.cpp:5188 — PROPERTY_HINT_ENUM, 4 labels. set_default_canvas_item_texture_filter
  // (viewport.cpp:3968): `ERR_FAIL_INDEX(p_filter, DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_MAX)` —
  // genuinely enforced, MAX=4 (scene/main/viewport.h:188-194).
  canvas_item_default_texture_filter: v.enumInt(
    'canvas_item_default_texture_filter',
    0,
    3,
    TEXTURE_FILTER,
    { enforced: 'viewport.cpp:3968' }
  ),
});
