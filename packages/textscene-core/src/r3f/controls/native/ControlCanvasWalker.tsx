/**
 * Solves `tree` against `viewport` and `theme`, and emits one named `<group>` per
 * Control at its solved rect, Y negated per axis (`rect.ts`): a Control's own rect
 * never shears. A registered painter draws the chrome, `<ControlFallback>` otherwise.
 * Children render beside the painter, since the solve has already placed them.
 */
import { useId, useLayoutEffect, useMemo } from 'react';
import { ZERO_RECT, type Rect2 } from '../../../godot/math/rect2';
import { controlProps, type SolveNode } from './solveTree';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import { threeMatrixFromTransform2D } from '../../node2dTransform';
import type { NativeTheme } from './nativeTheme';
import type { TextMeasurer } from './solverRegistry';
import { createSolveContext, solveControlTree, type SolvedControl } from './controlRectSolver';
import { controlComponentRegistry, NO_PIECE_SLOTS } from '../ControlComponentRegistry';
import { ControlFallback } from './ControlFallback';
import { OwnCanvasModulateProvider, WHITE_MODULATE } from '../../canvasItemModulate';
import { useTextureSamplerOver } from '../../canvasItemTextureSampler';
import { LitCanvasItemPixels } from '../../components/LitCanvasItemPixels';
import { ClipChildrenScope } from '../../canvasGroup/ClipChildrenScope';
import { ClipMaskProvider } from '../../canvasGroup/ClipMaskContext';
import { useResolvedCanvasItemMaterial } from '../../components/canvasItemMaterial';
import {
  CanvasParentProvider,
  inheritedAlong,
  useEnclosingCanvasState,
  useHandedDownParent,
} from '../../canvasItemPass/inheritedCanvasState';
import type { InheritedCanvasItemState } from '../../canvasItemPass/canvasItemPass';
import type { CanvasItemPaint } from '../../canvasItemPass/canvasItemPaint';
import { ysortsChildren, type PaintRange } from '../../canvasPaintOrder';
import { isCanvasLayerType } from '../../canvasItemClass';
import { CanvasItemGroup, CanvasItemProvider } from '../../components/CanvasItemGroup';
import { NodePathProvider } from '../../contexts/NodePathContext';
import { ControlClipProvider, useInheritedControlClip } from './controlClipping';
import { snapControlsToPixelsEnabled, snappedControlOrigin } from './controlPixelSnap';
import {
  controlTransformsOf,
  forestInCanvasSort,
  forestBackPiecesOf,
  isInSharedTree,
  piecesAtLivePaths,
  solvedDrawTransformOf,
  transformsAtLivePaths,
  type ForestSort,
} from './forestSort';
import {
  usePublishControlLocalTransforms,
  usePublishControlTransforms,
  usePublishSortExtras,
  useSortedRunsAndPaints,
} from '../../contexts/YSortContext';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import {
  useCanvasItemState,
  ownAndBackSlots,
  wholeKeySlot,
  type CanvasItemState,
  type CanvasSlot,
} from '../../canvasItemState';

interface ControlCanvasWalkerProps {
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
  /** The live path of the viewport the forest's paths hang below, for the world sort that keys by live path. */
  livePath?: string;
}

