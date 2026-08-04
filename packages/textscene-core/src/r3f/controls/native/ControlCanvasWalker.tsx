/**
 * `<ControlCanvasWalker>` — solves `tree` (from `buildSolveTree`) against
 * `viewport`/`theme` and emits one named `<group>` per Control at its solved
 * rect, in Godot pixels with +Y down converted to three's `-y` (`rect.ts`'s
 * convention: negate Y at the point of positioning, no whole-subtree
 * conjugation the way Node2D needs — see `node2dTransform.ts` — because
 * nothing here shears).
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
 */
import { useMemo } from 'react';
import type { ControlProperties } from '../../../nodes/2d/ui/control/types';
import type { Rect2 } from './rect';
import type { SolveNode } from './solveTree';
import type { NativeTheme } from './nativeTheme';
import { controlSolverRegistry, type TextMeasurer } from './solverRegistry';
import { createSolveContext, solveControlTree, type SolvedControl } from './controlRectSolver';
import { controlComponentRegistry } from '../ControlComponentRegistry';
import { ControlFallback } from './ControlFallback';
import { Modulate2DContext, useControlTint } from './useControlTint';
import { useOptionalSelection } from '../../contexts/SelectionContext';
import { controlRenderOrder } from './controlDrawOrder';
import { useCanvasLayerIndex } from '../../lighting2d/canvasItemPlacement';

export interface ControlCanvasWalkerProps {
  tree: readonly SolveNode[];
  /** Bumps when a sub-scene/texture resolves (see `buildSolveTree`) — a dep the memo below can see. */
  generation: number;
  viewport: Rect2;
  theme: NativeTheme;
  measurer: TextMeasurer | null;
}

const NO_HIDDEN: ReadonlySet<string> = new Set();
const ZERO_RECT: Rect2 = { x: 0, y: 0, w: 0, h: 0 };

export function ControlCanvasWalker({ tree, generation, viewport, theme, measurer }: ControlCanvasWalkerProps) {
  const hiddenNodePaths = useOptionalSelection()?.hiddenNodePaths ?? NO_HIDDEN;

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
          hiddenNodePaths={hiddenNodePaths}
          isFreeParent
          theme={theme}
          measureText={measurer}
        />
      ))}
    </>
  );
}

interface ControlNodeGroupProps {
  solveNode: SolveNode;
  solved: ReadonlyMap<string, SolvedControl>;
  hiddenNodePaths: ReadonlySet<string>;
  /** Whether THIS node's parent imposes no container layout — see module doc. */
  isFreeParent: boolean;
  theme: NativeTheme;
  measureText: TextMeasurer | null;
}

function ControlNodeGroup({
  solveNode,
  solved,
  hiddenNodePaths,
  isFreeParent,
  theme,
  measureText,
}: ControlNodeGroupProps) {
  const props = solveNode.node.properties as ControlProperties;
  const tint = useControlTint(props.modulate, props.selfModulate);
  const isVisible = !hiddenNodePaths.has(solveNode.path) && props.visible !== false;

  // Structurally guaranteed present (the solve walks this exact tree); the
  // fallback only guards a mismatched tree/solved pair from ever crashing.
  const solvedEntry = solved.get(solveNode.path);
  const rect = solvedEntry?.rect ?? ZERO_RECT;

  // `useCanvasLayerIndex` reads whichever CanvasLayer band is ambient at this
  // position — `WORLD_CANVAS_LAYER` (0) with none, or the value a `CanvasLayer`
  // ancestor's own painter published — see the `wrapsChildren` branch
  // below, which the registration declares rather than the walker testing a
  // type name.
  // `paintIndex` is the solver's own pre-order counter (`controlRectSolver.ts`),
  // so `renderOrder` is deterministic across the whole tree by construction —
  // see `controlDrawOrder.ts` for why this replaces a z offset entirely.
  const layer = useCanvasLayerIndex();
  const renderOrder = controlRenderOrder(layer, solvedEntry?.paintIndex ?? 0);

  const rotation = props.rotation ?? 0;
  const scaleX = props.scale?.x ?? 1;
  const scaleY = props.scale?.y ?? 1;
  const hasOwnTransform = isFreeParent && (rotation !== 0 || scaleX !== 1 || scaleY !== 1);
  const pivotX = (props.pivotOffset?.x ?? 0) + (props.pivotOffsetRatio?.x ?? 0) * rect.w;
  const pivotY = (props.pivotOffset?.y ?? 0) + (props.pivotOffsetRatio?.y ?? 0) * rect.h;

  const Painter = controlComponentRegistry.get(solveNode.node.type) ?? ControlFallback;
  // Whether THIS node's own children are free — mirrors dispatchChildren's
  // exact registry read so the walker and the solver never disagree.
  const childIsFreeParent = controlSolverRegistry.containerLayout(solveNode.node.type) === undefined;

  const childElements = solveNode.children.map((child) => (
    <ControlNodeGroup
      key={child.path}
      solveNode={child}
      solved={solved}
      hiddenNodePaths={hiddenNodePaths}
      isFreeParent={childIsFreeParent}
      theme={theme}
      measureText={measureText}
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
      theme={theme}
      measureText={measureText}
      childRects={childRects}
    >
      {childElements}
    </Painter>
  ) : (
    <>
      <Painter
        solveNode={solveNode}
        rect={rect}
        renderOrder={renderOrder}
        theme={theme}
        measureText={measureText}
        childRects={childRects}
      />
      {childElements}
    </>
  );

  return (
    <group
      name={`${solveNode.node.type}:${solveNode.node.name}`}
      position={[rect.x, -rect.y, 0]}
      visible={isVisible}
    >
      <Modulate2DContext.Provider value={tint.inherited}>
        {hasOwnTransform ? (
          <group position={[pivotX, -pivotY, 0]} rotation={[0, 0, 0 - rotation]} scale={[scaleX, scaleY, 1]}>
            <group position={[-pivotX, pivotY, 0]}>{content}</group>
          </group>
        ) : (
          content
        )}
      </Modulate2DContext.Provider>
    </group>
  );
}
