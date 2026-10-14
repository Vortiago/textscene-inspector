/** A test stand-in for a SubViewport: it publishes a ViewportTexture entry with no target behind it. */

import { usePublishViewportTexture, type ViewportTextureEntry } from '../contexts/ViewportTextureContext';

/** Publishes `entry` at `path`, as a SubViewport publishes its target. */
export function ViewportTexturePublisher({ path, entry }: { path: string; entry: ViewportTextureEntry }) {
  usePublishViewportTexture(path, entry);
  return null;
}
