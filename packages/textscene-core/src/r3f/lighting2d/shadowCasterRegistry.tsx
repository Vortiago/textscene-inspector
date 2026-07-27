/**
 * The seam between LightOccluder2D and the 2D light pass.
 *
 * An occluder is not a light and does not draw: it only has to be FINDABLE by
 * whichever light is being accumulated. Each `<LightOccluder2D>` publishes its
 * polygon here for as long as it is mounted, and the pass pulls the whole set
 * once per light. Nothing in the occluder slice knows a light pass exists, and
 * with no provider mounted every registration is a silent no-op — the outline
 * gizmo keeps working on its own.
 *
 * Segments are stored in the occluder's LOCAL space, exactly as
 * `polygonToSegments` produces them, paired with the THREE group whose
 * `matrixWorld` places them. That is what keeps an occluder inside an animated
 * or instanced sub-scene correct: the transform is read at pull time, not baked
 * at mount time.
 *
 * Two gates are Godot's, both measured (`pnpm ref:godot --probe`):
 *  - `occluder_light_mask & Light2D.shadow_item_cull_mask` must be non-zero.
 *    A mask of 2 against the light's default of 1 removes the shadow outright.
 *  - a hidden occluder casts nothing, matching `LightOccluder2D`'s
 *    VISIBILITY_CHANGED handler, which disables the occluder on
 *    `is_visible_in_tree()`. The CanvasItem `light_mask` is NOT a gate: setting
 *    it to 4 on the occluder leaves the shadow untouched.
 */

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import type { OccluderCullMode, ShadowCasterEdges } from './shadowVolumes';

export interface ShadowCaster {
  /** Local-space `[ax,ay,0, bx,by,0, …]` — `polygonToSegments`' output verbatim. */
  segments: Float32Array;
  cullMode: OccluderCullMode;
  /** `LightOccluder2D.occluder_light_mask`. */
  occluderLightMask: number;
  /** The occluder's CanvasItem group; its `matrixWorld` is the occluder's transform. */
  object: THREE.Object3D;
}

export interface ShadowCasterRegistry {
  /** Publish a caster; the returned function withdraws it. */
  add(caster: ShadowCaster): () => void;
  casters(): readonly ShadowCaster[];
  /** Bumped on every add and withdrawal — cheap change detection for a pass. */
  version(): number;
  /** For `useSyncExternalStore`, when the pass renders casters declaratively. */
  subscribe(listener: () => void): () => void;
}

export function createShadowCasterRegistry(): ShadowCasterRegistry {
  const entries = new Set<ShadowCaster>();
  const listeners = new Set<() => void>();
  let version = 0;

  const changed = () => {
    version++;
    for (const listener of listeners) listener();
  };

  return {
    add(caster) {
      entries.add(caster);
      changed();
      return () => {
        if (entries.delete(caster)) changed();
      };
    },
    casters: () => [...entries],
    version: () => version,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const ShadowCasterContext = createContext<ShadowCasterRegistry | null>(null);

export function ShadowCasterProvider({
  registry,
  children,
}: {
  /** Supply one to share it with a pass outside this subtree; omit for a fresh one. */
  registry?: ShadowCasterRegistry;
  children: ReactNode;
}) {
  const own = useMemo(() => registry ?? createShadowCasterRegistry(), [registry]);
  return <ShadowCasterContext.Provider value={own}>{children}</ShadowCasterContext.Provider>;
}

/** The enclosing registry, or null when no pass is mounted above this subtree. */
export function useShadowCasterRegistry(): ShadowCasterRegistry | null {
  return useContext(ShadowCasterContext);
}

/**
 * Publish `caster` for as long as it is non-null and a registry is in scope.
 * Pass null while the occluder has no resolved polygon (or no group yet) — the
 * hook stays unconditional, which is what the rules of hooks require.
 */
export function useShadowCaster(caster: ShadowCaster | null): void {
  const registry = useShadowCasterRegistry();
  useEffect(() => {
    if (!registry || !caster) return;
    return registry.add(caster);
  }, [registry, caster]);
}

/** Godot's `is_visible_in_tree()`: any hidden ancestor hides the occluder. */
export function visibleInTree(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    if (!o.visible) return false;
  }
  return true;
}

export interface WorldShadowCaster extends ShadowCasterEdges {
  /** Kept alongside the geometry so one flatten can serve every light. */
  occluderLightMask: number;
}

/**
 * The visible casters, flattened into world-space `[ax,ay, bx,by, …]` ready for
 * `buildShadowVolumes`.
 *
 * Pass a light's `shadow_item_cull_mask` to get just that light's casters, or
 * omit it, flatten once per frame, and filter the result on
 * `occluderLightMask & mask` per light — the flatten is the expensive half.
 *
 * World matrices are refreshed here rather than trusted: a pass running in
 * `useFrame` executes BEFORE the renderer's own `updateMatrixWorld`, so reading
 * `matrixWorld` raw lags an animated occluder by a frame.
 */
export function worldShadowCasters(
  registry: ShadowCasterRegistry | null,
  shadowItemCullMask = 0xffffffff
): WorldShadowCaster[] {
  if (!registry) return [];
  const point = new THREE.Vector3();
  const out: WorldShadowCaster[] = [];

  for (const caster of registry.casters()) {
    if ((caster.occluderLightMask & shadowItemCullMask) === 0) continue;
    if (!visibleInTree(caster.object)) continue;

    const { segments } = caster;
    const points = Math.floor(segments.length / 3);
    if (points < 2) continue;

    caster.object.updateWorldMatrix(true, false);
    const world = new Float32Array(points * 2);
    for (let i = 0; i < points; i++) {
      point.set(segments[i * 3]!, segments[i * 3 + 1]!, segments[i * 3 + 2]!);
      point.applyMatrix4(caster.object.matrixWorld);
      world[i * 2] = point.x;
      world[i * 2 + 1] = point.y;
    }
    out.push({
      segments: world,
      cullMode: caster.cullMode,
      occluderLightMask: caster.occluderLightMask,
    });
  }

  return out;
}
