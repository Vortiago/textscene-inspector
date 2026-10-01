/**
 * The one reading of a path's file extension, shared by the texture gate, the font
 * gate and the host providers, so they cannot disagree about the same path.
 */

/**
 * The file extension of a path, dot-prefixed and lowercased, or null when the
 * path has none. A dot inside a directory name is not an extension.
 */
export function fileExtension(path: string): string | null {
  const dot = path.lastIndexOf('.');
  if (dot === -1 || dot < path.lastIndexOf('/')) return null;
  return path.slice(dot).toLowerCase();
}
