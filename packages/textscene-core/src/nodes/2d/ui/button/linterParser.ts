/**
 * Button strict validators for linting.
 *
 * Declare only Button's OWN members — the ones doc/classes/Button.xml lists
 * without an `overrides=` attribute. Everything from BaseButton up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule. In
 * particular `disabled` is BaseButton's, even though parser.ts reads it here.
 *
 * Every enum below is bounded by its `PROPERTY_HINT_ENUM` entry count, except
 * `alignment`/`icon_alignment`/`vertical_icon_alignment`: the alignment
 * setters (button.cpp:737, :749, :759) assign without a clamp or an ERR_FAIL,
 * and `HorizontalAlignment`/`VerticalAlignment` each carry a fourth constant
 * (FILL = 3, doc/classes/@GlobalScope.xml:1718/:1730) that Button's own hint
 * does not list. A validity bound is what the setter accepts, not what the
 * hint's dropdown offers or what the draw path happens to handle, so those
 * three widen to the real 4-value extent.
 */

import '../basebutton/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { maskedBitField, v } from '../../../../linter/validators/index.js';
import {
  AUTOWRAP_MODE,
  BREAK_TRIM_HINTED_BITS,
  BREAK_TRIM_LABELS,
  BREAK_TRIM_MASK,
  OVERRUN_BEHAVIOR,
  TEXT_DIRECTION,
} from '../../../../linter/validators/textServerEnums.js';

const HORIZONTAL_ALIGNMENT = {
  0: 'HORIZONTAL_ALIGNMENT_LEFT',
  1: 'HORIZONTAL_ALIGNMENT_CENTER',
  2: 'HORIZONTAL_ALIGNMENT_RIGHT',
  3: 'HORIZONTAL_ALIGNMENT_FILL',
};

validatorRegistry.registerAll('Button', {
  // button.cpp:809 — PROPERTY_HINT_MULTILINE_TEXT, no length bound.
  text: v.quotedString('text'),
  // button.cpp:810 — PROPERTY_HINT_RESOURCE_TYPE "Texture2D".
  icon: v.resourceReference('icon'),
  // button.cpp:811
  flat: v.boolean('flat'),
  // button.cpp:814 — PROPERTY_HINT_ENUM "Left,Center,Right" only labels 3 of
  // the 4 HorizontalAlignment constants; set_text_alignment (button.cpp:737-741)
  // bare-assigns with no ERR_FAIL, so FILL reaches the engine same as the
  // other three. Widened to the real 0-3 extent (see file header).
  alignment: v.enumInt('alignment', 0, 3, HORIZONTAL_ALIGNMENT, { hinted: 'button.cpp:814' }),
  // button.cpp:815 — PROPERTY_HINT_ENUM with 7 entries; TextServer::OverrunBehavior
  // OVERRUN_NO_TRIMMING=0 … OVERRUN_TRIM_WORD_ELLIPSIS_FORCE=6
  // (servers/text/text_server.h:124-130). set_text_overrun_behavior
  // (button.cpp:574-585) assigns unconditionally, no ERR_FAIL.
  text_overrun_behavior: v.enumInt('text_overrun_behavior', 0, 6, OVERRUN_BEHAVIOR, {
    hinted: 'button.cpp:815',
  }),
  // button.cpp:816 — PROPERTY_HINT_ENUM "Off,Arbitrary,Word,Word (Smart)", so
  // Button offers the whole enum and the bound is the hint's own width.
  // set_autowrap_mode (button.cpp:610-615) assigns unconditionally.
  autowrap_mode: v.enumInt('autowrap_mode', 0, 3, AUTOWRAP_MODE, { hinted: 'button.cpp:816' }),
  // set_autowrap_trim_flags (button.cpp:625) stores `p_flags &
  // BREAK_TRIM_MASK`, so bits outside the mask are dropped and the stored value
  // is not the written one. button.cpp:817 hints only the two edge-space bits,
  // narrower than the mask, so BREAK_TRIM_INDENT is kept but not offered by the
  // inspector.
  autowrap_trim_flags: maskedBitField('autowrap_trim_flags', BREAK_TRIM_MASK, {
    enforced: 'button.cpp:625',
    labels: BREAK_TRIM_LABELS,
    hintedBits: BREAK_TRIM_HINTED_BITS,
  }),
  // button.cpp:818
  clip_text: v.boolean('clip_text'),
  // button.cpp:821 — PROPERTY_HINT_ENUM "Left,Center,Right". set_icon_alignment
  // (button.cpp:749-756) bare-assigns with no ERR_FAIL; widened to 0-3 for the
  // same FILL reason as `alignment` above.
  icon_alignment: v.enumInt('icon_alignment', 0, 3, HORIZONTAL_ALIGNMENT, {
    hinted: 'button.cpp:821',
  }),
  // button.cpp:822 — PROPERTY_HINT_ENUM "Top,Center,Bottom" only labels 3 of
  // the 4 VerticalAlignment constants; set_vertical_icon_alignment
  // (button.cpp:759-770) bare-assigns with no ERR_FAIL, so FILL (=3,
  // doc/classes/@GlobalScope.xml:1730) reaches the engine same as the others.
  vertical_icon_alignment: v.enumInt(
    'vertical_icon_alignment',
    0,
    3,
    {
      0: 'VERTICAL_ALIGNMENT_TOP',
      1: 'VERTICAL_ALIGNMENT_CENTER',
      2: 'VERTICAL_ALIGNMENT_BOTTOM',
      3: 'VERTICAL_ALIGNMENT_FILL',
    },
    { hinted: 'button.cpp:822' }
  ),
  // button.cpp:823
  expand_icon: v.boolean('expand_icon'),
  // button.cpp:826 — PROPERTY_HINT_ENUM "Auto,Left-to-Right,Right-to-Left,Inherited";
  // Control::TextDirection aliases TextServer::DIRECTION_* 0-3
  // (scene/gui/control.h:166-171). set_text_direction (button.cpp:637):
  // `ERR_FAIL_COND((int)p_text_direction < -1 || (int)p_text_direction > 3)` —
  // enforced, and -1 is a legacy inherited spelling with no named constant,
  // so it is engine-legal but unlabelled here. Widened from 0-3 to include it.
  text_direction: v.enumInt('text_direction', -1, 3, TEXT_DIRECTION, {
    enforced: 'button.cpp:637',
  }),
  // button.cpp:827 — PROPERTY_HINT_LOCALE_ID; any locale string parses.
  language: v.quotedString('language'),
});