export function ControlCanvasWalker({
  tree,
  generation,
  viewport,
  theme,
  measurer,
  snapToPixels,
  livePath = '',
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
  // The one sort of the canvas sorts the Controls on where this solve puts them. A forest the shared
  // live tree does not hold publishes nothing its paths could confuse, and draws in tree order.
  // A layout effect, so the sort settles before the first paint.
  const canvasSort = useSortedRunsAndPaints();
  const isSortedByCanvas = isInSharedTree(tree, livePath, canvasSort.paints);
  const publishToCanvas = usePublishControlTransforms();
  const publishTransforms = isSortedByCanvas ? publishToCanvas : null;
  const owner = useId();
  useLayoutEffect(() => {
    publishTransforms?.(
      owner,
      transformsAtLivePaths(livePath, controlTransformsOf(tree, solved, snapEnabled))
    );
  }, [publishTransforms, owner, tree, solved, snapEnabled, livePath]);
  useLayoutEffect(() => () => publishTransforms?.(owner, null), [publishTransforms, owner]);
  const pieces = useMemo(() => forestBackPiecesOf(tree, solved), [tree, solved]);
  const publishToSort = usePublishSortExtras();
  const publishPieces = isSortedByCanvas ? publishToSort : null;
  useLayoutEffect(() => {
    publishPieces?.(owner, piecesAtLivePaths(livePath, pieces));
  }, [publishPieces, owner, pieces, livePath]);
  useLayoutEffect(() => () => publishPieces?.(owner, null), [publishPieces, owner]);
  // Read by the live scene passes, which compose through a Control. Every walk publishes them, sorted or not.
  const publishLocalTransforms = usePublishControlLocalTransforms();
  useLayoutEffect(() => {
    publishLocalTransforms?.(
      owner,
      transformsAtLivePaths(livePath, controlTransformsOf(tree, solved, false))
    );
  }, [publishLocalTransforms, owner, tree, solved, livePath]);
  useLayoutEffect(() => () => publishLocalTransforms?.(owner, null), [publishLocalTransforms, owner]);
  const sort = useMemo(
    () => forestInCanvasSort(tree, livePath, canvasSort, pieces),
    [canvasSort, tree, livePath, pieces]
  );

  return (
    <>
      {tree.map((n) => (
        <RootControlNodeGroup
          key={n.path}
          solveNode={n}
          solved={solved}
          sort={sort}
          theme={theme}
          measureText={measurer}
          snapToPixels={snapEnabled}
        />
      ))}
    </>
  );
}

/** A root of the walk's tree, below the drawn item the walk sits in. */
function RootControlNodeGroup(props: Omit<ControlNodeGroupProps, 'walkEnclosing'>) {
  return <ControlNodeGroup {...props} walkEnclosing={useEnclosingCanvasState()} />;
}

interface ControlNodeGroupProps {
  solveNode: SolveNode;
  solved: ReadonlyMap<string, SolvedControl>;
  /** How the walk draws each Control after the y-sort of its canvas. */
  sort: ForestSort;
  theme: NativeTheme;
  measureText: TextMeasurer | null;
  /** `Viewport::is_snap_controls_to_pixels_enabled()` (`controlPixelSnap.ts`). */
  snapToPixels: boolean;
  /**
   * What the drawn item the walk's root sits in hands down. Each Control's `inheritance` holds every
   * link up to that root, so the whole walk folds over this one state.
   */
  walkEnclosing: InheritedCanvasItemState;
}

/** What a Control inherits along the walk's tree, below the drawn item that hands down `walkEnclosing`. */
function useControlInheritance(
  { inheritance }: SolveNode,
  walkEnclosing: InheritedCanvasItemState
): InheritedCanvasItemState {
  return useMemo(() => inheritedAlong(inheritance, walkEnclosing), [inheritance, walkEnclosing]);
}

/**
 * A Control's CanvasItem state. `show_behind_parent` never enters its `z_final`: `_cull_canvas_item`
 * runs both child loops with one `p_z` (`renderer_canvas_cull.cpp:471-490`). The draw sequence counts
 * all live siblings, so Controls interleave with Node2D items.
 */
function useControlState(
  solveNode: SolveNode,
  paint: CanvasItemPaint,
  props: ControlProperties,
  inherited: InheritedCanvasItemState
): CanvasItemState {
  return useCanvasItemState({
    inherited,
    modulate: props.modulate ?? WHITE_MODULATE,
    selfModulate: props.selfModulate ?? WHITE_MODULATE,
    zIndex: props.zIndex,
    zAsRelative: props.zAsRelative,
    // Each reference resolves in the scope of the node that names it: an instanced sub-scene names
    // its materials in its file.
    material: useResolvedCanvasItemMaterial(
      { ref: props.materialPath, useParentMaterial: props.useParentMaterial },
      solveNode.resources,
      inherited.material
    ),
    // Own-or-inherited, not multiplicative: neither property has a self-only layer,
    // so one fold serves this painter and the descendants.
    sampler: useTextureSamplerOver(props.textureFilter, props.textureRepeat, inherited.sampler),
    lightMask: props.lightMask,
    sequence: paint.own,
  });
}

/** The slot of each internal back piece a sort placed, by name, at the z of the Control that draws it. */
function usePieceSlots(
  runs: ReadonlyMap<string, PaintRange> | undefined,
  state: Pick<CanvasItemState, 'keyAt'>
): ReadonlyMap<string, CanvasSlot> {
  const { keyAt } = state;
  return useMemo(() => {
    if (!runs) return NO_PIECE_SLOTS;
    return new Map([...runs].map(([name, run]) => [name, wholeKeySlot(keyAt(run.base))]));
  }, [runs, keyAt]);
}

/**
 * One Control, under the skipped Node2D chain it promoted past (`SolveNode.skippedTransform`), when
 * there is one. A product of ancestors can shear, so the chain's transform goes in as a whole matrix.
 */
function ControlNodeGroup(props: ControlNodeGroupProps) {
  const skipped = props.solveNode.skippedTransform;
  if (!skipped) return <ControlItemGroup {...props} />;
  // paint-order-safe: outside the keyed item group, never between it and a mesh.
  return (
    <group matrix={threeMatrixFromTransform2D(skipped)} matrixAutoUpdate={false}>
      <ControlItemGroup {...props} />
    </group>
  );
}

function ControlItemGroup({
  solveNode,
  solved,
  sort,
  theme,
  measureText,
  snapToPixels,
  walkEnclosing,
}: ControlNodeGroupProps) {
  const props = controlProps(solveNode);
  const inherited = useControlInheritance(solveNode, walkEnclosing);
  const paint = sort.paints.get(solveNode.path) ?? solveNode.paint;
  // The clip this Control took, which it hands on to children that are entries of an outer sort.
  const takenClip = useInheritedControlClip();
  const state = useControlState(solveNode, paint, props, inherited);
  const handedDown = useHandedDownParent(solveNode.node, solveNode.path, solveNode.resources, inherited);
  const { key: renderOrder, tint } = state;
  // For chrome drawn after the whole subtree (Godot's `INTERNAL_MODE_BACK`), from the
  // sequence value the allocator holds after it (`internalBackRoom`).
  const backKey = state.keyAt(paint.back.base);
  const { slot, chromeSlot } = useMemo(() => ownAndBackSlots(renderOrder, backKey), [renderOrder, backKey]);
  const pieceSlots = usePieceSlots(sort.pieceRuns.get(solveNode.path), state);
  const layerKey = state.keyAt(paint.layer);
  const layerSlot = useMemo(() => wholeKeySlot(layerKey), [layerKey]);
  // `is_visible_in_tree()` is `visible && parent_visible_in_tree` (`canvas_item.cpp:62-64`).
  // Both halves come from the solve, which read `hiddenNodePaths`: a skipped
  // Node2D mounts no group, and a hoisted `top_level` or chain-broken Control is a
  // sibling of the ancestor whose flag still reaches it.
  const isVisible = !solveNode.hidden && props.visible !== false && solveNode.parentVisibleInTree;

  // Always present, since the solve walks this tree. The fallback guards a
  // mismatched pair.
  const solvedEntry = solved.get(solveNode.path);
  const rect = solvedEntry?.rect ?? ZERO_RECT;

  // The solve says whether `Container::fit_child_in_rect` reset this child to rotation 0 and
  // scale 1, and the snap's rotation gate must see that too.
  const transform = solvedDrawTransformOf(solveNode, solvedEntry ?? { rect });
  const { rotation, scale, pivot } = transform;
  const hasOwnTransform = rotation !== 0 || scale.x !== 1 || scale.y !== 1;

  // Godot snaps the canvas item, leaving `get_rect()` at full precision. The inner
  // pivot groups add their own translation, so this is the outer half of one
  // snapped origin.
  const origin = snappedControlOrigin(rect, transform, snapToPixels);

  const Painter = controlComponentRegistry.get(solveNode.node.type) ?? ControlFallback;
  const ownChildren = solveNode.children.map((child) => (
    <ControlNodeGroup
      key={child.path}
      solveNode={child}
      solved={solved}
      sort={sort}
      theme={theme}
      measureText={measureText}
      snapToPixels={snapToPixels}
      walkEnclosing={walkEnclosing}
    />
  ));
  // Godot culls each entry of a sort with the clip of the sort root (`renderer_canvas_cull.cpp:458`).
  const childElements = sort.mergedSorters.has(solveNode.path) ? (
    <ControlClipProvider value={takenClip}>{ownChildren}</ControlClipProvider>
  ) : (
    ownChildren
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
  // The painter's own path, as `NodeDispatcher` gives a node's: a ViewportTexture's `viewport_path`
  // counts from the painter's local scene.
  const painter = (
    <NodePathProvider path={solveNode.path}>
      <Painter
        solveNode={solveNode}
        rect={rect}
        renderOrder={renderOrder}
        slot={slot}
        tint={tint}
        childTint={tint.internalChild}
        chromeSlot={chromeSlot}
        pieceSlots={pieceSlots}
        layerSlot={layerSlot}
        theme={theme}
        measureText={measureText}
        snapToPixels={snapToPixels}
        childRects={childRects}
        meta={solvedEntry?.meta}
      >
        {wrapsChildren ? <ClipMaskProvider value={null}>{childElements}</ClipMaskProvider> : undefined}
      </Painter>
    </NodePathProvider>
  );
  // The leaf meshes of a painter read the lit pixel material through context. A CanvasLayer is no
  // CanvasItem, so it declares no item: one would add a light list to the layer's placement.
  const litPainter = isCanvasLayerType(solveNode.node.type) ? (
    painter
  ) : (
    <ClipChildrenScope
      mode={props.clipChildren}
      isYSorted={ysortsChildren(solveNode.node)}
      state={state}
      behindRanges={paint.behind}
      range={paint.range}
    >
      <LitCanvasItemPixels material={state.material} lightMask={state.lightMask} zFinal={state.zFinal}>
        {painter}
      </LitCanvasItemPixels>
    </ClipChildrenScope>
  );
  const content = wrapsChildren ? (
    litPainter
  ) : (
    <>
      {litPainter}
      {childElements}
    </>
  );

  return (
    // Every group here carries the key: three takes `groupOrder` from the nearest
    // enclosing group, so a bare one would reset the pixels inside to zero.
    <group
      name={`${solveNode.node.type}:${solveNode.node.name}`}
      position={[origin.x, -origin.y, 0]}
      visible={isVisible}
      renderOrder={renderOrder}
    >
      <CanvasItemProvider value={renderOrder}>
        {/* The painter sits inside too: it samples with the sampler the Control hands down,
            which is the Control's own. */}
        <CanvasParentProvider value={handedDown}>
          <OwnCanvasModulateProvider value={state.tint.canvasModulate}>
            {hasOwnTransform ? (
              <CanvasItemGroup
                position={[pivot.x, -pivot.y, 0]}
                rotation={[0, 0, 0 - rotation]}
                scale={[scale.x, scale.y, 1]}
              >
                <CanvasItemGroup position={[-pivot.x, pivot.y, 0]}>{content}</CanvasItemGroup>
              </CanvasItemGroup>
            ) : (
              content
            )}
          </OwnCanvasModulateProvider>
        </CanvasParentProvider>
      </CanvasItemProvider>
    </group>
  );
}
