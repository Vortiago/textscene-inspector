/**
 * <CsgPrimitive>: the shared render scaffold for every CSG slice, and the seam where boolean
 * evaluation happens. A CSG node takes one of four shapes by where it sits: contributor (A), lone
 * root (B), combining root (C) or skipped (D). Each branch below states its shape.
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
 * Marks the invisible bounds proxy, which `frameSceneBounds` counts: Godot's AABB for a visible
 * contributor is its unevaluated brush (`modules/csg/csg_shape.cpp:470,507`). An invisible one the
 * recursion never reached gets a zero-size proxy, the point Godot has for it. It is also all a
 * combiner root has to frame on while the library loads.
 */
export const CSG_BOUNDS_PROXY = { tscnBoundsProxy: true } as const;

interface CsgPrimitiveProps {
  node: TscnNode;
  properties: Node3DProperties & { materialPath?: string; castShadow?: number };
  children?: ReactNode;
}

// The seam is here, not in NodeDispatcher. `PlainNode` is the only caller of `registerNodeObject`,
// so skipping CSG children there would strip selection, highlighting and the hidden-eye toggle,
// and `subtreeConformance.test.tsx` fails a root that swallows `children`. So contributors remove
// their own mesh from the inside.
export function CsgPrimitive({ node, properties, children }: CsgPrimitiveProps) {
  const { internalResources, externalResources } = useSceneResources();
  const path = useNodePath();
  const subtree = useCsgSubtree();
  // Optional: a CSG node renders outside the shell in tests and in the
  // subtree-conformance probe, where nothing can be hidden anyway.
  const hiddenNodePaths = useOptionalSelection()?.hiddenNodePaths ?? NO_PATHS;

  // `_get_brush()` skips an invisible child (csg_shape.cpp:469) before writing its node_aabb, so
  // Godot has only a point at its origin. A root builds whatever its visibility, so it keeps its
  // full box. Decided before the work below, which a skipped node would only throw away.
  const skipped = subtree !== null && path !== null && subtree.invisiblePaths.has(path);

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const ctx = useMemo(
    () => ({ internalResources, externalResources }),
    [internalResources, externalResources]
  );

  // The node's own solid comes from the registered builder the evaluator calls, so a slice
  // defines its geometry once. Memoized on the registered `geometryKey`, not on the properties
  // object, which the parser reallocates every reparse.
  const registration = nodeComponentRegistry.getCsgShape(node.type);
  const builderProps = properties as unknown as Record<string, unknown>;
  const ownKey = registration?.geometryKey?.(builderProps, ctx) ?? node.type;
  const ownGeometry = useMemo(
    () => (skipped ? null : (registration?.geometry?.(builderProps, ctx) ?? null)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ownKey` is the builder's inputs.
    [ownKey, skipped]
  );
  const geometry = ownGeometry ? <primitive object={ownGeometry} attach="geometry" /> : null;

  // A CSG `material` is as often an ExtResource `.tres` as an inline sub-resource, and a CSG
  // primitive keeps only a `Ref<Material>` (`modules/csg/csg_shape.h:276,290`), so both arrive at
  // the same slot, which renders either, textures included.
  const materialSource = useMemo(
    () => resolveMaterialSource(properties.materialPath, internalResources, externalResources),
    [properties.materialPath, internalResources, externalResources]
  );

  // Absorbed while the ancestor's boolean is pending or ready. Not while it has failed, which
  // makes every contributor draw itself again.
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

  // A. Contributor: its solid belongs to an ancestor's boolean. D. Skipped: invisible, so its CSG
  // parent's boolean never reached it. Neither draws a solid, and both stay mounted so
  // tree-selection, highlighting and the hidden-eye toggle keep working.
  if (absorbed || skipped) {
    // The proxy is invisible, so THREE's raycaster skips it and clicks resolve to the root as in
    // Godot's editor, but `bounds.ts` keys on `.geometry` alone. Only its size differs: a
    // contributor's own brush, against a point for a skipped node, all Godot has for it.
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

  // The node drawing its own solid: what a lone root is, and what a combining root falls back to
  // while the library loads or after it failed.
  const ownSolid = geometry && (
    <mesh
      castShadow={shadow.castShadow}
      onBeforeShadow={shadow.onBeforeShadow}
      receiveShadow
    >
      {geometry}
      {/* SHADOWS_ONLY draws nothing into the colour buffer, so no surface
          material is mounted. `CsgRootMesh.tsx` says why mounting one and
          relying on attach order is not the same thing. */}
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

  // C. Combining root: two or more contributions. It draws the evaluated result and tells its
  // subtree, through CsgSubtreeContext, that their solids are spoken for.
  if (combining) {
    return (
      <group {...transform}>
        <CsgRootMesh plan={plan} shadow={shadow} fallback={ownSolid}>
          {children}
        </CsgRootMesh>
      </group>
    );
  }

  // B. Lone root: no surviving CSG descendants, so no evaluator, dynamic import or CSG library.
  // It still publishes what it skipped: absorbing nothing is not skipping nothing.
  return (
    <group {...transform}>
      {ownSolid}
      {scope}
    </group>
  );
}

