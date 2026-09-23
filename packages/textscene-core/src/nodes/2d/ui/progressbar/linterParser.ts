/**
 * ProgressBar's strict validators: the four members ProgressBar.xml lists
 * (doc/classes/ProgressBar.xml), none with `overrides=`. Range and above
 * arrive through the NODE_BASE_TYPES base-walk, and re-declaring an inherited
 * key shadows it and duplicates the rule.
 */

import '../range/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// enum FillMode, progress_bar.h:62-68, bound at progress_bar.cpp:275-278.
// The constructor (progress_bar.cpp:291-292) sets only inherited defaults
// (`set_v_size_flags(0)`, `set_step(0.01)`), so it grounds nothing below.
const FILL_MODE = {
  0: 'FILL_BEGIN_TO_END',
  1: 'FILL_END_TO_BEGIN',
  2: 'FILL_TOP_TO_BOTTOM',
  3: 'FILL_BOTTOM_TO_TOP',
};

validatorRegistry.registerAll('ProgressBar', {
  // progress_bar.cpp:200: `ERR_FAIL_INDEX(p_fill, FILL_MODE_MAX)` refuses the
  // write. `p_fill` is the value itself, so this is an error, as for
  // Label3D.billboard at label_3d.cpp:1001.
  fill_mode: v.enumInt('fill_mode', 0, 3, FILL_MODE, { enforced: 'progress_bar.cpp:200' }),
  // progress_bar.cpp:210-217 assigns straight through, and ADD_PROPERTY at :270
  // carries no hint. Format-only.
  show_percentage: v.boolean('show_percentage'),
  // progress_bar.cpp:223-236 assigns straight through, and ADD_PROPERTY at :271
  // carries no hint. Format-only.
  indeterminate: v.boolean('indeterminate'),
  // progress_bar.cpp:242-253 assigns straight through, and ADD_PROPERTY at :273
  // carries no hint. `_validate_property` (progress_bar.cpp:194-196) changes
  // only whether the editor stores the key. Format-only.
  editor_preview_indeterminate: v.boolean('editor_preview_indeterminate'),
});
