/**
 * <CsgPrimitive> — the shared render scaffold for every CSG slice, and the seam where
 * boolean evaluation happens.
 *
 * A CSG node takes exactly one of three shapes, decided by where it sits:
 *
 *   A. CONTRIBUTOR. Its solid belongs to an ancestor's boolean. It draws no mesh, but
 *      stays mounted and carries an INVISIBLE bounds proxy so selection and F-to-frame
 *      still know how big it is.
 *   B. LONE ROOT. A CSG root with no surviving CSG descendants. Draws its own solid
 *      directly, touching neither the evaluator nor the CSG library.
 *   C. COMBINING ROOT. Two or more contributions. Draws the evaluated result and tells
 *      its subtree, through CsgSubtreeContext, that their solids are spoken for.
 *
 * The seam is here rather than in NodeDispatcher for two hard reasons. `PlainNode` is the
 * only caller of `registerNodeObject`, so a dispatcher that skipped CSG children would
 * strip tree-selection, highlighting and the hidden-eye toggle from every one of them.
 * And `subtreeConformance.test.tsx` renders every registered type with a probe child and
 * asserts it survives, which a root that swallowed `children` would fail. So contributors
 * remove their own mesh from the inside, and the dispatcher is untouched.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import type { Node3DProperties } from '../../base/node3d/types';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { parseStandardMaterial3DScalars } from '../../../r3f/materials/standardMaterialScalars';
import { resolveStandardMaterial } from '../../../r3f/materials/resolveStandardMaterial';
import { StandardMaterialSlot } from '../../../r3f/materials/StandardMaterialSlot';
import { ExternalMaterialSlot } from '../../../r3f/materials/ExternalMaterialSlot';
import { resolveExtResourcePath } from '../../../resources/SubResourceResolver';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import {
  CsgSubtreeProvider,
  useCsgSubtree,
  type CsgSubtreeStatus,
} from '../../../r3f/contexts/CsgSubtreeContext';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { buildCsgPlan } from '../../../r3f/csg/csgPlan';
import { CsgRootMesh } from '../../../r3f/csg/CsgRootMesh';

const EMPTY_HIDDEN: ReadonlySet<string> = new Set();

/** Marks the invisible proxy so `frameSceneBounds` can leave it out of the auto-frame. */
export const CSG_BOUNDS_PROXY = { tscnBoundsProxy: true } as const;

interface CsgPrimitiveProps {
  node: TscnNode;
  properties: Node3DProperties & { material?: string };
  /**
   * The slice's own solid, already built. `null` for a node that HAS no solid:
   * CSGCombiner3D, whose shape is the boolean fold of its children.
   */
  geometry: ReactNode | null;
  children?: ReactNode;
}

export function CsgPrimitive({ node, properties, geometry, children }: CsgPrimitiveProps) {
  const { internalResources, externalResources } = useSceneResources();
  const path = useNodePath();
  const subtree = useCsgSubtree();
  // Optional: a CSG node renders outside the shell in tests and in the
  // subtree-conformance probe, where nothing can be hidden anyway.
  const hiddenNodePaths = useOptionalSelection()?.hiddenNodePaths ?? EMPTY_HIDDEN;
  const [status, setStatus] = useState<CsgSubtreeStatus>('pending');
  const onStatus = useCallback((next: CsgSubtreeStatus) => setStatus(next), []);

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const scalars = useMemo(() => {
    const sub = resolveStandardMaterial(properties.material, internalResources);
    return sub ? parseStandardMaterial3DScalars(sub.data as Record<string, string>) : null;
  }, [properties.material, internalResources]);

  // A CSG `material` is as often an ExtResource `.tres` as an inline sub-resource (33 of
  // them in scenes/demos/3d/csg/csg.tscn alone); those load through the material pipeline.
  const externalMaterialPath = useMemo(
    () => (scalars ? null : resolveExtResourcePath(properties.material, externalResources)),
    [scalars, properties.material, externalResources]
  );

  // Absorbed while the ancestor's boolean is pending or ready; NOT while it has failed,
  // which is what makes every contributor start drawing itself again.
  const absorbed =
    subtree !== null && subtree.status !== 'failed' && path !== null && subtree.absorbedPaths.has(path);

  const plan = useMemo(() => {
    if (absorbed || path === null) return null;
    return buildCsgPlan(node, path, {
      hiddenPaths: hiddenNodePaths,
      isCsgShape: (type) => nodeComponentRegistry.isCsgShape(type),
      hasGeometry: (type) => nodeComponentRegistry.getCsgShape(type)?.geometry != null,
      geometryKey: (n) => {
        const registration = nodeComponentRegistry.getCsgShape(n.type);
        return (
          registration?.geometryKey?.(n.properties as Record<string, unknown>, {
            internalResources,
            externalResources,
          }) ?? n.type
        );
      },
    });
  }, [absorbed, node, path, hiddenNodePaths, internalResources, externalResources]);

  const visible = properties.visible !== false;
  const combining = plan !== null && plan.contributions.length > 1;

  const transform = { name: node.name, position, rotation, scale, visible } as const;

  // ---- A. Contributor -------------------------------------------------------------
  if (absorbed) {
    return (
      <group {...transform}>
        {/*
          Invisible, so THREE's raycaster skips it and clicks resolve to the root exactly
          as they do in Godot's editor. But `bounds.ts` keys on `.geometry` alone and
          never consults `visible`, so per-node selection boxes and F-to-frame keep
          working for a node that draws nothing.
        */}
        {geometry !== null && (
          <mesh visible={false} userData={CSG_BOUNDS_PROXY}>
            {geometry}
          </mesh>
        )}
        {children}
      </group>
    );
  }

  const materialSlot =
    externalMaterialPath === null ? (
      <StandardMaterialSlot scalars={scalars} />
    ) : (
      <ExternalMaterialSlot path={externalMaterialPath} />
    );

  // ---- C. Combining root ----------------------------------------------------------
  if (combining) {
    return (
      <group {...transform}>
        <CsgRootMesh plan={plan} onStatus={onStatus} />
        {/*
          Wraps `children` even though the dispatcher created them: React context flows by
          render-tree position, not by where an element was constructed.
        */}
        <CsgSubtreeProvider value={{ status, absorbedPaths: plan.absorbedPaths }}>
          {children}
        </CsgSubtreeProvider>
        {/* While the library loads, or if it failed, the root shows its own solid. */}
        {status !== 'ready' && geometry !== null && (
          <mesh castShadow receiveShadow>
            {geometry}
            {materialSlot}
          </mesh>
        )}
      </group>
    );
  }

  // ---- B. Lone root ----------------------------------------------------------------
  // No evaluator, no dynamic import, no cost. This is the path every existing CSG
  // fixture takes, which is why their goldens are unchanged.
  return (
    <group {...transform}>
      {geometry !== null && (
        <mesh castShadow receiveShadow>
          {geometry}
          {materialSlot}
        </mesh>
      )}
      {children}
    </group>
  );
}

/** Re-exported so tests can assert the proxy is excluded from scene framing. */
export function isCsgBoundsProxy(object: THREE.Object3D): boolean {
  return object.userData?.tscnBoundsProxy === true;
}
