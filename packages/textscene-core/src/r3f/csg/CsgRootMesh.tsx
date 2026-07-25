/**
 * The single drawn mesh a CSG root produces, and the state machine around getting it.
 *
 * Owns three things a pure function cannot: loading the CSG library, memoizing the
 * evaluation across reparses, and mounting one material slot per output surface.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { parseStandardMaterial3DScalars } from '../materials/standardMaterialScalars';
import { resolveStandardMaterial } from '../materials/resolveStandardMaterial';
import { StandardMaterialSlot } from '../materials/StandardMaterialSlot';
import { ExternalMaterialSlot } from '../materials/ExternalMaterialSlot';
import { resolveExtResourcePath } from '../../resources/SubResourceResolver';
import { useSceneResources } from '../SceneResourcesContext';
import type { CsgSubtreeStatus } from '../contexts/CsgSubtreeContext';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import type { CsgPlan } from './csgPlan';
import { evaluateCsgPlan, type CsgEvaluation } from './evaluateCsgPlan';
import { getCachedEvaluation, setCachedEvaluation } from './csgEvaluationCache';
import { loadCsgModule, type CsgModule } from './csgModule';

export interface CsgRootMeshProps {
  plan: CsgPlan;
  /** Reported upward so the root can publish it to its contributors. */
  onStatus: (status: CsgSubtreeStatus) => void;
}

export function CsgRootMesh({ plan, onStatus }: CsgRootMeshProps) {
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

  useEffect(() => {
    onStatus(status);
  }, [status, onStatus]);

  // Resolve each output surface to a material slot. One component per slot keeps
  // ExternalMaterialSlot's useResource call one-per-component, so rules of hooks holds
  // for any surface count.
  const surfaces = useMemo(() => {
    if (!evaluation) return [];
    return evaluation.surfaceSlots.map((planSurface) => {
      const reference = plan.surfaces[planSurface];
      const sub = resolveStandardMaterial(reference, internalResources);
      return {
        scalars: sub ? parseStandardMaterial3DScalars(sub.data as Record<string, string>) : null,
        externalPath: sub ? null : resolveExtResourcePath(reference, externalResources),
      };
    });
  }, [evaluation, plan.surfaces, internalResources, externalResources]);

  if (!evaluation || evaluation.geometry.getAttribute('position')?.count === 0) return null;

  return (
    <mesh castShadow receiveShadow geometry={evaluation.geometry as THREE.BufferGeometry}>
      {surfaces.map((surface, index) => {
        // A single-surface mesh keeps the SINGULAR attach key, so `mesh.material` stays
        // one material rather than a length-1 array.
        const attach = surfaces.length > 1 ? `material-${index}` : 'material';
        return surface.externalPath === null ? (
          <StandardMaterialSlot key={index} scalars={surface.scalars} attach={attach} />
        ) : (
          <ExternalMaterialSlot key={index} path={surface.externalPath} attach={attach} />
        );
      })}
    </mesh>
  );
}
