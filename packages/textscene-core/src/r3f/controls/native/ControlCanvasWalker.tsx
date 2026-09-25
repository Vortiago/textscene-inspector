/**
 * Solves `tree` against `viewport` and `theme`, and emits one named `<group>` per
 * Control at its solved rect, Y negated per axis (`rect.ts`): a Control's own rect
 * never shears. A registered painter draws the chrome, `<ControlFallback>` otherwise.
 * Children render beside the painter, since the solve has already placed them.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { Rect2 } from './rect';
import { controlProps, type SolveNode } from './solveTree';
import type { Transform2DColumns } from '../../../godot/transform2d.js';
import type { NativeTheme } from './nativeTheme';
import { controlSolverRegistry, type TextMeasurer } from './solverRegistry';
import { createSolveContext, solveControlTree, type SolvedControl } from './controlRectSolver';
import { controlComponentRegistry } from '../ControlComponentRegistry';
import { ControlFallback } from './ControlFallback';
import { Modulate2DContext } from '../../canvasItemModulate';
import { TextureSampler2DContext, useInheritedTextureSampler } from '../../canvasItemTextureSampler';
import { useControlOwnTint, useInheritedModulate } from './controlTint';
import { canvasRenderOrder } from '../../canvasPaintOrder';
import { CanvasItemGroup, CanvasItemKeyProvider } from '../../components/CanvasItemGroup';
import { useLayerRank } from '../../contexts/PaintOrderContext';
import { snapControlsToPixelsEnabled, snappedControlOrigin } from './controlPixelSnap';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import {
  accumulateCanvasItemZ,
  EffectiveZProvider,
  useCanvasLayerIndex,
  useEffectiveZ,
} from '../../lighting2d/canvasItemPlacement';

export interface ControlCanvasWalkerProps {
  tree: readonly SolveNode[];
  /** Bumps when a sub-scene or texture resolves (`buildSolveTree`), so the memo below re-solves. */
  generation: number;
  viewport: Rect2;
  theme: NativeTheme;
  measurer: TextMeasurer | null;
  /**
   * `Viewport::is_snap_controls_to_pixels_enabled()` for the viewport this walk
   * draws into. Omitted means the root window's, the project setting. A caller
   * that owns another viewport must state it.
   */
  snapToPixels?: boolean;
}

const ZERO_RECT: Rect2 = { x: 0, y: 0, w: 0, h: 0 };

/**
 * The skipped Node2D ancestors' transform `t`, conjugated by `F = diag(1, -1, 1)`
 * (`node2dTransform.ts`). A product of ancestors can shear, so the 2x3 is baked in,
 * never decomposed: F·M·F is `[a, -c, tx; -b, d, -ty]` for Godot's
 * `columns[0]=(a,b)`, `columns[1]=(c,d)`, `columns[2]=(tx,ty)`.
 */
export function ancestorGroupMatrix(t: Transform2DColumns): THREE.Matrix4 {
  return new THREE.Matrix4().set(
    t.a, -t.c, 0, t.tx,
    -t.b, t.d, 0, -t.ty,
    0, 0, 1, 0,
    0, 0, 0, 1
  );
}

