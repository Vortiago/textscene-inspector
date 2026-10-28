/**
 * <CsgPrimitive>: the shared render scaffold for every CSG slice, and the seam where boolean
 * evaluation happens. A CSG node takes one of four shapes by where it sits: contributor (A), lone
 * root (B), combining root (C) or skipped (D). Each branch below states its shape.
 */

import { useMemo, useRef } from 'react';
import { visualLayersUserData } from '../../../r3f/visualLayers';
import type * as THREE from 'three';
import type { ReactNode } from 'react';
import type { TscnNode } from '../../../parser/types';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { SurfaceMaterialSlots } from '../../../r3f/materials/SurfaceMaterialSlots';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useUndrawnMeshReport } from '../../../r3f/contexts/UndrawnMeshesContext';
import { EmptyShapeBranch, useReportEmptyShape } from '../../../r3f/contexts/EmptyShapesContext';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import { CsgSubtreeProvider, useCsgSubtree } from '../../../r3f/contexts/CsgSubtreeContext';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { buildCsgPlan } from '../../../r3f/csg/csgPlan';
import { hasFaces } from '../../../r3f/csg/csgRegistration';
import { CsgRootMesh } from '../../../r3f/csg/CsgRootMesh';
import { resolveMaterialSource } from '../../../r3f/materials/materialSource';
import { useCsgGeometryContext } from '../../../r3f/csg/useCsgGeometryContext';
import { useGeometryInstance } from '../../../r3f/visibilityRange/geometryInstance';
import { livePlacement } from '../../../r3f/visibilityRange/placements';
import { useLivePatchesBelow } from '../../../r3f/liveNodePatches';
import type { CSGShape3DProperties } from './types';

const NO_PATHS: ReadonlySet<string> = new Set();

/**
 * Marks the invisible bounds proxy, which `frameSceneBounds` counts: Godot's AABB for a visible
 * contributor is its unevaluated brush (`modules/csg/csg_shape.cpp:470,507`). A node with no brush,
 * an open one, an invisible one the recursion never reached or one with no shape, gets a zero-size
 * proxy, the point Godot has for it. A combiner root frames on it while the library loads.
 */
const CSG_BOUNDS_PROXY = { tscnBoundsProxy: true } as const;

/** The point an empty brush bounds to: a skipped node's, an open one's or a shape that builds nothing. */
const EMPTY_BRUSH = <boxGeometry args={[0, 0, 0]} />;

interface CsgPrimitiveProps {
  node: TscnNode;
  properties: CSGShape3DProperties & { materialPath?: string };
  children?: ReactNode;
}

