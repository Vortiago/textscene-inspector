/**
 * The seam between LightOccluder2D and the 2D light pass. Each mounted occluder publishes its
 * local-space polygon with the group whose `matrixWorld` places it, read at pull time, so an
 * animated or instanced occluder stays right. With no provider, a registration is a silent no-op.
 */

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import type { OccluderCullMode, ShadowCasterEdges } from './shadowVolumes';

export interface ShadowCaster {
  /** Local-space `[ax,ay,0, bx,by,0, …]`: `polygonToSegments`' output verbatim. */
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
  /** Bumped on every add and withdrawal: cheap change detection for a pass. */
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
 * Publishes `caster` while it is non-null and a registry is in scope. Pass null while the occluder
 * has no resolved polygon or group, so the hook stays unconditional.
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
 * The visible casters in world-space `[ax,ay, bx,by, …]` for `buildShadowVolumes`. Omit the mask to
 * flatten once per frame and filter per light, since the flatten is the expensive half. World
 * matrices are refreshed: a `useFrame` pass runs before the renderer's `updateMatrixWorld`.
 */
export function worldShadowCasters(
  registry: ShadowCasterRegistry | null,
  shadowItemCullMask = 0xffffffff
): WorldShadowCaster[] {
  if (!registry) return [];
  const point = new THREE.Vector3();
  const out: WorldShadowCaster[] = [];

  for (const caster of registry.casters()) {
    // Godot's two gates, probed with `pnpm ref:godot --probe`: a mask of 2 against the light's
    // default 1 removes the shadow, and a hidden occluder casts nothing (VISIBILITY_CHANGED reads
    // `is_visible_in_tree()`). The CanvasItem `light_mask` is no gate.
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
