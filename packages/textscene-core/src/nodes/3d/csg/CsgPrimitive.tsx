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

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types';
import type { Node3DProperties } from '../../base/node3d/types';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { resolveStandardMaterial } from '../../../r3f/materials/resolveStandardMaterial';
import { SurfaceMaterialSlot } from '../../../r3f/materials/SurfaceMaterialSlot';
import type { MaterialSource } from '../../../r3f/materials/materialSource';
import { resolveExtResourcePath } from '../../../resources/SubResourceResolver';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import { useCsgSubtree } from '../../../r3f/contexts/CsgSubtreeContext';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { buildCsgPlan } from '../../../r3f/csg/csgPlan';
import { CsgRootMesh } from '../../../r3f/csg/CsgRootMesh';
import { shadowCastingEffects } from '../../../r3f/shadowCasting';
import { CSG_SHADOWS_ONLY_MATERIAL } from '../../../r3f/csg/csgShadowsOnlyMaterial';

const EMPTY_HIDDEN: ReadonlySet<string> = new Set();

/**
 * Marks the invisible bounds proxy.
 *
 * `frameSceneBounds` deliberately does NOT skip these. The CSG library loads
 * asynchronously and a combiner root has no solid of its own, so excluding proxies let
 * the auto-frame fit an empty scene. Including one can only frame too large, never too
 * small.
 */
export const CSG_BOUNDS_PROXY = { tscnBoundsProxy: true } as const;

interface CsgPrimitiveProps {
  node: TscnNode;
  properties: Node3DProperties & { material?: string; castShadow?: number };
  children?: ReactNode;
}

export function CsgPrimitive({ node, properties, children }: CsgPrimitiveProps) {
  const { internalResources, externalResources } = useSceneResources();
  const path = useNodePath();
  const subtree = useCsgSubtree();
  // Optional: a CSG node renders outside the shell in tests and in the
  // subtree-conformance probe, where nothing can be hidden anyway.
  const hiddenNodePaths = useOptionalSelection()?.hiddenNodePaths ?? EMPTY_HIDDEN;

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const ctx = useMemo(
    () => ({ internalResources, externalResources }),
    [internalResources, externalResources]
  );

  // The node's OWN solid comes from the same registered builder the evaluator calls, so a
  // slice defines its geometry exactly once. Memoized on the registered `geometryKey`
  // rather than on the properties object, which the parser reallocates every reparse.
  const registration = nodeComponentRegistry.getCsgShape(node.type);
  const builderProps = properties as unknown as Record<string, unknown>;
  const ownKey = registration?.geometryKey?.(builderProps, ctx) ?? node.type;
  const ownGeometry = useMemo(
    () => registration?.geometry?.(builderProps, ctx) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ownKey` IS the builder's inputs.
    [ownKey]
  );
  const geometry = ownGeometry ? <primitive object={ownGeometry} attach="geometry" /> : null;

  // A CSG `material` is as often an ExtResource `.tres` as an inline sub-resource; the
  // slot renders either, textures included.
  const materialSource = useMemo((): MaterialSource | undefined => {
    const sub = resolveStandardMaterial(properties.material, internalResources);
    if (sub) return { kind: 'scene', resource: sub };
    const path = resolveExtResourcePath(properties.material, externalResources);
    return path === null ? undefined : { kind: 'path', path };
  }, [properties.material, internalResources, externalResources]);

  // Absorbed while the ancestor's boolean is pending or ready; NOT while it has failed,
  // which is what makes every contributor start drawing itself again.
  const absorbed =
    subtree !== null && subtree.status !== 'failed' && path !== null && subtree.absorbedPaths.has(path);

  const plan = useMemo(() => {
    if (absorbed || path === null) return null;
    return buildCsgPlan(node, path, {
      hiddenPaths: hiddenNodePaths,
      lookup: (type) => {
        const shape = nodeComponentRegistry.getCsgShape(type);
        if (!shape) return null;
        return {
          hasGeometry: shape.geometry != null,
          key: (n) => shape.geometryKey?.(n.properties as Record<string, unknown>, ctx) ?? n.type,
        };
      },
    });
  }, [absorbed, node, path, hiddenNodePaths, ctx]);

  const visible = properties.visible !== false;
  const combining = plan !== null && plan.contributions.length > 1;
  const shadow = shadowCastingEffects(properties.castShadow);

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
        {geometry && (
          <mesh visible={false} userData={CSG_BOUNDS_PROXY}>
            {geometry}
          </mesh>
        )}
        {children}
      </group>
    );
  }

  // The node drawing its own solid: what a lone root IS, and what a combining root falls
  // back to while the library loads or after it failed.
  const ownSolid = geometry && (
    <mesh
      castShadow={shadow.castShadow}
      onBeforeShadow={shadow.onBeforeShadow}
      receiveShadow
    >
      {geometry}
      <SurfaceMaterialSlot source={materialSource} />
      {/* SHADOWS_ONLY: mounted last, so it is the material R3F attaches. */}
      {shadow.shadowsOnly && (
        <meshBasicMaterial
          key={CSG_SHADOWS_ONLY_MATERIAL.key}
          {...CSG_SHADOWS_ONLY_MATERIAL.props}
        />
      )}
    </mesh>
  );

  // ---- C. Combining root ----------------------------------------------------------
  if (combining) {
    return (
      <group {...transform}>
        <CsgRootMesh plan={plan} shadow={shadow} fallback={ownSolid}>
          {children}
        </CsgRootMesh>
      </group>
    );
  }

  // ---- B. Lone root ----------------------------------------------------------------
  // No evaluator, no dynamic import, no cost. This is the path every existing CSG
  // fixture takes, which is why their goldens are unchanged.
  return (
    <group {...transform}>
      {ownSolid}
      {children}
    </group>
  );
}

