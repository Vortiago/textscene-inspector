/** Parses a RichTextLabel: Control plus text, layout and BBCode flags. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { RichTextLabelProperties } from './types';
import { parseControl } from '../control/parser';
import { parseTextDirectionProperties } from '../../../../parser/textDirectionParser';
import { parseStructuredTextOverride } from '../../../../parser/structuredTextOverrideParser';
import { DEFAULT_JUSTIFICATION_FLAGS } from '../../../../godot/text/textServerEnums';
import { boolSlotValue } from '../../../../godot/variant/variantBool.js';
import { packedArrayBody, packedArrayForms } from '../../../../godot/variant/variantParser.js';
import { floatElements } from '../../../../resources/shapes/packedArray';
import { countedCharacters } from './visibleCharacters';
import { resolveVisibleChars } from '../shared/visibleChars';
import { parseBBCodeRuns } from './bbcode';

const PACKED_FLOAT32_ARRAY_FORMS = packedArrayForms('PackedFloat32Array');

/** `RichTextLabel.tab_stops` from a flat `PackedFloat32Array(...)` literal, else undefined, as Label does. */
function parseTabStops(value: string | undefined): number[] | undefined {
  if (value === undefined) return undefined;
  const matched = packedArrayBody(PACKED_FLOAT32_ARRAY_FORMS, value);
  if (!matched || matched.body === '') return undefined;
  try {
    return matched.flat ? floatElements(matched.body, 'PackedFloat32Array', value) : undefined;
  } catch {
    return undefined;
  }
}

/** `get_total_character_count` (`rich_text_label.cpp:7999-8014`): each text character, newline and `[img]` counts one, and a tag or a paragraph tag's line end none. */
function characterCount({ text = '', bbcodeEnabled }: RichTextLabelProperties): number {
  if (!bbcodeEnabled) return text.length;
  return countedCharacters(parseBBCodeRuns(text));
}

export function parseRichTextLabel(
  heading: ParsedHeading,
  properties: Record<string, string>
): RichTextLabelProperties {
  const result: RichTextLabelProperties = {
    ...parseControl(heading, properties),
    ...parseTextDirectionProperties(properties, 'RichTextLabel'),
    ...parseStructuredTextOverride(properties),
    justificationFlags:
      parseOptionalInt(properties.justification_flags, 'int64') ?? DEFAULT_JUSTIFICATION_FLAGS,
    clipContents: boolSlotValue(properties.clip_contents) ?? true,
    scrollActive: boolSlotValue(properties.scroll_active) ?? true,
    scrollFollowing: boolSlotValue(properties.scroll_following) === true,
    scrollFollowingVisibleCharacters: boolSlotValue(properties.scroll_following_visible_characters) === true,
  };
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.bbcodeEnabled = boolSlotValue(properties.bbcode_enabled) === true;
  result.fitContent = boolSlotValue(properties.fit_content) === true;
  result.autowrapMode = parseOptionalInt(properties.autowrap_mode);
  result.horizontalAlignment = parseOptionalInt(properties.horizontal_alignment);
  result.verticalAlignment = parseOptionalInt(properties.vertical_alignment);
  result.tabStopsPx = parseTabStops(properties.tab_stops);
  result.tabSize = parseOptionalInt(properties.tab_size);
  result.autowrapTrimFlags = parseOptionalInt(properties.autowrap_trim_flags, 'int64');
  const visibleState = resolveVisibleChars(properties, () => characterCount(result), true);
  if (visibleState) {
    result.visibleCharacters = visibleState.visibleChars;
    result.visibleRatio = visibleState.visibleRatio;
    if (visibleState.lastSetter === 'ratio') result.visibleRatioDrives = true;
  }
  result.visibleCharactersBehavior = parseOptionalInt(properties.visible_characters_behavior);
  return result;
}