// The seam is here, not in NodeDispatcher. `PlainNode` is the only caller of `registerNodeObject`,
// so skipping CSG children there would strip selection, highlighting and the hidden-eye toggle,
// and `subtreeConformance.test.tsx` fails a root that swallows `children`. So contributors remove
// their own mesh from the inside.
export function CsgPrimitive({ node, properties, children }: CsgPrimitiveProps) {
  const path = useNodePath();
  const subtree = useCsgSubtree();
  // A node in an ancestor's plan builds against that root's context, so only a root loads files.
  const inAncestorPlan =
    subtree !== null &&
    path !== null &&
    (subtree.absorbedPaths.has(path) || subtree.invisiblePaths.has(path));
  const ownSetup = useCsgGeometryContext(inAncestorPlan ? null : node);
  // A failed ancestor makes this node a root again, whose boolean reads the files that root loaded.
  const setup = inAncestorPlan
    ? { context: subtree.context, isLoading: false, isLoadingFonts: false }
    : ownSetup;
  const { context: ctx, isLoadingFonts } = setup;
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

  // The node's own solid comes from the registered builder the evaluator calls, so a slice
  // defines its geometry once. Memoized on the registered `geometryKey`, not on the properties
  // object, which the parser reallocates every reparse. The key covers the shape alone, and the
  // plan's key adds `material` beside it, so the solid's materials need it here too.
  const registration = nodeComponentRegistry.getCsgShape(node.type);
  const builderProps = properties as unknown as Record<string, unknown>;
  const ownKey = registration?.geometryKey?.(builderProps, ctx) ?? node.type;
  // Not while the root loads a file or a font: the mesh is unknown, not undrawn.
  const isRootLoading = inAncestorPlan ? subtree.status === 'pending' : setup.isLoading;
  useUndrawnMeshReport(isRootLoading ? null : (registration?.undrawnMeshType?.(builderProps, ctx) ?? null));
  const { ownSolid, isOpen, hasNoFaces } = useMemo(
    () => {
      const built = skipped || isLoadingFonts ? null : (registration?.geometry?.(builderProps, ctx) ?? null);
      // An open brush, or one with no face, is empty: it draws nothing and bounds to a point.
      // Only that fact is kept, not an open geometry. Null is no brush yet.
      const isOpen = built !== null && !built.isClosed;
      const hasNoFaces = built !== null && !isOpen && !hasFaces(built);
      return { ownSolid: built && !isOpen && !hasNoFaces ? built : null, isOpen, hasNoFaces };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `ownKey` and `materialPath` are the builder's inputs.
    [ownKey, properties.materialPath, skipped, isLoadingFonts]
  );
  // Godot warns on a shape whose folded brush has no face (`csg_shape.cpp:981`). An open brush
  // empties its whole fold, but a node with no face of its own is filled by its CSG children.
  const hasCsgChildren = node.children.some((child) => nodeComponentRegistry.getCsgShape(child.type));
  const isEmptyShape = useReportEmptyShape(isOpen || (hasNoFaces && !hasCsgChildren));
  const geometry = ownSolid ? <primitive object={ownSolid.geometry} attach="geometry" /> : null;

  // A CSG `material` is as often an ExtResource `.tres` as an inline sub-resource, and a CSG
  // primitive keeps only a `Ref<Material>` (`modules/csg/csg_shape.h:276,290`), so both arrive at
  // the same slot, which renders either, textures included.
  const materialSources = useMemo(
    () => ownSolid?.materials.map((address) => resolveMaterialSource(address, ctx)) ?? [],
    [ownSolid, ctx]
  );

  // Absorbed while the ancestor's boolean is pending or ready. Not while it has failed, which
  // makes every contributor draw itself again.
  const absorbed =
    subtree !== null && subtree.status !== 'failed' && path !== null && subtree.absorbedPaths.has(path);

  // A root builds the plan over its CSG descendants, which the passes bind by live path.
  const patches = useLivePatchesBelow(absorbed || skipped ? null : path);
  const plan = useMemo(() => {
    if (absorbed || skipped || path === null) return null;
    return buildCsgPlan(node, path, {
      hiddenPaths: hiddenNodePaths,
      patches,
      lookup: (type) => {
        const shape = nodeComponentRegistry.getCsgShape(type);
        if (!shape) return null;
        return {
          hasGeometry: shape.geometry != null,
          key: (n) => shape.geometryKey?.(n.properties as Record<string, unknown>, ctx) ?? n.type,
        };
      },
    });
  }, [absorbed, skipped, node, path, hiddenNodePaths, patches, ctx]);

  // A node with no plan of its own passes the enclosing root's value straight through:
  // what its descendants are is that root's answer, not its own. Mounted by every branch
  // that owns no evaluator, so crossing between them reconciles rather than remounting;
  // a combining root publishes the same value through CsgRootMesh, which owns the status.
  const publishedSubtree = useMemo(
    () =>
      plan === null
        ? subtree
        : {
            status: 'ready' as const,
            absorbedPaths: NO_PATHS,
            invisiblePaths: plan.invisiblePaths,
            context: ctx,
          },
    [plan, subtree, ctx]
  );
  const shapeChildren = <EmptyShapeBranch isEmpty={isEmptyShape}>{children}</EmptyShapeBranch>;
  const scope = <CsgSubtreeProvider value={publishedSubtree}>{shapeChildren}</CsgSubtreeProvider>;

  const combining = plan !== null && plan.geometryCount > 1;
  // A root's own: a contributor's solid, and its range and transparency with it, belong to the
  // root's mesh. Whichever mesh the root draws, its own solid or the evaluated one, is `drawnRef`.
  const nodeRef = useRef<THREE.Group | null>(null);
  const drawnRef = useRef<THREE.Mesh | null>(null);
  const placement = useMemo(() => livePlacement(nodeRef, drawnRef), []);
  const shadow = useGeometryInstance(placement);

  const transform = { ref: nodeRef, name: node.name, position, rotation, scale } as const;

  // A. Contributor: its solid belongs to an ancestor's boolean. D. Skipped: invisible, so its CSG
  // parent's boolean never reached it. Neither draws a solid, and both stay mounted so
  // tree-selection, highlighting and the hidden-eye toggle keep working.
  if (absorbed || skipped) {
    // The proxy is invisible, so THREE's raycaster skips it and clicks resolve to the root as in
    // Godot's editor, but `bounds.ts` keys on `.geometry` alone.
    return (
      <group {...transform}>
        <mesh visible={false} userData={CSG_BOUNDS_PROXY}>
          {geometry ?? EMPTY_BRUSH}
        </mesh>
        {scope}
      </group>
    );
  }

  // The node drawing its own solid: what a lone root is, and what a combining root falls back to
  // while the library loads or after it failed.
  const ownMesh = geometry && (
    <mesh
      ref={drawnRef}
      castShadow={shadow.castShadow}
      onBeforeRender={shadow.onBeforeRender}
      onAfterRender={shadow.onAfterRender}
      onBeforeShadow={shadow.onBeforeShadow}
      onAfterShadow={shadow.onAfterShadow}
      receiveShadow
      userData={visualLayersUserData(properties.layers)}
    >
      {geometry}
      <SurfaceMaterialSlots sources={materialSources} />
    </mesh>
  );

  // C. Combining root: two or more contributions. It draws the evaluated result and tells its
  // subtree, through CsgSubtreeContext, that their solids are spoken for.
  if (combining) {
    return (
      <group {...transform}>
        <CsgRootMesh
          plan={plan}
          setup={setup}
          shadow={shadow}
          layers={properties.layers}
          meshRef={drawnRef}
          fallback={ownMesh}
        >
          {shapeChildren}
        </CsgRootMesh>
      </group>
    );
  }

  // B. Lone root: no surviving CSG descendants, so no evaluator, dynamic import or CSG library.
  // It still publishes what it skipped: absorbing nothing is not skipping nothing.
  return (
    <group {...transform}>
      {ownMesh || (
        <mesh visible={false} userData={CSG_BOUNDS_PROXY}>
          {EMPTY_BRUSH}
        </mesh>
      )}
      {scope}
    </group>
  );
}
