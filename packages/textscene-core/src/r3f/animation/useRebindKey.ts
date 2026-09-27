/**
 * When a driver binds again. A bind reads the scene as it stands, so a target inside a sub-scene
 * or glTF that loads later is missing from it. Each load gives the binding a chance to find it.
 */

import { useEffect, useState, type RefObject } from 'react';
import type { BoundClips } from '../contexts/AnimationDriverContext';
import { useResourceLoader } from '../../resources/useResource';
import { useLiveTreeVersion } from '../useLiveSceneTree';

/**
 * A key that changes when a load leaves `bound` stale, for a mixer effect to depend on. A load's
 * `loaded` event and the content it mounts land in one commit (`useResource`), so this effect sees
 * the new objects. A binding that is not stale keeps its mixer, and its playhead.
 */
export function useRebindKey(bound: RefObject<BoundClips | null>): number {
  const loads = useLiveTreeVersion(useResourceLoader());
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (bound.current?.isStale()) setKey((k) => k + 1);
  }, [loads, bound]);
  return key;
}
