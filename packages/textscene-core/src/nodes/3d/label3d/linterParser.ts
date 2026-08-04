/**
 * Label3D strict validators for linting.
 * Migrated to the declarative `v` namespace.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

const BILLBOARD = { 0: 'DISABLED', 1: 'ENABLED', 2: 'FIXED_Y' };
const HORIZONTAL_ALIGNMENT = { 0: 'LEFT', 1: 'CENTER', 2: 'RIGHT', 3: 'FILL' };

validatorRegistry.registerAll('Label3D', {
  text: v.quotedString('text'),
  // label_3d.cpp:954 is a bare assignment, so the hint at :131
  // ("0.0001,128,0.0001") is advisory: out-of-range is a warning, not an error.
  pixel_size: v.float('pixel_size'),
  // set_billboard_mode:1001, ERR_FAIL_INDEX(p_mode, 3): the setter refuses.
  billboard: v.enumInt('billboard', 0, 2, BILLBOARD, { enforced: 'label_3d.cpp:1001' }),
  modulate: v.color('modulate'),
  // label_3d.cpp:155 hints "0,127,1,suffix:px" (closed, no or_greater);
  // set_outline_size:873-880 is a bare assignment (only guarded against a
  // redundant set), so out-of-hint is a warning, not an error.
  outline_size: v.float('outline_size', {
    min: 0,
    message: "Property 'outline_size' must be >= 0",
    hinted: 'label_3d.cpp:155',
  }),
  outline_modulate: v.color('outline_modulate'),
  // label_3d.cpp:154 hints "1,256,1,or_greater"; set_font_size:861-868 is a
  // bare assignment (only guarded against a redundant set).
  font_size: v.positiveFloat('font_size', undefined, { hinted: 'label_3d.cpp:154' }),
  // Godot documents line_spacing as "can be negative", so no bound here.
  line_spacing: v.float('line_spacing'),
  // set_horizontal_alignment:678, ERR_FAIL_INDEX((int)p_alignment, 4): the
  // setter refuses.
  horizontal_alignment: v.enumInt('horizontal_alignment', 0, 3, HORIZONTAL_ALIGNMENT, {
    enforced: 'label_3d.cpp:678',
  }),
  no_depth_test: v.boolean('no_depth_test'),
});
