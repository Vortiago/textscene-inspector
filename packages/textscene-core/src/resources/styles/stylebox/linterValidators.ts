/**
 * The four content margins Godot declares on `StyleBox`, for every subclass.
 * Hint tier only: the `ADD_PROPERTYI` setter `set_content_margin(Side, float)`
 * has one `ERR_FAIL_INDEX` on the side, which the key names, and bare-assigns the
 * float. `-1` is the low end and means "use the style's own".
 */

// Registers the Resource tier this chain terminates at, so `resource_name` and
// its siblings still resolve when this module is loaded on its own.
import '../../resource/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

/** style_box.cpp:130-133 all hint "-1,2048,1,suffix:px": both ends closed. */
const contentMargin = (name: string, cite: string) =>
  v.float(name, { min: -1, max: 2048, hinted: { min: cite, max: cite } });

validatorRegistry.registerAll('StyleBox', {
  content_margin_left: contentMargin('content_margin_left', 'style_box.cpp:130'),
  content_margin_top: contentMargin('content_margin_top', 'style_box.cpp:131'),
  content_margin_right: contentMargin('content_margin_right', 'style_box.cpp:132'),
  content_margin_bottom: contentMargin('content_margin_bottom', 'style_box.cpp:133'),
});
