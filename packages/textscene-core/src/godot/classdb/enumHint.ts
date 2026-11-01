/**
 * The labels and stored integers of a `PROPERTY_HINT_ENUM` hint, read the way
 * `EditorPropertyEnum::setup` reads them (`editor_properties.cpp:939-953`). The value
 * runs on from the previous entry; an explicit `Label:4` sets it to 4, so the next
 * implicit label is 5, not its array index. An option's label is the text before its
 * first colon, and its value is the second colon-separated slice (`get_slicec(':', 1)`),
 * read as `String::to_int`, which answers 0 for text that is not a number.
 *
 * @canonical The labels and values of a property-hint enum
 */

export interface HintEnumEntry {
  readonly label: string;
  readonly value: number;
}

/** The integer `String::to_int` reads from the text, or 0 when it starts with no number. */
function toInt(text: string): number {
  const parsed = Number.parseInt(text, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Each label of `hintString` with the integer the engine stores for it, in hint order. */
export function parseHintEnum(hintString: string): readonly HintEnumEntry[] {
  if (hintString.length === 0) return [];
  const entries: HintEnumEntry[] = [];
  let currentValue = 0;

  for (const option of hintString.split(',')) {
    const colon = option.indexOf(':');
    if (colon !== -1) {
      const rest = option.slice(colon + 1);
      const nextColon = rest.indexOf(':');
      currentValue = toInt(nextColon === -1 ? rest : rest.slice(0, nextColon));
    }
    entries.push({ label: colon === -1 ? option : option.slice(0, colon), value: currentValue });
    currentValue += 1;
  }

  return entries;
}
