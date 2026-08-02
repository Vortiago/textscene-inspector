/**
 * Button strict validators for linting.
 *
 * Declare only Button's OWN members — the ones doc/classes/Button.xml lists
 * without an `overrides=` attribute. Everything from BaseButton up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule. In
 * particular `disabled` is BaseButton's, even though parser.ts reads it here.
 *
 * Every enum below is bounded by its `PROPERTY_HINT_ENUM` entry count. The
 * alignment setters (button.cpp:737, :749, :759) assign without a clamp or an
 * ERR_FAIL, so the hint is the only stated bound; `HorizontalAlignment` and
 * `VerticalAlignment` each carry a fourth constant (FILL = 3) that Button's
 * hint does not offer and its draw path does not handle.
 */

import '../basebutton/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

const HORIZONTAL_ALIGNMENT = {
  0: 'HORIZONTAL_ALIGNMENT_LEFT',
  1: 'HORIZONTAL_ALIGNMENT_CENTER',
  2: 'HORIZONTAL_ALIGNMENT_RIGHT',
};

validatorRegistry.registerAll('Button', {
  // button.cpp:809 — PROPERTY_HINT_MULTILINE_TEXT, no length bound.
  text: v.quotedString('text'),
  // button.cpp:810 — PROPERTY_HINT_RESOURCE_TYPE "Texture2D".
  icon: v.resourceReference('icon'),
  // button.cpp:811
  flat: v.boolean('flat'),
  // button.cpp:814 — PROPERTY_HINT_ENUM "Left,Center,Right".
  alignment: v.enumInt('alignment', 0, 2, HORIZONTAL_ALIGNMENT),
  // button.cpp:815 — PROPERTY_HINT_ENUM with 7 entries; TextServer::OverrunBehavior
  // OVERRUN_NO_TRIMMING=0 … OVERRUN_TRIM_WORD_ELLIPSIS_FORCE=6
  // (servers/text/text_server.h:124-130).
  text_overrun_behavior: v.enumInt('text_overrun_behavior', 0, 6, {
    0: 'OVERRUN_NO_TRIMMING',
    1: 'OVERRUN_TRIM_CHAR',
    2: 'OVERRUN_TRIM_WORD',
    3: 'OVERRUN_TRIM_ELLIPSIS',
    4: 'OVERRUN_TRIM_WORD_ELLIPSIS',
    5: 'OVERRUN_TRIM_ELLIPSIS_FORCE',
    6: 'OVERRUN_TRIM_WORD_ELLIPSIS_FORCE',
  }),
  // button.cpp:816 — PROPERTY_HINT_ENUM "Off,Arbitrary,Word,Word (Smart)";
  // TextServer::AutowrapMode AUTOWRAP_OFF=0 … AUTOWRAP_WORD_SMART=3
  // (servers/text/text_server.h:99-102).
  autowrap_mode: v.enumInt('autowrap_mode', 0, 3, {
    0: 'AUTOWRAP_OFF',
    1: 'AUTOWRAP_ARBITRARY',
    2: 'AUTOWRAP_WORD',
    3: 'AUTOWRAP_WORD_SMART',
  }),
  // button.cpp:817 — PROPERTY_HINT_FLAGS naming two bits, but
  // set_autowrap_trim_flags (button.cpp:624) masks the incoming BitField with
  // BREAK_TRIM_MASK rather than rejecting it, so no value is invalid. Same call
  // as BaseButton's button_mask: an editor-hint width is an authoring aid.
  autowrap_trim_flags: v.int('autowrap_trim_flags', { min: 0 }),
  // button.cpp:818
  clip_text: v.boolean('clip_text'),
  // button.cpp:821 — PROPERTY_HINT_ENUM "Left,Center,Right".
  icon_alignment: v.enumInt('icon_alignment', 0, 2, HORIZONTAL_ALIGNMENT),
  // button.cpp:822 — PROPERTY_HINT_ENUM "Top,Center,Bottom".
  vertical_icon_alignment: v.enumInt('vertical_icon_alignment', 0, 2, {
    0: 'VERTICAL_ALIGNMENT_TOP',
    1: 'VERTICAL_ALIGNMENT_CENTER',
    2: 'VERTICAL_ALIGNMENT_BOTTOM',
  }),
  // button.cpp:823
  expand_icon: v.boolean('expand_icon'),
  // button.cpp:826 — PROPERTY_HINT_ENUM "Auto,Left-to-Right,Right-to-Left,Inherited";
  // Control::TextDirection aliases TextServer::DIRECTION_* 0-3
  // (scene/gui/control.h:166-171). set_text_direction (button.cpp:637) also
  // ERR_FAIL_CONDs outside -1..3, the -1 being a legacy inherited spelling that
  // maps to no named constant.
  text_direction: v.enumInt('text_direction', 0, 3, {
    0: 'TEXT_DIRECTION_AUTO',
    1: 'TEXT_DIRECTION_LTR',
    2: 'TEXT_DIRECTION_RTL',
    3: 'TEXT_DIRECTION_INHERITED',
  }),
  // button.cpp:827 — PROPERTY_HINT_LOCALE_ID; any locale string parses.
  language: v.quotedString('language'),
});
