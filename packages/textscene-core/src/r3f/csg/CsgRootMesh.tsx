/**
 * The mesh a CSG root draws: it loads the library, memoises the evaluation, draws it through the
 * surfaced mesh drawer and publishes the status to the subtree. Publishing here, not through CsgPrimitive,
 * spares the root subtree a re-render on each load transition.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import * as THREE from 'three';
import { SurfacedMeshDrawer } from '../surfacedMeshDrawer/SurfacedMeshDrawer';
import { nodeMaterial } from '../materials/materialReference';
import type { ScopedReference } from '../../resources/reading';
import { CsgSubtreeProvider, type CsgSubtreeStatus } from '../contexts/CsgSubtreeContext';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import type { CsgPlan } from './csgPlan';
import { evaluateCsgPlan, type CsgEvaluation } from './evaluateCsgPlan';
import { getCachedEvaluation, setCachedEvaluation } from './csgEvaluationCache';
import { loadCsgModule, type CsgModule } from './csgModule';
import type { CsgGeometrySetup } from './useCsgGeometryContext';
import { usePendingWhile } from '../../resources/usePendingWhile';

interface CsgRootMeshProps {
  plan: CsgPlan;
  /** What the plan's solids build against. The boolean waits while a file a solid reads loads. */
  setup: CsgGeometrySetup;
  /**
   * Set to the evaluated mesh while it draws, for the root's visibility range to measure. The mesh
   * draws as the ROOT's instance, with its `cast_shadow` and `layers`: a contributor's are absorbed.
   */
  meshRef: RefObject<THREE.Mesh | null>;
  /**
   * The root's own solid, drawn while the library loads or after it failed. Passed in
   * because building it needs the slice's material resolution, which lives in
   * CsgPrimitive.
   */
  fallback?: ReactNode;
  /** The root's scene children, which the published status has to reach. */
  children?: ReactNode;
}

export function CsgRootMesh({
  plan,
  setup: { context, isLoading },
  meshRef,
  fallback,
  children,
}: CsgRootMeshProps) {
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
    if (!csg || isLoading) return null;
    const cached = getCachedEvaluation(plan.cacheKey);
    if (cached) return cached;

    const result = evaluateCsgPlan(plan, csg, (contribution) => {
      const registration = nodeComponentRegistry.getCsgShape(contribution.type);
      if (!registration?.geometry) return null;
      return registration.geometry(contribution.node.properties as Record<string, unknown>, context);
    });
    if (result) setCachedEvaluation(plan.cacheKey, result);
    return result;
  }, [csg, isLoading, plan, context]);

  const status: CsgSubtreeStatus = loadFailed
    ? 'failed'
    : !csg || isLoading
      ? 'pending'
      : evaluation === null
        ? 'failed'
        : 'ready';
  // The library is a lazy chunk outside the resource bus. Counting it as pending lets the
  // camera's settle-fit frame the evaluated result, whenever the chunk lands.
  usePendingWhile(status === 'pending');

  const subtree = useMemo(
    () => ({ status, absorbedPaths: plan.absorbedPaths, invisiblePaths: plan.invisiblePaths, context }),
    [status, plan.absorbedPaths, plan.invisiblePaths, context]
  );

  // Resolve each output surface to a material slot. One component per slot keeps each
  // slot's `useResource` calls one set per component, so rules of hooks holds for any
  // surface count.
  const surfaces = useMemo(
    (): Array<ScopedReference | undefined> =>
      evaluation?.materials.map((address) => nodeMaterial(address, context)) ?? [],
    [evaluation, context]
  );

  const drawable = evaluation !== null && evaluation.geometry.getAttribute('position')?.count !== 0;
  const parts = useMemo(
    () =>
      evaluation ? [{ geometry: evaluation.geometry as THREE.BufferGeometry, materials: surfaces }] : [],
    [evaluation, surfaces]
  );

  return (
    <>
      {drawable && (
        // The result draws as the root's own instance, so the root's base hands it its passes.
        <SurfacedMeshDrawer parts={parts} body={{ ref: meshRef }} />
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
