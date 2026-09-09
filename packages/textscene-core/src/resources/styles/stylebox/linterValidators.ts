/**
 * What Godot declares on `StyleBox` itself, so every StyleBoxFlat, -Texture,
 * -Line and -Empty in a `.tscn` validates the four content margins.
 *
 * Hint tier only: the setter is `ADD_PROPERTYI` bound to
 * `set_content_margin(Side, float)`, whose one guard is an `ERR_FAIL_INDEX` on
 * the SIDE. A `.tscn` names the side in the key, so no value can reach it, and
 * the float itself is bare-assigned.
 *
 * `-1` is the low end and means "use the style's own", not "unbounded below".
 */

// Registers the Resource tier this chain terminates at, so `resource_name` and
// its siblings still resolve when this module is loaded on its own.
import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

/** style_box.cpp:130-133 all hint "-1,2048,1,suffix:px" — both ends closed. */
const contentMargin = (name: string, cite: string) =>
  v.float(name, { min: -1, max: 2048, hinted: { min: cite, max: cite } });

validatorRegistry.registerAll('StyleBox', {
  content_margin_left: contentMargin('content_margin_left', 'style_box.cpp:130'),
  content_margin_top: contentMargin('content_margin_top', 'style_box.cpp:131'),
  content_margin_right: contentMargin('content_margin_right', 'style_box.cpp:132'),
  content_margin_bottom: contentMargin('content_margin_bottom', 'style_box.cpp:133'),
});
