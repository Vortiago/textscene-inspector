/**
 * The mesh a CSG root draws: it loads the library, memoises the evaluation, mounts one material slot
 * per surface and publishes the status to the subtree. Publishing here, not through CsgPrimitive,
 * spares the root subtree a re-render on each load transition.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { SurfaceMaterialSlot } from '../materials/SurfaceMaterialSlot';
import { resolveMaterialSource, type MaterialSource } from '../materials/materialSource';
import { useSceneResources } from '../SceneResourcesContext';
import { CsgSubtreeProvider, type CsgSubtreeStatus } from '../contexts/CsgSubtreeContext';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import type { CsgPlan } from './csgPlan';
import { evaluateCsgPlan, type CsgEvaluation } from './evaluateCsgPlan';
import { getCachedEvaluation, setCachedEvaluation } from './csgEvaluationCache';
import { loadCsgModule, type CsgModule } from './csgModule';
import type { ShadowCastingEffects } from '../shadowCasting';
import { CSG_SHADOWS_ONLY_MATERIAL } from './csgShadowsOnlyMaterial';

export interface CsgRootMeshProps {
  plan: CsgPlan;
  /** The ROOT's `cast_shadow`; a contributor's own is absorbed with its solid. */
  shadow: ShadowCastingEffects;
  /**
   * The root's own solid, drawn while the library loads or after it failed. Passed in
   * because building it needs the slice's material resolution, which lives in
   * CsgPrimitive.
   */
  fallback?: ReactNode;
  /** The root's scene children, which the published status has to reach. */
  children?: ReactNode;
}

export function CsgRootMesh({ plan, shadow, fallback, children }: CsgRootMeshProps) {
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

  const subtree = useMemo(
    () => ({ status, absorbedPaths: plan.absorbedPaths, invisiblePaths: plan.invisiblePaths }),
    [status, plan.absorbedPaths, plan.invisiblePaths]
  );

  // Resolve each output surface to a material slot. One component per slot keeps
  // ExternalMaterialSlot's useResource call one-per-component, so rules of hooks holds
  // for any surface count.
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
          onBeforeShadow={shadow.onBeforeShadow}
          receiveShadow
          geometry={evaluation!.geometry as THREE.BufferGeometry}
        >
          {/* SHADOWS_ONLY draws no colour, so no surface material mounts: one would leave
              this substitution resting on r3f's attach order, which a later slot remount
              (an external `.tres` landing, a program key moving) undoes. */}
          {shadow.shadowsOnly ? (
            <meshBasicMaterial
              key={CSG_SHADOWS_ONLY_MATERIAL.key}
              {...CSG_SHADOWS_ONLY_MATERIAL.props}
            />
          ) : (
            surfaces.map((surface, index) => {
              // A single-surface mesh keeps the singular attach key, so `mesh.material`
              // stays one material rather than a length-1 array.
              const attach = surfaces.length > 1 ? `material-${index}` : 'material';
              return <SurfaceMaterialSlot key={index} source={surface} attach={attach} />;
            })
          )}
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
