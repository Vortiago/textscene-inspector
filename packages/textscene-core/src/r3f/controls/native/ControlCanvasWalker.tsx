/**
 * Solves `tree` against `viewport` and `theme`, and emits one named `<group>` per
 * Control at its solved rect, Y negated per axis (`rect.ts`): a Control's own rect
 * never shears. A registered painter draws the chrome, `<ControlFallback>` otherwise.
 * Children render beside the painter, since the solve has already placed them.
 */
import { useEffect, useId, useLayoutEffect, useMemo } from 'react';
import { ZERO_RECT, type Rect2 } from '../../../godot/math/rect2';
import { VECTOR2_ZERO, type Vector2 } from '../../../godot/math/vector';
import { controlProps, type SolveNode } from './solveTree';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { CanvasItemMaterialProperties } from '../../../resources/materials/canvasitemmaterial/types';
import { threeMatrixFromTransform2D } from '../../node2dTransform';
import type { NativeTheme } from './nativeTheme';
import type { TextMeasurer } from './solverRegistry';
import { createSolveContext, solveControlTree, type SolvedControl } from './controlRectSolver';
import { controlComponentRegistry } from '../ControlComponentRegistry';
import { ControlFallback } from './ControlFallback';
import { OwnCanvasModulateProvider, WHITE_MODULATE } from '../../canvasItemModulate';
import { useInheritedTextureSampler } from '../../canvasItemTextureSampler';
import { LitCanvasItemPixels } from '../../components/LitCanvasItemPixels';
import { ClipChildrenScope } from '../../canvasGroup/ClipChildrenScope';
import { ClipMaskProvider } from '../../canvasGroup/ClipMaskContext';
import {
  useCanvasAncestorMaterial,
  useResolvedCanvasItemMaterial,
} from '../../components/canvasItemMaterialContext';
import { INHERIT_PARENT_MATERIAL } from '../../canvasAncestors';
import { isCanvasLayerType, ysortsChildren } from '../../canvasPaintOrder';
import { CanvasRootScope } from '../../canvasRootScope';
import { CanvasItemGroup, CanvasItemProvider } from '../../components/CanvasItemGroup';
import { NodePathProvider } from '../../contexts/NodePathContext';
import { snapControlsToPixelsEnabled, snappedControlOriginUnder } from './controlPixelSnap';
import { applyYSortShifts, controlTransformsOf, solvedDrawTransformOf } from './controlYSort';
import { usePublishControlTransforms, useYSortShifts } from '../../contexts/ControlYSortContext';
import { useProjectSettings } from '../../contexts/ProjectSettingsContext';
import {
  CanvasItemChildScope,
  SkippedCanvasItemsScope,
  useCanvasItemState,
  ownAndBackSlots,
  wholeKeySlot,
  type CanvasItemState,
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
  /**
   * A position the root Controls' parent adds before the snap. Godot sets a scene tile root's position
   * to `map_to_local + position`, so the snap rounds the sum (`tile_map_layer.cpp:1636`). It reaches
   * the first root and each root promoted past the placement chain; a `top_level` root sits at it.
   */
  rootOffset?: Vector2;
  /** Called after each solve, with the solved controls keyed by tree path. */
  onSolved?: (solved: ReadonlyMap<string, SolvedControl>) => void;
}

