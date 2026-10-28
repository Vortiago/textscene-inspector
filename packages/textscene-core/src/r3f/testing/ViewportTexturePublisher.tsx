/**
 * A test stand-in for a SubViewport: it publishes a ViewportTexture entry with no pass behind it, and
 * its views as live targets, as the pass does.
 */

import { useEffect } from 'react';
import type * as THREE from 'three';
import { publishLiveTarget } from '../liveTargets';
import {
  usePublishViewportTexture,
  type TargetView,
  type ViewportTextureEntry,
} from '../contexts/ViewportTextureContext';

/** Publishes `entry` at `path`, as a SubViewport publishes its target, opaque unless `isTransparent`. */
export function ViewportTexturePublisher({
  path,
  entry,
  isTransparent = false,
}: {
  path: string;
  entry: ViewportTextureEntry;
  isTransparent?: boolean;
}) {
  useEffect(() => {
    const withdrawals = [
      publishLiveTarget(entry.plain.texture, null, isTransparent),
      publishLiveTarget(entry.decoding.texture, null, isTransparent),
    ];
    return () => withdrawals.forEach((withdraw) => withdraw());
  }, [entry, isTransparent]);
  usePublishViewportTexture(path, entry);
  return null;
}

/** An entry whose `texture` serves as both views unless a test hands a view of its own. */
export function viewportEntry(
  texture: THREE.Texture,
  size: { x: number; y: number },
  views: Partial<Pick<ViewportTextureEntry, 'plain' | 'decoding'>> = {}
): ViewportTextureEntry {
  return {
    plain: views.plain ?? fixedView(texture),
    decoding: views.decoding ?? fixedView(texture),
    size,
  };
}

/** A view that needs no filling, so retaining it does nothing. */
function fixedView(texture: THREE.Texture): TargetView {
  return { texture, retain: () => () => {} };
}

/** A view that counts its retainers, and releases once like a real one. */
export function countingView(texture: THREE.Texture): { view: TargetView; retainers: { count: number } } {
  const retainers = { count: 0 };
  const retain = () => {
    retainers.count++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      retainers.count--;
    };
  };
  return { view: { texture, retain }, retainers };
}
