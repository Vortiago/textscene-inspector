/**
 * ProgressBar strict validators for linting.
 *
 * Declare only ProgressBar's OWN members — the ones doc/classes/ProgressBar.xml
 * lists without an `overrides=` attribute. Everything from Range up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * ProgressBar.xml lists exactly four members and none carries `overrides=`, so
 * all four are declared below. `editor_preview_indeterminate`'s setter is a
 * bare assignment and `_validate_property` only toggles PROPERTY_USAGE_NONE
 * when `indeterminate` is false (progress_bar.cpp:194-196) — that changes
 * whether the editor persists the property, not what a value the property
 * already carries means, so it grounds no rule here.
 */

import '../range/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

// progress_bar.h:62-68 — enum FillMode { FILL_BEGIN_TO_END, FILL_END_TO_BEGIN,
// FILL_TOP_TO_BOTTOM, FILL_BOTTOM_TO_TOP, FILL_MODE_MAX }, BIND_ENUM_CONSTANT
// at progress_bar.cpp:275-278. `p_fill` IS the property's own value (unlike
// e.g. Light3D::set_param's index-selects-a-field shape), so ERR_FAIL_INDEX
// grounds an error the same way Label3D.billboard does at label_3d.cpp:1001.
// The constructor (progress_bar.cpp:291-292) sets inherited Range/Control
// defaults (`set_v_size_flags(0)`, `set_step(0.01)`) and touches none of
// ProgressBar's own four members, so it changes no grounding below.
const FILL_MODE = {
  0: 'FILL_BEGIN_TO_END',
  1: 'FILL_END_TO_BEGIN',
  2: 'FILL_TOP_TO_BOTTOM',
  3: 'FILL_BOTTOM_TO_TOP',
};

validatorRegistry.registerAll('ProgressBar', {
  // progress_bar.cpp:200 — set_fill_mode: `ERR_FAIL_INDEX(p_fill, FILL_MODE_MAX)`
  // refuses the write outright, so out-of-range is an error, not a warning.
  fill_mode: v.enumInt('fill_mode', 0, 3, FILL_MODE, { enforced: 'progress_bar.cpp:200' }),
  // progress_bar.cpp:210-217 — set_show_percentage assigns straight through
  // (only an early-return on a redundant set); ADD_PROPERTY at :270 carries no
  // hint. Format-only.
  show_percentage: v.boolean('show_percentage'),
  // progress_bar.cpp:223-236 — set_indeterminate assigns straight through
  // (only an early-return on a redundant set); ADD_PROPERTY at :271 carries no
  // hint. Format-only.
  indeterminate: v.boolean('indeterminate'),
  // progress_bar.cpp:242-253 — set_editor_preview_indeterminate assigns
  // straight through (only an early-return on a redundant set); ADD_PROPERTY
  // at :273 carries no hint. Format-only.
  editor_preview_indeterminate: v.boolean('editor_preview_indeterminate'),
});
