/**
 * Paints the internal Controls of a Control (`internalControls.ts`): each at its solved rect, with
 * its registered painter and the rects of its direct children, and its own children drawn the same
 * way. A front Control draws from a piece of the parent's own slot, a back one from a piece of its
 * back slot, in tree order.
 */
import { useMemo } from 'react';
import { ZERO_RECT } from '../../../godot/math/rect2';
import { CanvasItemGroup } from '../../components/CanvasItemGroup';
import { canvasPieceSlot, type CanvasSlot } from '../../canvasItemState';
import { controlComponentRegistry, type NativeControlComponentProps } from '../ControlComponentRegistry';
import type { InternalControl } from './internalControls';
import { childRectsOf, type SolvedControl } from './controlRectSolver';
import { controlProps, type SolveNode } from './solveTree';

/** What every internal Control's painter takes from its parent's. */
export type InternalPainterEnv = Pick<
  NativeControlComponentProps,
  'theme' | 'measureText' | 'snapToPixels' | 'tint' | 'childTint'
>;

/** Every node of `roots`' trees, parents before children. */
function flattened(roots: readonly SolveNode[]): SolveNode[] {
  return roots.flatMap((root) => [root, ...flattened(root.children)]);
}

/** The pieces of `slot`, one for each node of `roots`' trees in tree order. */
function pieceSlots(roots: readonly SolveNode[], slot: CanvasSlot): [string, CanvasSlot][] {
  const nodes = flattened(roots);
  return nodes.map((node, index) => [node.path, canvasPieceSlot(slot, index, nodes.length)]);
}

/** The slot of every internal Control of a parent, by path. */
export function internalControlSlots(
  internals: readonly InternalControl[],
  slot: CanvasSlot,
  chromeSlot: CanvasSlot
): ReadonlyMap<string, CanvasSlot> {
  const roots = (mode: InternalControl['mode']) =>
    internals.filter((internal) => internal.mode === mode).map(({ node }) => node);
  return new Map([...pieceSlots(roots('front'), slot), ...pieceSlots(roots('back'), chromeSlot)]);
}

interface InternalControlGroupProps {
  node: SolveNode;
  solved: ReadonlyMap<string, SolvedControl>;
  slots: ReadonlyMap<string, CanvasSlot>;
  env: InternalPainterEnv;
}

/** One internal Control and its subtree. A Control with `visible` false draws nothing. */
export function InternalControlGroup({ node, solved, slots, env }: InternalControlGroupProps) {
  const childRects = useMemo(() => childRectsOf(node.children, solved), [node.children, solved]);
  if (controlProps(node).visible === false) return null;

  const entry = solved.get(node.path);
  const at = entry?.rect ?? ZERO_RECT;
  const slot = slots.get(node.path)!;
  const Painter = controlComponentRegistry.get(node.node.type);
  return (
    <CanvasItemGroup position={[at.x, -at.y, 0]} renderOrder={slot.key}>
      {Painter && (
        <Painter
          {...env}
          solveNode={node}
          rect={{ x: 0, y: 0, w: at.w, h: at.h }}
          renderOrder={slot.key}
          slot={slot}
          chromeSlot={slot}
          layerSlot={slot}
          childRects={childRects}
          meta={entry?.meta}
        />
      )}
      {node.children.map((child) => (
        <InternalControlGroup key={child.path} node={child} solved={solved} slots={slots} env={env} />
      ))}
    </CanvasItemGroup>
  );
}
