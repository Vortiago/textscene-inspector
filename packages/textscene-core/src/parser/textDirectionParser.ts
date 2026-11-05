/** Parses the `text_direction` and `language` properties every text node has. */

import { unquoteString } from './utils';
import { settableIntOr } from './valueParsers';
import { TextDirection } from '../godot/text/textServerEnums';
import type { TextDirectionProperties } from '../godot/text/paragraphDirection';

/**
 * Each `set_text_direction` refuses a value outside -1..3 (`label.cpp:1140`, `button.cpp:637`,
 * `label_3d.cpp:705`), so the default stays. FoldableContainer's `ERR_FAIL_INDEX` refuses -1 too
 * (`foldable_container.cpp:156`), so it passes a minimum of 0.
 */
export function parseTextDirection(value: string | undefined, context: string, minimum = -1): number {
  return settableIntOr(
    value,
    TextDirection.TEXT_DIRECTION_AUTO,
    { min: minimum, max: TextDirection.TEXT_DIRECTION_INHERITED },
    context
  );
}

/** `language`: empty when absent, which takes the locale. */
export function parseLanguage(value: string | undefined): string {
  return value === undefined ? '' : unquoteString(value);
}

/** `text_direction` and `language` under their own names, as every type but FoldableContainer stores them. */
export function parseTextDirectionProperties(
  properties: Record<string, string>,
  owner: string
): TextDirectionProperties {
  return {
    textDirection: parseTextDirection(properties.text_direction, `${owner}.text_direction`),
    language: parseLanguage(properties.language),
  };
}
