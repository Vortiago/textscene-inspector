/**
 * Godot class-reference links, so a hover sends the reader to the page the engine's
 * own documentation builds. The URL shape is Godot's: a class page is
 * `class_<lowercased class>.html`, and a property anchors under its declaring class.
 */

const BASE = 'https://docs.godotengine.org/en/stable/classes/';

/** A plain property name, which the class page anchors. */
const ANCHORED_NAME_RE = /^[A-Za-z0-9_]+$/;

/** The class-reference page for a Godot class. */
export function classDocsUrl(className: string): string {
  return `${BASE}class_${className.toLowerCase()}.html`;
}

/**
 * The anchor for a property on its declaring class. An indexed name (`frame_0/duration`)
 * has no stable anchor, so it falls back to the class page.
 */
export function propertyDocsUrl(declaredBy: string, name: string): string {
  const page = classDocsUrl(declaredBy);
  if (!ANCHORED_NAME_RE.test(name)) return page;
  return `${page}#class-${declaredBy.toLowerCase()}-property-${name.toLowerCase()}`;
}