export function ControlCanvasWalker({
  tree,
  generation,
  viewport,
  theme,
  measurer,
  snapToPixels,
  rootOffset,
  onSolved,
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
  useEffect(() => {
    onSolved?.(solved);
  }, [solved, onSolved]);
  // A y-sort in the world sorts the Controls on where this solve puts them, and moves their runs.
  // A layout effect, so the sort and this walk settle before the first paint.
  const publishTransforms = usePublishControlTransforms();
  const owner = useId();
  useLayoutEffect(() => {
    publishTransforms?.(owner, controlTransformsOf(tree, solved, snapEnabled));
  }, [publishTransforms, owner, tree, solved, snapEnabled]);
  useLayoutEffect(() => () => publishTransforms?.(owner, null), [publishTransforms, owner]);
  const shifts = useYSortShifts();
  const drawn = useMemo(() => applyYSortShifts(tree, shifts), [tree, shifts]);

  return (
    <>
      {drawn.map((n) => (
        <WalkRoot
          key={n.path}
          solveNode={n}
          isFirst={n === drawn[0]}
          solved={solved}
          theme={theme}
          measureText={measurer}
          snapToPixels={snapEnabled}
          rootOffset={rootOffset}
        />
      ))}
    </>
  );
}

/**
 * A root of a walk. `rootOffset` reaches the first root and a root promoted past the placement chain.
 * A root with no skipped ancestors parents at the canvas, so it ignores the transform above the walk
 * and the first one sits at the offset.
 */
function WalkRoot({
  isFirst,
  rootOffset,
  ...group
}: Omit<ControlNodeGroupProps, 'rootOffset'> & { isFirst: boolean; rootOffset: Vector2 | undefined }) {
  const { solveNode } = group;
  const hasSkippedAncestors = solveNode.skippedAncestors !== null;
  const content = (
    <ControlNodeGroup {...group} rootOffset={isFirst || hasSkippedAncestors ? rootOffset : undefined} />
  );
  if (!rootOffset || hasSkippedAncestors) return content;
  return (
    <CanvasRootScope node={solveNode.node} parentIsCanvasItem={false}>
      {isFirst ? (
        <CanvasItemGroup position={[rootOffset.x, -rootOffset.y, 0]}>{content}</CanvasItemGroup>
      ) : (
        content
      )}
    </CanvasRootScope>
  );
}

interface ControlNodeGroupProps {
  solveNode: SolveNode;
  solved: ReadonlyMap<string, SolvedControl>;
  theme: NativeTheme;
  measureText: TextMeasurer | null;
  /** `Viewport::is_snap_controls_to_pixels_enabled()` (`controlPixelSnap.ts`). */
  snapToPixels: boolean;
  /** `ControlCanvasWalkerProps.rootOffset`, set on the roots `WalkRoot` chooses only. */
  rootOffset?: Vector2;
}

/**
 * A Control's `CanvasItemMaterial`: its own, or with `use_parent_material` the parent item's. A
 * skipped Node2D chain above a promoted Control is that parent item, so it decides unless every
 * skipped ancestor defers to the Control above. Each reference resolves in the scope of the node
 * that names it: an instanced sub-scene names its materials in its file.
 */
function useControlMaterial(
  solveNode: SolveNode,
  props: ControlProperties
): CanvasItemMaterialProperties | null {
  const useParentMaterial = props.useParentMaterial;
  const skipped = solveNode.skippedAncestors?.material;
  const ownOrAmbient = useResolvedCanvasItemMaterial(
    { ref: props.materialPath, useParentMaterial },
    solveNode.resources
  );
  const fromSkippedAncestors = useCanvasAncestorMaterial(skipped ?? INHERIT_PARENT_MATERIAL);
  return useParentMaterial && skipped ? fromSkippedAncestors : ownOrAmbient;
}

/**
 * A Control's CanvasItem state. `show_behind_parent` never enters its `z_final`: `_cull_canvas_item`
 * runs both child loops with one `p_z` (`renderer_canvas_cull.cpp:471-490`). The draw sequence counts
 * all live siblings, so Controls interleave with Node2D items.
 */
function useControlState(solveNode: SolveNode, props: ControlProperties): CanvasItemState {
  return useCanvasItemState({
    modulate: props.modulate ?? WHITE_MODULATE,
    selfModulate: props.selfModulate ?? WHITE_MODULATE,
    zIndex: props.zIndex,
    zAsRelative: props.zAsRelative,
    material: useControlMaterial(solveNode, props),
    // Own-or-ambient, not multiplicative: neither property has a self-only layer,
    // so one fold serves this painter and the descendants.
    sampler: useInheritedTextureSampler(
      props.textureFilter,
      props.textureRepeat,
      solveNode.skippedAncestors?.sampler
    ),
    lightMask: props.lightMask,
    sequence: solveNode.paintSequence,
  });
}

/**
 * One Control, under the skipped Node2D chain it promoted past (`SolveNode.skippedAncestors`), when
 * there is one. A product of ancestors can shear, so the chain's transform goes in as a whole matrix.
 */
function ControlNodeGroup(props: ControlNodeGroupProps) {
  const skipped = props.solveNode.skippedAncestors;
  if (!skipped) return <ControlItemGroup {...props} />;
  // paint-order-safe: outside the keyed item group, never between it and a mesh.
  return (
    <group matrix={threeMatrixFromTransform2D(skipped.transform)} matrixAutoUpdate={false}>
      <SkippedCanvasItemsScope skipped={skipped}>
        <ControlItemGroup {...props} />
      </SkippedCanvasItemsScope>
    </group>
  );
}

function ControlItemGroup({
  solveNode,
  solved,
  theme,
  measureText,
  snapToPixels,
  rootOffset,
}: ControlNodeGroupProps) {
  const props = controlProps(solveNode);
  const state = useControlState(solveNode, props);
  const { key: renderOrder, tint } = state;
  // For chrome drawn after the whole subtree (Godot's `INTERNAL_MODE_BACK`), from the
  // sequence value the allocator holds after it (`internalBackRoom`).
  const backKey = state.keyAt(solveNode.backSequence);
  const { slot, chromeSlot } = useMemo(() => ownAndBackSlots(renderOrder, backKey), [renderOrder, backKey]);
  const layerKey = state.keyAt(solveNode.layerSequence);
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
  const origin = snappedControlOriginUnder(rect, rootOffset ?? VECTOR2_ZERO, transform, snapToPixels);

  const Painter = controlComponentRegistry.get(solveNode.node.type) ?? ControlFallback;
  const childElements = solveNode.children.map((child) => (
    <ControlNodeGroup
      key={child.path}
      solveNode={child}
      solved={solved}
      theme={theme}
      measureText={measureText}
      snapToPixels={snapToPixels}
    />
  ));

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
        chromeSlot={chromeSlot}
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
      behindRanges={solveNode.behindRanges}
      range={solveNode.paintRange}
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
        {/* The painter sits in the scope too: Godot tests an item's light window against its
            own `z_final`, and its descendants start from that value. */}
        <CanvasItemChildScope state={state}>
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
        </CanvasItemChildScope>
      </CanvasItemProvider>
    </group>
  );
}
