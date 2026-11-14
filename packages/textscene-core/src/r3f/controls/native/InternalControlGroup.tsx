/**
 * Paints the internal Controls of a Control (`internalControls.ts`): each at its solved rect, snapped
 * and tinted as an authored Control is, with its registered painter and the rects of its direct
 * children. Its children and its own internal Controls draw the same way. A front Control draws from
 * a piece of the parent's own slot, a back one from a piece of its back slot, in tree order.
 */
import { useMemo } from 'react';
import { ZERO_RECT } from '../../../godot/math/rect2';
import type { Rgba } from '../../../godot/math/math';
import { snappedControlOrigin } from './controlPixelSnap';
import { solvedDrawTransformOf } from './solvedSortInputs';
import { CanvasItemGroup } from '../../components/CanvasItemGroup';
import { canvasPieceSlot, type CanvasSlot } from '../../canvasItemState';
import { useCanvasItemTint, WHITE_MODULATE } from '../../canvasItemModulate';
import {
  controlComponentRegistry,
  NO_PIECE_SLOTS,
  type NativeControlComponentProps,
} from '../ControlComponentRegistry';
import { internalControlsOf, type InternalControl } from './internalControls';
import { childRectsOf, type SolvedControl } from './controlRectSolver';
import { controlProps, type SolveNode } from './solveTree';
import type { NativeTheme } from './nativeTheme';

/** What every internal Control takes from its parent: the parent's painter inputs and the modulate product it hands down. */
export interface InternalPainterEnv extends Pick<
  NativeControlComponentProps,
  'theme' | 'measureText' | 'snapToPixels'
> {
  /** The parent's inherited modulate, without its `self_modulate` (`renderer_canvas_cull.cpp:268`). */
  inheritedModulate: Rgba;
  /**
   * The canvas modulate of the parent's material. An internal Control draws inside the parent's
   * material and light wrap (`LitCanvasItemPixels`), so its pixels take the same one.
   */
  canvasModulate: Rgba;
}

/**
 * Every node of `roots`' trees in draw order: a node, its own front internal Controls, its children,
 * then its own back internal Controls (`Node::INTERNAL_MODE_FRONT` and `_BACK`).
 */
function flattened(roots: readonly SolveNode[], theme: NativeTheme): SolveNode[] {
  return roots.flatMap((root) => {
    const nested = internalControlsOf(root, theme);
    const nestedIn = (mode: InternalControl['mode']) =>
      flattened(
        nested.filter((internal) => internal.mode === mode).map(({ node }) => node),
        theme
      );
    return [root, ...nestedIn('front'), ...flattened(root.children, theme), ...nestedIn('back')];
  });
}

/** The pieces of `slot`, one for each node of `roots`' trees in draw order. */
function pieceSlots(
  roots: readonly SolveNode[],
  slot: CanvasSlot,
  theme: NativeTheme
): [string, CanvasSlot][] {
  const nodes = flattened(roots, theme);
  return nodes.map((node, index) => [node.path, canvasPieceSlot(slot, index, nodes.length)]);
}

/** The slot of every node an internal Control of a parent draws, its nested internal Controls included, by path. */
function internalControlSlots(
  internals: readonly InternalControl[],
  slot: CanvasSlot,
  chromeSlot: CanvasSlot,
  theme: NativeTheme
): ReadonlyMap<string, CanvasSlot> {
  const roots = (mode: InternalControl['mode']) =>
    internals.filter((internal) => internal.mode === mode).map(({ node }) => node);
  return new Map([
    ...pieceSlots(roots('front'), slot, theme),
    ...pieceSlots(roots('back'), chromeSlot, theme),
  ]);
}

interface InternalControlGroupProps {
  node: SolveNode;
  solved: ReadonlyMap<string, SolvedControl>;
  slots: ReadonlyMap<string, CanvasSlot>;
  env: InternalPainterEnv;
}

interface InternalControlsProps {
  internals: readonly InternalControl[];
  solved: ReadonlyMap<string, SolvedControl>;
  slot: CanvasSlot;
  chromeSlot: CanvasSlot;
  env: InternalPainterEnv;
}

/** The internal Controls of one Control: each one's subtree, from the pieces of `slot` and `chromeSlot`. */
export function InternalControls({ internals, solved, slot, chromeSlot, env }: InternalControlsProps) {
  const slots = useMemo(
    () => internalControlSlots(internals, slot, chromeSlot, env.theme),
    [internals, slot, chromeSlot, env.theme]
  );
  return internals.map(({ node }) => (
    <InternalControlGroup key={node.path} node={node} solved={solved} slots={slots} env={env} />
  ));
}

/**
 * One internal Control and its subtree. A Control with `visible` false draws nothing. It tints its
 * pixels from its own `modulate` and `self_modulate` over what its parent hands down, as
 * `useCanvasItemState` does for an authored Control.
 */
function InternalControlGroup({ node, solved, slots, env }: InternalControlGroupProps) {
  const childRects = useMemo(() => childRectsOf(node.children, solved), [node.children, solved]);
  const props = controlProps(node);
  const tintInputs = useMemo(
    () => ({
      modulate: props.modulate ?? WHITE_MODULATE,
      self_modulate: props.selfModulate ?? WHITE_MODULATE,
    }),
    [props.modulate, props.selfModulate]
  );
  const tint = useCanvasItemTint(tintInputs, env.inheritedModulate, env.canvasModulate);
  const childEnv = useMemo(() => ({ ...env, inheritedModulate: tint.inherited }), [env, tint.inherited]);
  if (props.visible === false) return null;

  const entry = solved.get(node.path);
  const at = entry?.rect ?? ZERO_RECT;
  // The snap an authored Control's item takes (`ControlCanvasWalker.tsx`), from the same helpers.
  const origin = snappedControlOrigin(
    at,
    solvedDrawTransformOf(node, entry ?? { rect: at }),
    env.snapToPixels
  );
  const slot = slots.get(node.path)!;
  const Painter = controlComponentRegistry.get(node.node.type);
  const nested = internalControlsOf(node, env.theme);
  return (
    <CanvasItemGroup position={[origin.x, -origin.y, 0]} renderOrder={slot.key}>
      {Painter && (
        <Painter
          theme={env.theme}
          measureText={env.measureText}
          snapToPixels={env.snapToPixels}
          tint={tint}
          childTint={tint.internalChild}
          solveNode={node}
          rect={{ x: 0, y: 0, w: at.w, h: at.h }}
          renderOrder={slot.key}
          slot={slot}
          chromeSlot={slot}
          layerSlot={slot}
          pieceSlots={NO_PIECE_SLOTS}
          childRects={childRects}
          meta={entry?.meta}
        />
      )}
      {node.children.map((child) => (
        <InternalControlGroup key={child.path} node={child} solved={solved} slots={slots} env={childEnv} />
      ))}
      {nested.map(({ node: internal }) => (
        <InternalControlGroup
          key={internal.path}
          node={internal}
          solved={solved}
          slots={slots}
          env={childEnv}
        />
      ))}
    </CanvasItemGroup>
  );
}
