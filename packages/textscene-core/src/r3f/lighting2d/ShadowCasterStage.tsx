/**
 * `<ShadowCasterStage>`: the occluder registry, and the world-space snapshot of its local segments
 * that every shadowed light reads. Flattening once here, not in each light, saves one flatten per
 * light per frame.
 */

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useFrame } from '@react-three/fiber';
import {
  createShadowCasterRegistry,
  ShadowCasterProvider,
  worldShadowCasters,
  type WorldShadowCaster,
} from './shadowCasterRegistry';

/**
 * Runs ahead of the light accumulation pre-pass (-1), so a frame that both
 * moves an occluder and accumulates lights samples before it draws.
 */
export const SHADOW_SNAPSHOT_PRIORITY = -2;

const NO_CASTERS: readonly WorldShadowCaster[] = [];

const WorldShadowCasterContext = createContext<readonly WorldShadowCaster[]>(NO_CASTERS);

/**
 * Every visible occluder in world space as of the last frame, unfiltered: a light narrows it with
 * its own `shadow_item_cull_mask`. Empty outside a stage, so a light there casts nothing.
 */
export function useWorldShadowCasters(): readonly WorldShadowCaster[] {
  return useContext(WorldShadowCasterContext);
}

/** Exact equality, coordinate by coordinate. */
export function sameWorldCasters(
  a: readonly WorldShadowCaster[],
  b: readonly WorldShadowCaster[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const one = a[i]!;
    const other = b[i]!;
    if (one.cullMode !== other.cullMode) return false;
    if (one.occluderLightMask !== other.occluderLightMask) return false;
    const left = one.segments;
    const right = other.segments;
    if (left.length !== right.length) return false;
    for (let j = 0; j < left.length; j += 1) {
      if (left[j] !== right[j]) return false;
    }
  }
  return true;
}

export function ShadowCasterStage({ children }: { children: ReactNode }) {
  const registry = useMemo(createShadowCasterRegistry, []);
  const [casters, setCasters] = useState<readonly WorldShadowCaster[]>(NO_CASTERS);
  // What the context already holds. Comparing against state inside the setter
  // would make the sample itself part of an updater React may replay.
  const published = useRef(casters);

  const sample = useCallback(() => {
    const next = worldShadowCasters(registry);
    if (sameWorldCasters(published.current, next)) return;
    published.current = next;
    setCasters(next);
  }, [registry]);

  // An occluder registers in a passive effect, so the version it bumps is what
  // brings this component back for the layout pass that can finally see it.
  const version = useSyncExternalStore(registry.subscribe, registry.version);
  // A world matrix is no React value: nothing re-renders when an AnimationPlayer moves an occluder.
  // The layout effect covers mount and React changes, since `updateWorldMatrix` needs only the
  // committed local matrices. `useFrame` covers the rest. State changes only when the numbers do.
  useLayoutEffect(sample, [sample, version]);
  useFrame(sample, SHADOW_SNAPSHOT_PRIORITY);

  return (
    <ShadowCasterProvider registry={registry}>
      <WorldShadowCasterContext.Provider value={casters}>
        {children}
      </WorldShadowCasterContext.Provider>
    </ShadowCasterProvider>
  );
}
