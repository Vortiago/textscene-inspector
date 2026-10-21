/** A test stand-in for a SubViewport: it publishes a ViewportTexture entry with no target behind it. */

import type * as THREE from 'three';
import {
  usePublishViewportTexture,
  type TargetView,
  type ViewportTextureEntry,
} from '../contexts/ViewportTextureContext';

/** Publishes `entry` at `path`, as a SubViewport publishes its target. */
export function ViewportTexturePublisher({ path, entry }: { path: string; entry: ViewportTextureEntry }) {
  usePublishViewportTexture(path, entry);
  return null;
}

/** An entry whose `texture` serves as both views unless a test hands a view of its own. */
export function viewportEntry(
  texture: THREE.Texture,
  size: { x: number; y: number },
  views: Partial<Pick<ViewportTextureEntry, 'plain' | 'decoding'>> = {}
): ViewportTextureEntry {
  return { plain: fixedView(texture), decoding: fixedView(texture), ...views, size };
}

/** A view that needs no filling, so retaining it does nothing. */
function fixedView(texture: THREE.Texture): TargetView {
  return { texture, retain: () => () => {} };
}

/** A view that counts the consumers retaining it, and the count it reports. */
export function countingView(texture: THREE.Texture): { view: TargetView; retainers: { count: number } } {
  const retainers = { count: 0 };
  const retain = () => {
    retainers.count++;
    return () => {
      retainers.count--;
    };
  };
  return { view: { texture, retain }, retainers };
}
