/**
 * <ShadowCasterStage> — the occluder registry plus the once-per-frame world
 * snapshot every shadowed light reads.
 *
 * An occluder publishes LOCAL segments against the group that carries its
 * transform (`shadowCasterRegistry`), so somebody has to flatten them into
 * world space, and that flatten is the expensive half: doing it inside each
 * light would repeat it once per light per frame. It happens here instead,
 * once, and the result is shared.
 *
 * WHY A SAMPLE AND NOT A RENDER-TIME READ. A world matrix is not a React value:
 * it is the product of every ancestor's transform, and nothing re-renders when
 * an AnimationPlayer moves an occluder. So the snapshot is taken twice over —
 * in a LAYOUT EFFECT, which covers mounting and every React-driven change (the
 * local matrices are already committed by then, and `updateWorldMatrix`
 * recomputes the chain from them, so no frame has to have run), and in
 * `useFrame`, which covers the movement React never hears about.
 *
 * Either way it is published as state ONLY when the numbers actually changed,
 * so a static scene settles during mount and costs nothing afterwards, while a
 * moving occluder costs one React render per frame — the price of being right.
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
 * Every visible occluder in world space as of the last frame, unfiltered — a
 * light narrows it with its own `shadow_item_cull_mask`. Empty outside a stage,
 * which is what makes a light with no occluder registry simply cast nothing.
 */
export function useWorldShadowCasters(): readonly WorldShadowCaster[] {
  return useContext(WorldShadowCasterContext);
}

/** Do two snapshots describe the same geometry, down to the coordinate? */
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
