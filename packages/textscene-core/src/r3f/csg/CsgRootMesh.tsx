/**
 * The mesh a CSG root draws: it loads the library, memoises the evaluation, mounts one material slot
 * per surface and publishes the status to the subtree. Publishing here, not through CsgPrimitive,
 * spares the root subtree a re-render on each load transition.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { SurfaceMaterialSlots } from '../materials/SurfaceMaterialSlots';
import { resolveMaterialSource, type MaterialSource } from '../materials/materialSource';
import { useSceneResources } from '../SceneResourcesContext';
import { CsgSubtreeProvider, type CsgSubtreeStatus } from '../contexts/CsgSubtreeContext';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import type { CsgPlan } from './csgPlan';
import { evaluateCsgPlan, type CsgEvaluation } from './evaluateCsgPlan';
import { getCachedEvaluation, setCachedEvaluation } from './csgEvaluationCache';
import { loadCsgModule, type CsgModule } from './csgModule';
import { usePendingWhile } from '../../resources/usePendingWhile';
import type { ShadowCastingEffects } from '../shadowCasting';

export interface CsgRootMeshProps {
  plan: CsgPlan;
  /** The ROOT's `cast_shadow`; a contributor's own is absorbed with its solid. */
  shadow: ShadowCastingEffects;
  /** The ROOT's `transparency`; a contributor's own is absorbed with its solid. */
  instanceTransparency: number;
  /**
   * The root's own solid, drawn while the library loads or after it failed. Passed in
   * because building it needs the slice's material resolution, which lives in
   * CsgPrimitive.
   */
  fallback?: ReactNode;
  /** The root's scene children, which the published status has to reach. */
  children?: ReactNode;
}

export function CsgRootMesh({ plan, shadow, instanceTransparency, fallback, children }: CsgRootMeshProps) {
  const { internalResources, externalResources } = useSceneResources();
  const [csg, setCsg] = useState<CsgModule | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    // Effect + state rather than React.lazy/Suspense: <Canvas> mounts its own
    // reconciler root, so a suspended CSG root would blank its SIBLINGS while it
    // waited. CollisionGizmo uses the same idiom for the same reason.
    let cancelled = false;
    loadCsgModule().then(
      (module) => {
        if (!cancelled) setCsg(module);
      },
      () => {
        if (!cancelled) setLoadFailed(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const evaluation = useMemo<CsgEvaluation | null>(() => {
    if (!csg) return null;
    const cached = getCachedEvaluation(plan.cacheKey);
    if (cached) return cached;

    const ctx = { internalResources, externalResources };
    const result = evaluateCsgPlan(plan, csg, (contribution) => {
      const registration = nodeComponentRegistry.getCsgShape(contribution.type);
      if (!registration?.geometry) return null;
      return registration.geometry(contribution.node.properties as Record<string, unknown>, ctx);
    });
    if (result) setCachedEvaluation(plan.cacheKey, result);
    return result;
  }, [csg, plan, internalResources, externalResources]);

  const status: CsgSubtreeStatus = loadFailed
    ? 'failed'
    : !csg
      ? 'pending'
      : evaluation === null
        ? 'failed'
        : 'ready';
  // The library is a lazy chunk outside the resource bus. Counting it as pending lets the
  // camera's settle-fit frame the evaluated result, whenever the chunk lands.
  usePendingWhile(status === 'pending');

  const subtree = useMemo(
    () => ({ status, absorbedPaths: plan.absorbedPaths, invisiblePaths: plan.invisiblePaths }),
    [status, plan.absorbedPaths, plan.invisiblePaths]
  );

  // Resolve each output surface to a material slot. One component per slot keeps each
  // slot's `useResource` calls one set per component, so rules of hooks holds for any
  // surface count.
  const surfaces = useMemo((): Array<MaterialSource | undefined> => {
    if (!evaluation) return [];
    return evaluation.surfaceSlots.map((planSurface) =>
      resolveMaterialSource(plan.surfaces[planSurface], internalResources, externalResources)
    );
  }, [evaluation, plan.surfaces, internalResources, externalResources]);

  const drawable = evaluation !== null && evaluation.geometry.getAttribute('position')?.count !== 0;

  return (
    <>
      {drawable && (
        <mesh
          castShadow={shadow.castShadow}
          onBeforeRender={shadow.onBeforeRender}
          onAfterRender={shadow.onAfterRender}
          onBeforeShadow={shadow.onBeforeShadow}
          onAfterShadow={shadow.onAfterShadow}
          receiveShadow
          geometry={evaluation!.geometry as THREE.BufferGeometry}
        >
          <SurfaceMaterialSlots sources={surfaces} instanceTransparency={instanceTransparency} />
        </mesh>
      )}
      {/*
        Wraps `children` even though the dispatcher created them: React context flows by
        render-tree position, not by where an element was constructed.
      */}
      <CsgSubtreeProvider value={subtree}>{children}</CsgSubtreeProvider>
      {status !== 'ready' && fallback}
    </>
  );
}
