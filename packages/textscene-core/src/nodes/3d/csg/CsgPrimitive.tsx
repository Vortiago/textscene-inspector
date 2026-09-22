/**
 * <CsgPrimitive> — the shared render scaffold for every CSG slice, and the seam where
 * boolean evaluation happens.
 *
 * A CSG node takes exactly one of four shapes, decided by where it sits:
 *
 *   A. CONTRIBUTOR. Its solid belongs to an ancestor's boolean. It draws no mesh, but
 *      stays mounted and carries an INVISIBLE bounds proxy so selection and F-to-frame
 *      still know how big it is.
 *   B. LONE ROOT. A CSG root with no surviving CSG descendants. Draws its own solid
 *      directly, touching neither the evaluator nor the CSG library.
 *   C. COMBINING ROOT. Two or more contributions. Draws the evaluated result and tells
 *      its subtree, through CsgSubtreeContext, that their solids are spoken for.
 *   D. SKIPPED. Invisible, so its CSG parent's boolean never reached it. Draws nothing
 *      and bounds to a POINT, which is all Godot has for it either.
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
import { SurfaceMaterialSlot } from '../../../r3f/materials/SurfaceMaterialSlot';
import { resolveMaterialSource } from '../../../r3f/materials/materialSource';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import { CsgSubtreeProvider, useCsgSubtree } from '../../../r3f/contexts/CsgSubtreeContext';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { buildCsgPlan } from '../../../r3f/csg/csgPlan';
import { CsgRootMesh } from '../../../r3f/csg/CsgRootMesh';
import { shadowCastingEffects } from '../../../r3f/shadowCasting';
import { CSG_SHADOWS_ONLY_MATERIAL } from '../../../r3f/csg/csgShadowsOnlyMaterial';

const NO_PATHS: ReadonlySet<string> = new Set();

/**
 * Marks the invisible bounds proxy, which `frameSceneBounds` counts: Godot's own AABB for a
 * VISIBLE contributor is its unevaluated brush (`modules/csg/csg_shape.cpp:470,507`). An
 * invisible one the recursion never reached gets a ZERO-SIZE proxy instead — the point
 * Godot has for it. It is also all a combiner root has to frame on while the library loads.
 */
export const CSG_BOUNDS_PROXY = { tscnBoundsProxy: true } as const;

interface CsgPrimitiveProps {
  node: TscnNode;
  properties: Node3DProperties & { materialPath?: string; castShadow?: number };
  children?: ReactNode;
}

export function CsgPrimitive({ node, properties, children }: CsgPrimitiveProps) {
  const { internalResources, externalResources } = useSceneResources();
  const path = useNodePath();
  const subtree = useCsgSubtree();
  // Optional: a CSG node renders outside the shell in tests and in the
  // subtree-conformance probe, where nothing can be hidden anyway.
  const hiddenNodePaths = useOptionalSelection()?.hiddenNodePaths ?? NO_PATHS;

  // `_get_brush()` skips an invisible child (csg_shape.cpp:469) BEFORE writing its
  // node_aabb, so Godot has only a point at its origin — a root, whose own build runs
  // whatever its visibility, still has its full box. Decided before the work below, which
  // a skipped node would only throw away.
  const skipped = subtree !== null && path !== null && subtree.invisiblePaths.has(path);

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
    () => (skipped ? null : (registration?.geometry?.(builderProps, ctx) ?? null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ownKey` IS the builder's inputs.
    [ownKey, skipped]
  );
  const geometry = ownGeometry ? <primitive object={ownGeometry} attach="geometry" /> : null;

  // A CSG `material` is as often an ExtResource `.tres` as an inline sub-resource, and a
  // CSG primitive keeps only a `Ref<Material>` (`modules/csg/csg_shape.h:276,290`) — so
  // both arrive at the same slot, which renders either, textures included.
  const materialSource = useMemo(
    () => resolveMaterialSource(properties.materialPath, internalResources, externalResources),
    [properties.materialPath, internalResources, externalResources]
  );

  // Absorbed while the ancestor's boolean is pending or ready; NOT while it has failed,
  // which is what makes every contributor start drawing itself again.
  const absorbed =
    subtree !== null && subtree.status !== 'failed' && path !== null && subtree.absorbedPaths.has(path);

  const plan = useMemo(() => {
    if (absorbed || skipped || path === null) return null;
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
  }, [absorbed, skipped, node, path, hiddenNodePaths, ctx]);

  // A node with no plan of its own passes the enclosing root's value straight through:
  // what its descendants are is that root's answer, not its own. Mounted by every branch
  // that owns no evaluator, so crossing between them reconciles rather than remounting;
  // a combining root publishes the same value through CsgRootMesh, which owns the status.
  const publishedSubtree = useMemo(
    () =>
      plan === null
        ? subtree
        : { status: 'ready' as const, absorbedPaths: NO_PATHS, invisiblePaths: plan.invisiblePaths },
    [plan, subtree]
  );
  const scope = <CsgSubtreeProvider value={publishedSubtree}>{children}</CsgSubtreeProvider>;

  const visible = properties.visible !== false;
  const combining = plan !== null && plan.geometryCount > 1;
  const shadow = shadowCastingEffects(properties.castShadow);

  const transform = { name: node.name, position, rotation, scale, visible } as const;

  // ---- A. Contributor / D. Skipped for invisibility ---------------------------------
  // Neither draws a solid, and both stay mounted so tree-selection, highlighting and the
  // hidden-eye toggle keep working. The proxy is invisible, so THREE's raycaster skips it
  // and clicks resolve to the root exactly as they do in Godot's editor, but `bounds.ts`
  // keys on `.geometry` alone and never consults `visible`. Only its SIZE differs: a
  // contributor's own brush, against the point Godot never wrote for a skipped one.
  if (absorbed || skipped) {
    return (
      <group {...transform}>
        {skipped ? (
          <mesh visible={false} userData={CSG_BOUNDS_PROXY}>
            <boxGeometry args={[0, 0, 0]} />
          </mesh>
        ) : (
          geometry && (
            <mesh visible={false} userData={CSG_BOUNDS_PROXY}>
              {geometry}
            </mesh>
          )
        )}
        {scope}
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
      {/* SHADOWS_ONLY draws nothing into the colour buffer, so no surface
          material is mounted at all — see `CsgRootMesh.tsx` for why mounting
          one and relying on attach order is not the same thing. */}
      {shadow.shadowsOnly ? (
        <meshBasicMaterial
          key={CSG_SHADOWS_ONLY_MATERIAL.key}
          {...CSG_SHADOWS_ONLY_MATERIAL.props}
        />
      ) : (
        <SurfaceMaterialSlot source={materialSource} />
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
  // No evaluator, no dynamic import, no cost. It still publishes what it skipped —
  // absorbing nothing is not the same as skipping nothing.
  return (
    <group {...transform}>
      {ownSolid}
      {scope}
    </group>
  );
}

