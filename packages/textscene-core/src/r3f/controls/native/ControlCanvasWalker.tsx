/**
 * `<ControlCanvasWalker>` — solves `tree` (from `buildSolveTree`) against
 * `viewport`/`theme` and emits one named `<group>` per Control at its solved
 * rect, in Godot pixels with +Y down converted to three's `-y` (`rect.ts`'s
 * convention: negate Y at the point of positioning, no whole-subtree
 * conjugation the way Node2D needs — see `node2dTransform.ts` — because
 * nothing here shears).
 *
 * That emitted origin is SNAPPED to whole pixels (`controlPixelSnap.ts`, the
 * port of `Control::_update_canvas_item_transform`) while the solved rect it
 * comes from stays fractional — Godot rounds the canvas item, never
 * `get_rect()`, and the solve's own arithmetic depends on the full-precision
 * value.
 *
 * A registered painter (`ControlComponentRegistry`) draws the node's own
 * chrome; `<ControlFallback>` draws an outline instead when none is
 * registered yet. Children render as siblings of the painter, not passed
 * through it as React children — the rect solver already gave every child an
 * absolute (parent-relative) rect, so no painter needs to arrange them the
 * way a DOM container's CSS does.
 *
 * Free-Control rotation/scale/pivot (`Container::fit_child_in_rect`'s rule: a
 * Container resets its children's transform, ending with
 * `set_rotation(0)`/`set_scale(Vector2(1,1))`) go on an inner group about the
 * pivot, applied ONLY when this node's PARENT imposes no registered
 * `ContainerLayoutFn` — i.e. the same free/anchored-vs-container split
 * `controlRectSolver.ts`'s own `dispatchChildren` already made when it solved
 * this node's rect, read from the SAME registry so the two paths cannot
 * disagree about which nodes are "free".
 *
 * Also publishes `EffectiveZProvider` for every node's own children — Controls
 * are CanvasItems too, and the whole native layer mounts inside
 * `CanvasLighting2DProvider` so a `PointLight2D`'s `range_z_min`/`range_z_max`
 * culling can reach them. Each node accumulates its OWN `z_index` onto the
 * ambient it read (`accumulateCanvasItemZ` — the ONE accumulation rule this
 * codebase has, shared with `CanvasItem2D.tsx`'s Node2D path and
 * `canvaslayer/Component.tsx`'s reset to 0), never the other way around.
 */
