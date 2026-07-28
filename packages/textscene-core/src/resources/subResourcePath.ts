/**
 * The **Sub-resource path** grammar — `res://file.tres::SubId`.
 *
 * Godot's own notation for a resource that lives *inside* another resource
 * file: its text saver writes `<file>::<id>` as the path of every
 * `[sub_resource]`, and `ResourceLoader.load()` accepts that form. Adopting it
 * here means one string type addresses all three kinds of reference a slot can
 * carry — an `ExtResource` `.tres`, a `SubResource` of the previewed scene, and
 * a `SubResource` of some other `.tres` — so a consumer holding a resource path
 * never learns that the third kind is a category.
 *
 * The whole address is the cache key (processor caches, in-flight dedupe,
 * `useResource`'s LRU pin), while `filePath` is the only thing a
 * `ResourceProvider` or the `FileEventBus` ever sees: the bytes of a
 * sub-resource ARE the bytes of the file that owns it, and only real files can
 * be fetched, hot-reloaded, or fulfilled by a **Resource upload**.
 *
 * A `res://` path cannot contain a colon (Godot rejects it, and it is an
 * invalid Windows filename), so the separator is unambiguous and a plain path
 * round-trips untouched.
 */

/** What Godot's text saver writes between an owning file and one of its sub-resources. */
const SEPARATOR = '::';

export interface SubResourceAddress {
  /** The `res://` file that owns the resource — always fetchable as-is. */
  filePath: string;
  /**
   * The `[sub_resource id="…"]` to read inside that file. Undefined when the
   * path addresses the file's own `[resource]` body.
   */
  subResourceId?: string;
}

/**
 * Split a resource path into the file to fetch and the sub-resource to read out
 * of it. A plain path yields just `filePath`, so callers can apply this
 * unconditionally.
 */
export function parseSubResourcePath(path: string): SubResourceAddress {
  const at = path.indexOf(SEPARATOR);
  if (at < 0) return { filePath: path };
  const subResourceId = path.slice(at + SEPARATOR.length);
  // A trailing separator with nothing after it names no sub-resource; treat it
  // as the file itself rather than inventing an empty id no lookup can match.
  if (subResourceId === '') return { filePath: path.slice(0, at) };
  return { filePath: path.slice(0, at), subResourceId };
}

/** Address the `[sub_resource id="subResourceId"]` declared inside `filePath`. */
export function subResourcePath(filePath: string, subResourceId: string): string {
  return `${filePath}${SEPARATOR}${subResourceId}`;
}

/** The fetchable file behind either form of path — what the byte layer is asked for. */
export function resourceFilePath(path: string): string {
  return parseSubResourcePath(path).filePath;
}