export function ControlCanvasWalker({
  tree,
  generation,
  viewport,
  theme,
  measurer,
  snapToPixels,
}: ControlCanvasWalkerProps) {
  // Per viewport in Godot (`Viewport::snap_controls_to_pixels`,
  // `scene/main/viewport.h`). `main/main.cpp` applies the project setting to the
  // root window alone, and every other Viewport keeps its `= true` initialiser.
  const projectSnapToPixels = snapControlsToPixelsEnabled(useProjectSettings().settings);
  const snapEnabled = snapToPixels ?? projectSnapToPixels;

  const solved = useMemo(() => {
    const ctx = createSolveContext(theme, measurer);
    return solveControlTree(tree, viewport, ctx);
    // `generation` is a cache-buster, not read inside: a StyleBox or texture in
    // `tree` can change while `tree` keeps its reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, generation, measurer, viewport, theme]);

  return (
    <>
      {tree.map((n) => (
        <ControlNodeGroup
          key={n.path}
          solveNode={n}
          solved={solved}
          isFreeParent
          theme={theme}
          measureText={measurer}
          snapToPixels={snapEnabled}
        />
      ))}
    </>
  );
}

interface ControlNodeGroupProps {
  solveNode: SolveNode;
  solved: ReadonlyMap<string, SolvedControl>;
  /** Whether this node's parent imposes no container layout. */
  isFreeParent: boolean;
  theme: NativeTheme;
  measureText: TextMeasurer | null;
  /** `Viewport::is_snap_controls_to_pixels_enabled()` (`controlPixelSnap.ts`). */
  snapToPixels: boolean;
}

function ControlNodeGroup({
  solveNode,
  solved,
  isFreeParent,
  theme,
  measureText,
  snapToPixels,
}: ControlNodeGroupProps) {
  const props = controlProps(solveNode);
  const inheritedModulate = useInheritedModulate(props.modulate, solveNode.skippedAncestors?.modulate);
  // The painter's pixels continue the chain one `self_modulate` further. Resolved
  // here, so no painter re-enters the composition from the provider
  // (`NativeControlComponentProps.tint`).
  const tint = useControlOwnTint(inheritedModulate, solveNode);
  // Own-or-ambient, not multiplicative: neither property has a self-only layer,
  // so one fold serves this painter and the descendants.
  const sampler = useInheritedTextureSampler(props.textureFilter, props.textureRepeat);
  // `is_visible_in_tree()` is `visible && parent_visible_in_tree` (`canvas_item.cpp:62-64`).
  // Both halves come from the solve, which read `hiddenNodePaths`: a skipped
  // Node2D mounts no group, and a hoisted `top_level` or chain-broken Control is a
  // sibling of the ancestor whose flag still reaches it.
  const isVisible = !solveNode.hidden && props.visible !== false && solveNode.parentVisibleInTree;

  // Always present, since the solve walks this tree. The fallback guards a
  // mismatched pair.
  const solvedEntry = solved.get(solveNode.path);
  const rect = solvedEntry?.rect ?? ZERO_RECT;

  // `WORLD_CANVAS_LAYER` (0), or what a `CanvasLayer` ancestor's painter published.
  const layer = useCanvasLayerIndex();
  const layerRank = useLayerRank(layer);
  // Godot's `z_final`, by the one rule `accumulateCanvasItemZ` shares with
  // Node2D, relative as Controls parse no `z_as_relative`. `show_behind_parent`
  // never enters: `_cull_canvas_item` runs both child loops with one `p_z`
  // (`renderer_canvas_cull.cpp`).
  const parentEffectiveZ = useEffectiveZ();
  // The cull walk descends through each skipped Node2D ancestor too: one step
  // each, outermost first, never a pre-summed total (`SkippedAncestors.z`).
  const ancestorZ = (solveNode.skippedAncestors?.z ?? []).reduce(
    (z, step) => accumulateCanvasItemZ(z, { z_index: step.zIndex, z_as_relative: step.zAsRelative }),
    parentEffectiveZ
  );
  const effectiveZ = accumulateCanvasItemZ(ancestorZ, { z_index: props.zIndex ?? 0 });

  // The key every Node2D canvas item takes (`canvasPaintOrder.ts`). The sequence
  // counts all live siblings, so Controls interleave with them.
  const renderOrder = canvasRenderOrder({
    layerRank,
    zFinal: effectiveZ,
    sequence: solveNode.paintSequence,
  });
  // For chrome drawn after the whole subtree (Godot's `INTERNAL_MODE_BACK`). The
  // subtree owns a contiguous run, so this is its last value.
  const subtreeChromeRenderOrder = canvasRenderOrder({
    layerRank,
    zFinal: effectiveZ,
    sequence: solveNode.paintRange.base + solveNode.paintRange.size - 1,
  });

  // `Container::fit_child_in_rect` resets a container child to rotation 0 and
  // scale 1, and the snap's rotation gate must see that too.
  const rotation = isFreeParent ? (props.rotation ?? 0) : 0;
  const scaleX = isFreeParent ? (props.scale?.x ?? 1) : 1;
  const scaleY = isFreeParent ? (props.scale?.y ?? 1) : 1;
  const hasOwnTransform = rotation !== 0 || scaleX !== 1 || scaleY !== 1;
  const pivotX = (props.pivotOffset?.x ?? 0) + (props.pivotOffsetRatio?.x ?? 0) * rect.w;
  const pivotY = (props.pivotOffset?.y ?? 0) + (props.pivotOffsetRatio?.y ?? 0) * rect.h;

  // Godot snaps the canvas item, leaving `get_rect()` at full precision. The inner
  // pivot groups add their own translation, so this is the outer half of one
  // snapped origin.
  const origin = snappedControlOrigin(
    rect,
    { rotation, scale: { x: scaleX, y: scaleY }, pivot: { x: pivotX, y: pivotY } },
    snapToPixels
  );

  const Painter = controlComponentRegistry.get(solveNode.node.type) ?? ControlFallback;
  // The registry read `dispatchChildren` makes, so walker and solver agree on
  // which children are free.
  const childIsFreeParent = controlSolverRegistry.containerLayout(solveNode.node.type) === undefined;

  // The context carries this z to the descendants, for `PointLight2D`'s
  // `range_z_*` cull. The painter gets it by prop: Godot tests an item against
  // its own z, and the ambient here is the parent's.
  const childElements = (
    <EffectiveZProvider value={effectiveZ}>
      {solveNode.children.map((child) => (
        <ControlNodeGroup
          key={child.path}
          solveNode={child}
          solved={solved}
          isFreeParent={childIsFreeParent}
          theme={theme}
          measureText={measureText}
          snapToPixels={snapToPixels}
        />
      ))}
    </EffectiveZProvider>
  );

  // Only this node's DIRECT children, so a painter cannot reach across the tree.
  const childRects = useMemo(() => {
    const out = new Map<string, Rect2>();
    for (const child of solveNode.children) {
      out.set(child.path, solved.get(child.path)?.rect ?? ZERO_RECT);
    }
    return out;
  }, [solveNode.children, solved]);

  // A canvas boundary such as `CanvasLayer` wraps its descendants in fresh
  // context, so they must be its React children. The registration declares it,
  // so a second such type adds no branch here.
  const wrapsChildren = controlComponentRegistry.wrapsChildren(solveNode.node.type);
  const content = wrapsChildren ? (
    <Painter
      solveNode={solveNode}
      rect={rect}
      renderOrder={renderOrder}
      tint={tint}
      subtreeChromeRenderOrder={subtreeChromeRenderOrder}
      effectiveZ={effectiveZ}
      theme={theme}
      measureText={measureText}
      snapToPixels={snapToPixels}
      childRects={childRects}
      meta={solvedEntry?.meta}
    >
      {childElements}
    </Painter>
  ) : (
    <>
      <Painter
        solveNode={solveNode}
        rect={rect}
        renderOrder={renderOrder}
        tint={tint}
        subtreeChromeRenderOrder={subtreeChromeRenderOrder}
        effectiveZ={effectiveZ}
        theme={theme}
        measureText={measureText}
        snapToPixels={snapToPixels}
        childRects={childRects}
        meta={solvedEntry?.meta}
      />
      {childElements}
    </>
  );

  const ownGroup = (
    // Every group here carries the key: three takes `groupOrder` from the nearest
    // enclosing group, so a bare one would reset the pixels inside to zero.
    <group
      name={`${solveNode.node.type}:${solveNode.node.name}`}
      position={[origin.x, -origin.y, 0]}
      visible={isVisible}
      renderOrder={renderOrder}
    >
      <CanvasItemKeyProvider value={renderOrder}>
        <Modulate2DContext.Provider value={inheritedModulate}>
          <TextureSampler2DContext.Provider value={sampler}>
            {hasOwnTransform ? (
              <CanvasItemGroup
                position={[pivotX, -pivotY, 0]}
                rotation={[0, 0, 0 - rotation]}
                scale={[scaleX, scaleY, 1]}
              >
                <CanvasItemGroup position={[-pivotX, pivotY, 0]}>{content}</CanvasItemGroup>
              </CanvasItemGroup>
            ) : (
              content
            )}
          </TextureSampler2DContext.Provider>
        </Modulate2DContext.Provider>
      </CanvasItemKeyProvider>
    </group>
  );

  if (!solveNode.skippedAncestors) return ownGroup;

  // paint-order-safe: outside the keyed `ownGroup`, never between it and a mesh.
  // The skipped Node2D chain this node promoted past (`SolveNode.skippedAncestors`).
  return (
    <group matrix={ancestorGroupMatrix(solveNode.skippedAncestors.transform)} matrixAutoUpdate={false}>
      {ownGroup}
    </group>
  );
}