import { useMemo } from 'react';
import type { Rect2 } from './rect';
import { controlProps, type SolveNode } from './solveTree';
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
  /** Bumps when a sub-scene/texture resolves (see `buildSolveTree`) — a dep the memo below can see. */
  generation: number;
  viewport: Rect2;
  theme: NativeTheme;
  measurer: TextMeasurer | null;
  /**
   * `Viewport::is_snap_controls_to_pixels_enabled()` for the viewport THIS
   * walk draws into. Omitted means "the root window's", i.e. the project
   * setting — see the walker's own body for why a caller that owns a
   * different viewport must state it.
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
  // Resolved once for the whole tree: the flag is per-VIEWPORT in Godot
  // (`Viewport::snap_controls_to_pixels`, `scene/main/viewport.h`), not
  // per-node, so every node below answers to the same value.
  //
  // The project setting is the ROOT window's value and nothing else's:
  // `main/main.cpp` does `sml->get_root()->set_snap_controls_to_pixels(
  // GLOBAL_GET("gui/common/snap_controls_to_pixels"))`, while every other
  // Viewport keeps the member's own `= true` initialiser. So a project that
  // opts out turns the snap off for the root viewport ALONE, and a caller
  // walking into a viewport of its own states the flag rather than inheriting
  // a value that was never propagated there.
  const projectSnapToPixels = snapControlsToPixelsEnabled(useProjectSettings().settings);
  const snapEnabled = snapToPixels ?? projectSnapToPixels;

  const solved = useMemo(() => {
    const ctx = createSolveContext(theme, measurer);
    return solveControlTree(tree, viewport, ctx);
    // `generation` is an intentional cache-buster (see `buildSolveTree.ts`):
    // a StyleBox/texture inside `tree` can change value without `tree`'s own
    // reference necessarily doing so from this memo's point of view, so the
    // bump forces a re-solve. Not read inside the callback.
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
  /** Whether THIS node's parent imposes no container layout — see module doc. */
  isFreeParent: boolean;
  theme: NativeTheme;
  measureText: TextMeasurer | null;
  /** `Viewport::is_snap_controls_to_pixels_enabled()` — see `controlPixelSnap.ts`. */
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
  const inheritedModulate = useInheritedModulate(props.modulate);
  // The painter's own pixels continue the SAME chain one `self_modulate`
  // further. Resolved here, not in the painter: the fold above is the walker's,
  // and a painter reading it back from the provider is sixteen re-entries into
  // one composition (`NativeControlComponentProps.tint`).
  const tint = useControlOwnTint(inheritedModulate, solveNode);
  // Same shape as `inheritedModulate` above, but "own-or-ambient" rather than
  // multiplicative: neither property has a self-only layer, so the ONE fold
  // is both what this node's own painter samples with and what its
  // descendants inherit.
  const sampler = useInheritedTextureSampler(props.textureFilter, props.textureRepeat);
  // `solveNode.hidden` rather than a second read of `hiddenNodePaths`: the
  // SOLVE already consulted it (`buildSolveTree.ts`), and two reads of one
  // toggle could disagree about which node the container laid out.
  const isVisible = !solveNode.hidden && props.visible !== false;

  // Structurally guaranteed present (the solve walks this exact tree); the
  // fallback only guards a mismatched tree/solved pair from ever crashing.
  const solvedEntry = solved.get(solveNode.path);
  const rect = solvedEntry?.rect ?? ZERO_RECT;

  // `useCanvasLayerIndex` reads whichever CanvasLayer band is ambient at this
  // position — `WORLD_CANVAS_LAYER` (0) with none, or the value a `CanvasLayer`
  // ancestor's own painter published — see the `wrapsChildren` branch
  // below, which the registration declares rather than the walker testing a
  // type name.
  const layer = useCanvasLayerIndex();
  const layerRank = useLayerRank(layer);
  // Godot's `z_final`: this Control's own `z_index` accumulated onto the
  // ambient a CanvasItem2D ancestor (or an enclosing CanvasLayer's painter,
  // which resets it to 0 — a fresh canvas) published, clamped exactly as
  // `CanvasItem2D.tsx` clamps it for Node2D — the ONE accumulation rule
  // (`accumulateCanvasItemZ`), not a parallel one for Controls. Controls have
  // no parsed `z_as_relative` override (`ControlProperties`), so this always
  // takes Godot's own default of relative-true. `show_behind_parent` never
  // enters this: `renderer_canvas_cull.cpp`'s `_cull_canvas_item` calls both
  // its behind-children and front-children loops with the SAME `p_z` — the
  // flag reorders draw order, not z accumulation.
  const parentEffectiveZ = useEffectiveZ();
  const effectiveZ = accumulateCanvasItemZ(parentEffectiveZ, { z_index: props.zIndex ?? 0 });

  // This Control's place in the canvas — the SAME key, from the same function,
  // that every Node2D canvas item takes (`canvasPaintOrder.ts`). Its sequence
  // comes from the node's position among ALL its live siblings, which is what
  // lets it interleave with them rather than sitting in a band of its own.
  const renderOrder = canvasRenderOrder({
    layerRank,
    zFinal: effectiveZ,
    sequence: solveNode.paintSequence,
  });
  // Second key, for chrome that must draw after this node's WHOLE subtree
  // (Godot's `INTERNAL_MODE_BACK` — see `NativeControlComponentProps.
  // subtreeChromeRenderOrder`'s own doc). The subtree owns a CONTIGUOUS run, so
  // "after all of it" is simply the run's last value.
  const subtreeChromeRenderOrder = canvasRenderOrder({
    layerRank,
    zFinal: effectiveZ,
    sequence: solveNode.paintRange.base + solveNode.paintRange.size - 1,
  });

  // `Container::fit_child_in_rect` resets a container child's transform, so a
  // node whose parent imposes a layout has an EFFECTIVE rotation of 0 and an
  // effective scale of 1 whatever it authored — which the pixel snap's own
  // rotation gate must see too, not just the inner group below.
  const rotation = isFreeParent ? (props.rotation ?? 0) : 0;
  const scaleX = isFreeParent ? (props.scale?.x ?? 1) : 1;
  const scaleY = isFreeParent ? (props.scale?.y ?? 1) : 1;
  const hasOwnTransform = rotation !== 0 || scaleX !== 1 || scaleY !== 1;
  const pivotX = (props.pivotOffset?.x ?? 0) + (props.pivotOffsetRatio?.x ?? 0) * rect.w;
  const pivotY = (props.pivotOffset?.y ?? 0) + (props.pivotOffsetRatio?.y ?? 0) * rect.h;

  // Godot floors the CANVAS ITEM's translation to whole pixels, leaving
  // `get_rect()` — everything the solve above consumed — at full precision.
  // The inner pivot/rotation/scale groups contribute their own translation to
  // the same composite, so this is the outer half of an origin snapped as one.
  const origin = snappedControlOrigin(
    rect,
    { rotation, scale: { x: scaleX, y: scaleY }, pivot: { x: pivotX, y: pivotY } },
    snapToPixels
  );

  const Painter = controlComponentRegistry.get(solveNode.node.type) ?? ControlFallback;
  // Whether THIS node's own children are free — mirrors dispatchChildren's
  // exact registry read so the walker and the solver never disagree.
  const childIsFreeParent = controlSolverRegistry.containerLayout(solveNode.node.type) === undefined;

  // The CONTEXT carries this node's z to its DESCENDANTS, matching
  // `CanvasItem2D.tsx`'s `EffectiveZProvider` placement. This node's own
  // painter gets the same value by prop instead, because Godot tests an item
  // against its own accumulated z, not its parent's — and the ambient a
  // painter would read here is the parent's. See
  // `NativeControlComponentProps.effectiveZ` for why that asymmetry is a prop
  // rather than something a painter is trusted to re-derive.
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

  // A `CanvasLayer` is not chrome, it is a passthrough canvas boundary — its
  // painter (`canvaslayer/Component.tsx`) needs to WRAP its
  // descendants in fresh `CanvasLayerIndexProvider`/modulate context, which
  // only works if they are its React children rather than its siblings. Every
  // other registered painter draws fixed chrome unrelated to its descendants'
  // own React subtree, so it keeps the sibling shape (`NativeControlComponentProps`'s
  // own doc comment). The registration declares this rather than the walker
  // testing a type name, so a second such type adds no branch here.
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

  return (
    // Every group this node emits carries the key, not just the outermost:
    // three takes `groupOrder` from the NEAREST enclosing group, so a bare
    // transform group in between would reset the item's place in the canvas to
    // zero for the pixels inside it.
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
}
