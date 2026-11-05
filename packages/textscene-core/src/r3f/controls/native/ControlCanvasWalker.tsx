/**
 * Solves `tree` against `viewport` and `theme`, and emits one named `<group>` per
 * Control at its solved rect, Y negated per axis (`rect.ts`): a Control's own rect
 * never shears. A registered painter draws the chrome, `<ControlFallback>` otherwise.
 * Children render beside the painter, since the solve has already placed them.
 */
import { useMemo } from 'react';
import type { Rect2 } from '../../../godot/math/rect2';
import { controlProps, type SolveNode } from './solveTree';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { CanvasItemMaterialProperties } from '../../../resources/materials/canvasitemmaterial/types';
import { threeMatrixFromTransform2D } from '../../node2dTransform';
import type { NativeTheme } from './nativeTheme';
import { controlSolverRegistry, type TextMeasurer } from './solverRegistry';
import { createSolveContext, solveControlTree, type SolvedControl } from './controlRectSolver';
import { controlComponentRegistry } from '../ControlComponentRegistry';
import { ControlFallback } from './ControlFallback';
import { WHITE_MODULATE } from '../../canvasItemModulate';
import { useInheritedTextureSampler } from '../../canvasItemTextureSampler';
import { LitCanvasItemPixels } from '../../components/LitCanvasItemPixels';
import { useResolvedCanvasItemMaterial } from '../../components/canvasItemMaterialContext';
import { isCanvasLayerType } from '../../canvasPaintOrder';
import { CanvasItemGroup, CanvasItemKeyProvider } from '../../components/CanvasItemGroup';
import { NodePathProvider } from '../../contexts/NodePathContext';
import { snapControlsToPixelsEnabled, snappedControlOrigin } from './controlPixelSnap';
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
}

const ZERO_RECT: Rect2 = { x: 0, y: 0, w: 0, h: 0 };

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
  const fromSkippedAncestor = useResolvedCanvasItemMaterial(
    { ref: skipped?.kind === 'own' ? skipped.ref : undefined, useParentMaterial: false },
    skipped?.kind === 'own' ? skipped.resources : solveNode.resources
  );
  if (!useParentMaterial || !skipped || skipped.kind === 'inherit') return ownOrAmbient;
  return skipped.kind === 'own' ? fromSkippedAncestor : null;
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
  isFreeParent,
  theme,
  measureText,
  snapToPixels,
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

  const childElements = solveNode.children.map((child) => (
    <ControlNodeGroup
      key={child.path}
      solveNode={child}
      solved={solved}
      isFreeParent={childIsFreeParent}
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
        {wrapsChildren ? childElements : undefined}
      </Painter>
    </NodePathProvider>
  );
  // The leaf meshes of a painter read the lit pixel material through context. A CanvasLayer is no
  // CanvasItem, so it declares no item: one would add a light list to the layer's placement.
  const litPainter = isCanvasLayerType(solveNode.node.type) ? (
    painter
  ) : (
    <LitCanvasItemPixels material={state.material} lightMask={state.lightMask} zFinal={state.zFinal}>
      {painter}
    </LitCanvasItemPixels>
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
      <CanvasItemKeyProvider value={renderOrder}>
        {/* The painter sits in the scope too: Godot tests an item's light window against its
            own `z_final`, and its descendants start from that value. */}
        <CanvasItemChildScope state={state}>
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
        </CanvasItemChildScope>
      </CanvasItemKeyProvider>
    </group>
  );
}
