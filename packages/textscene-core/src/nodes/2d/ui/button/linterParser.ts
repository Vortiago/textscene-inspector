/**
 * Button's own validators, those doc/classes/Button.xml lists without `overrides=`.
 * BaseButton's keys, `disabled` included, arrive through the NODE_BASE_TYPES walk.
 * Each enum is bounded by its `PROPERTY_HINT_ENUM` count. The alignment setters
 * (button.cpp:737, :749, :759) take the unlisted FILL = 3 unclamped, so FILL warns.
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
import { HORIZONTAL_ALIGNMENT } from '../../../../linter/validators/globalScopeEnums.js';


validatorRegistry.registerAll('Button', {
  // button.cpp:809, PROPERTY_HINT_MULTILINE_TEXT, no length bound.
  text: v.quotedString('text'),
  // button.cpp:810, PROPERTY_HINT_RESOURCE_TYPE "Texture2D".
  icon: v.resourceReference('icon'),
  // button.cpp:811
  flat: v.boolean('flat'),
  // button.cpp:814, PROPERTY_HINT_ENUM "Left,Center,Right": 3 of the 4 HorizontalAlignment
  // constants. set_text_alignment (button.cpp:737-741) bare-assigns, so FILL warns.
  alignment: v.enumInt('alignment', 0, 2, HORIZONTAL_ALIGNMENT, { hinted: 'button.cpp:814' }),
  // button.cpp:815, PROPERTY_HINT_ENUM with 7 entries: TextServer::OverrunBehavior 0-6
  // (servers/text/text_server.h:124-130). set_text_overrun_behavior
  // (button.cpp:574-585) assigns unconditionally, no ERR_FAIL.
  text_overrun_behavior: v.enumInt('text_overrun_behavior', 0, 6, OVERRUN_BEHAVIOR, {
    hinted: 'button.cpp:815',
  }),
  // button.cpp:816, PROPERTY_HINT_ENUM "Off,Arbitrary,Word,Word (Smart)", so
  // Button offers the whole enum and the bound is the hint's own width.
  // set_autowrap_mode (button.cpp:610-615) assigns unconditionally.
  autowrap_mode: v.enumInt('autowrap_mode', 0, 3, AUTOWRAP_MODE, { hinted: 'button.cpp:816' }),
  // set_autowrap_trim_flags (button.cpp:625) stores `p_flags & BREAK_TRIM_MASK`, so a
  // bit outside the mask is dropped. button.cpp:817 hints only the two edge-space bits,
  // so BREAK_TRIM_INDENT is kept but the inspector does not offer it.
  autowrap_trim_flags: maskedBitField('autowrap_trim_flags', BREAK_TRIM_MASK, {
    enforced: 'button.cpp:625',
    labels: BREAK_TRIM_LABELS,
    hintedBits: BREAK_TRIM_HINTED_BITS,
  }),
  // button.cpp:818
  clip_text: v.boolean('clip_text'),
  // button.cpp:821, PROPERTY_HINT_ENUM "Left,Center,Right". set_icon_alignment
  // (button.cpp:749-756) bare-assigns, so FILL warns rather than erroring, the
  // same as `alignment` above.
  icon_alignment: v.enumInt('icon_alignment', 0, 2, HORIZONTAL_ALIGNMENT, {
    hinted: 'button.cpp:821',
  }),
  // button.cpp:822, PROPERTY_HINT_ENUM "Top,Center,Bottom": 3 of the 4 VerticalAlignment
  // constants. set_vertical_icon_alignment (button.cpp:759-770) bare-assigns, so FILL warns.
  vertical_icon_alignment: v.enumInt(
    'vertical_icon_alignment',
    0,
    2,
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
  // button.cpp:826, PROPERTY_HINT_ENUM over Control::TextDirection 0-3 (scene/gui/control.h:166-171).
  // set_text_direction (button.cpp:637) refuses below -1 or above 3. -1 is a legacy
  // inherited spelling with no named constant: engine-legal, so the enforced floor is -1.
  text_direction: v.enumInt('text_direction', 0, 3, TEXT_DIRECTION, {
    hinted: 'button.cpp:826',
    enforced: 'button.cpp:637',
    enforcedMin: { at: -1 },
  }),
  // button.cpp:827, PROPERTY_HINT_LOCALE_ID: any locale string parses.
  language: v.quotedString('language'),
});
