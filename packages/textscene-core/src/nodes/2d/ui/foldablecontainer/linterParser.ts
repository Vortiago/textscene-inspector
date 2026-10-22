/**
 * FoldableContainer strict validators. They declare only the members that
 * doc/classes/FoldableContainer.xml lists without `overrides=`: the NODE_BASE_TYPES
 * base-walk delivers the inherited keys, and a redeclared key shadows its ancestor.
 */

// `focus_mode` and `mouse_filter` are `overrides="Control"`: the constructor changes only their
// defaults (foldable_container.cpp:598-600), so Control's validators cover them.
import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import {
  OverrunBehavior,
  OVERRUN_BEHAVIOR_NAMES,
  TEXT_DIRECTION_NAMES,
} from '../../../../godot/text/textServerEnums.js';
import { FOLDABLE_CONTAINER_TITLE_POSITION_NAMES } from '../../../../godot/scene/gui.js';
import {
  HORIZONTAL_ALIGNMENT_LEFT,
  HORIZONTAL_ALIGNMENT_NAMES,
  HORIZONTAL_ALIGNMENT_RIGHT,
} from '../../../../godot/math/alignment.js';

validatorRegistry.registerAll('FoldableContainer', {
  // foldable_container.cpp:558, PROPERTY_HINT_NONE. set_folded
  // (foldable_container.cpp:66-82) bare-assigns.
  folded: v.boolean('folded'),
  // foldable_container.cpp:559, PROPERTY_HINT_NONE. set_title
  // (foldable_container.cpp:113-121) bare-assigns.
  title: v.quotedString('title'),
  // foldable_container.cpp:560, PROPERTY_HINT_ENUM "Left,Center,Right" (0-2). set_title_alignment:
  // `ERR_FAIL_INDEX((int)p_alignment, 3)` (foldable_container.cpp:128) refuses FILL. Button's
  // `alignment` stops at RIGHT on the hint tier only: its setter (button.cpp:737-741) assigns FILL.
  title_alignment: v.enumInt(
    'title_alignment',
    HORIZONTAL_ALIGNMENT_LEFT,
    HORIZONTAL_ALIGNMENT_RIGHT,
    HORIZONTAL_ALIGNMENT_NAMES,
    { enforced: 'foldable_container.cpp:128' }
  ),
  // foldable_container.cpp:561, PROPERTY_HINT_ENUM "Top,Bottom" (0-1). set_title_position:
  // `ERR_FAIL_INDEX(p_title_position, POSITION_MAX)`, POSITION_MAX=2 (foldable_container.h:42-46,
  // foldable_container.cpp:184).
  title_position: v.enumInt('title_position', FOLDABLE_CONTAINER_TITLE_POSITION_NAMES, {
    enforced: 'foldable_container.cpp:184',
  }),
  // foldable_container.cpp:562, PROPERTY_HINT_ENUM of 5 entries (0-4), named from
  // TextServer::OverrunBehavior (servers/text/text_server.h:123-128). The setter
  // (foldable_container.cpp:169-177) has no ERR_FAIL, so the hint warns. The TextServer enum
  // runs to 6 (text_server.h:129-130), but this class states only the hint.
  title_text_overrun_behavior: v.enumInt(
    'title_text_overrun_behavior',
    OverrunBehavior.OVERRUN_NO_TRIMMING,
    OverrunBehavior.OVERRUN_TRIM_WORD_ELLIPSIS,
    OVERRUN_BEHAVIOR_NAMES,
    { hinted: 'foldable_container.cpp:562' }
  ),
  // foldable_container.cpp:563, PROPERTY_HINT_RESOURCE_TYPE "FoldableGroup". set_foldable_group
  // (foldable_container.cpp:88-107) has no ERR_FAIL, so this checks the reference's shape only.
  foldable_group: v.resourceReference('foldable_group'),
  // foldable_container.cpp:566, PROPERTY_HINT_ENUM over TextDirection (0-3).
  // `ERR_FAIL_INDEX(int(p_text_direction), 4)` (foldable_container.cpp:156) refuses -1 too,
  // where Button's `text_direction` accepts it (button.cpp:637).
  title_text_direction: v.enumInt('title_text_direction', TEXT_DIRECTION_NAMES, {
    enforced: 'foldable_container.cpp:156',
  }),
  // foldable_container.cpp:567, PROPERTY_HINT_LOCALE_ID. set_language
  // (foldable_container.cpp:141-149) assigns any locale string.
  language: v.quotedString('language'),
});
