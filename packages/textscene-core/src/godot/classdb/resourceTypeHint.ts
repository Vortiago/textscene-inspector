/**
 * Reads a `PROPERTY_HINT_RESOURCE_TYPE` hint string the way the editor's resource picker does
 * (`editor_resource_picker.cpp:824-833`): each comma part is stripped, and a part after a `-`
 * names a class the slot excludes (`object.h:68`). The picker erases the exact name, so a
 * subclass of an excluded class stays allowed. It imports nothing, so the generator that writes
 * `resourceTypeExclusions.generated.ts` runs this parse under plain `node`.
 */

interface ResourceTypeHint {
  /** The classes the slot accepts, each with its subclasses. */
  readonly bases: readonly string[];
  /** The exact class names the slot refuses, though a base admits them. */
  readonly excluded: readonly string[];
}

export function resourceTypeHint(hintString: string): ResourceTypeHint {
  const bases: string[] = [];
  const excluded: string[] = [];
  for (const raw of hintString.split(',')) {
    const part = raw.trim();
    if (part.startsWith('-')) excluded.push(part.slice(1));
    else if (part.length > 0) bases.push(part);
  }
  return { bases, excluded };
}
