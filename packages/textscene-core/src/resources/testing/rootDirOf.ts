import { forwardSlashes } from '../resPath';
import type { ResRoots } from '../resRoots';

/**
 * The directory of the root of the existing file `scene`, or null for none. A root states no directory of its own, so
 * this finds the one directory above the scene whose `res://` path the root resolves back to the scene.
 */
export async function rootDirOf(roots: ResRoots, scene: string): Promise<string | null> {
  const root = await roots.rootOf(scene);
  if (root === null) return null;
  const segments = forwardSlashes(scene).split('/');
  for (let depth = 1; depth < segments.length; depth++) {
    const resolved = await root.resolve(`res://${segments.slice(depth).join('/')}`);
    if (resolved === forwardSlashes(scene)) return segments.slice(0, depth).join('/');
  }
  throw new Error(`expected a root that resolves ${scene}, got none`);
}
