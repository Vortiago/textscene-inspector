/**
 * FoldableContainer strict validators for linting.
 *
 * Declare only FoldableContainer's OWN members — the ones doc/classes/FoldableContainer.xml
 * lists without an `overrides=` attribute. Everything from Container up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * `focus_mode` and `mouse_filter` are skipped: both carry `overrides="Control"`
 * in the XML, and the constructor (foldable_container.cpp:598-600) only flips
 * the inherited default (`set_focus_mode(FOCUS_ALL)`, `set_mouse_filter(MOUSE_FILTER_STOP)`)
 * without a new `ADD_PROPERTY`, so the validator stays on Control.
 */

import '../control/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { TEXT_DIRECTION } from '../../../../linter/validators/textServerEnums.js';
import { HORIZONTAL_ALIGNMENT } from '../../../../linter/validators/globalScopeEnums.js';

validatorRegistry.registerAll('FoldableContainer', {
  // foldable_container.cpp:558, PROPERTY_HINT_NONE. set_folded
  // (foldable_container.cpp:66-82) bare-assigns.
  folded: v.boolean('folded'),
  // foldable_container.cpp:559, PROPERTY_HINT_NONE. set_title
  // (foldable_container.cpp:113-121) bare-assigns.
  title: v.quotedString('title'),
  // foldable_container.cpp:560 — PROPERTY_HINT_ENUM "Left,Center,Right" (3
  // entries, 0-2). set_title_alignment: `ERR_FAIL_INDEX((int)p_alignment, 3)`
  // (foldable_container.cpp:128) — enforced, and it matches the hint exactly.
  // Both this and Button's own `alignment` stop at RIGHT, but on different
  // tiers: this ERR_FAIL_INDEX genuinely refuses FILL, while Button's setter
  // (button.cpp:737-741) bare-assigns it and only the hint excludes it.
  title_alignment: v.enumInt('title_alignment', 0, 2, HORIZONTAL_ALIGNMENT, {
    enforced: 'foldable_container.cpp:128',
  }),
  // foldable_container.cpp:561 — PROPERTY_HINT_ENUM "Top,Bottom" (2 entries,
  // 0-1). set_title_position: `ERR_FAIL_INDEX(p_title_position, POSITION_MAX)`
  // where POSITION_MAX=2 (foldable_container.h:42-46, foldable_container.cpp:184)
  // — enforced.
  title_position: v.enumInt(
    'title_position',
    0,
    1,
    {
      0: 'POSITION_TOP',
      1: 'POSITION_BOTTOM',
    },
    { enforced: 'foldable_container.cpp:184' }
  ),
  // foldable_container.cpp:562 — PROPERTY_HINT_ENUM "Trim Nothing,Trim
  // Characters,Trim Words,Ellipsis,Word Ellipsis" (5 entries, 0-4; names taken
  // from TextServer::OverrunBehavior OVERRUN_NO_TRIMMING..OVERRUN_TRIM_WORD_ELLIPSIS,
  // servers/text/text_server.h:123-128). set_title_text_overrun_behavior
  // (foldable_container.cpp:169-177) assigns unconditionally, no ERR_FAIL — the
  // hint is the only bound Godot states here, so out of range warns rather than
  // errors. The full TextServer enum actually runs to 6 (text_server.h:129-130),
  // but nothing in this class's own source states that wider bound, so it is
  // left at what foldable_container.cpp:562 names.
  title_text_overrun_behavior: v.enumInt(
    'title_text_overrun_behavior',
    0,
    4,
    {
      0: 'OVERRUN_NO_TRIMMING',
      1: 'OVERRUN_TRIM_CHAR',
      2: 'OVERRUN_TRIM_WORD',
      3: 'OVERRUN_TRIM_ELLIPSIS',
      4: 'OVERRUN_TRIM_WORD_ELLIPSIS',
    },
    { hinted: 'foldable_container.cpp:562' }
  ),
  // foldable_container.cpp:563 — PROPERTY_HINT_RESOURCE_TYPE "FoldableGroup".
  // set_foldable_group (foldable_container.cpp:88-107) never ERR_FAILs; only
  // the reference's own shape is checked here, not its target type.
  foldable_group: v.resourceReference('foldable_group'),
  // foldable_container.cpp:566 — PROPERTY_HINT_ENUM "Auto,Left-to-Right,
  // Right-to-Left,Inherited" (4 entries, 0-3), the shared TEXT_DIRECTION table.
  // set_title_text_direction: `ERR_FAIL_INDEX(int(p_text_direction), 4)`
  // (foldable_container.cpp:156) — enforced. Unlike Button's own
  // `text_direction` (button.cpp:637 special-cases -1 as legal via a bespoke
  // `ERR_FAIL_COND`), this `ERR_FAIL_INDEX` rejects -1 too.
  title_text_direction: v.enumInt('title_text_direction', 0, 3, TEXT_DIRECTION, {
    enforced: 'foldable_container.cpp:156',
  }),
  // foldable_container.cpp:567 — PROPERTY_HINT_LOCALE_ID. set_language
  // (foldable_container.cpp:141-149) bare-assigns; any locale string parses.
  language: v.quotedString('language'),
});
