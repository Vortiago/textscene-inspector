/**
 * What a Control's solver hands its painter. A computation that reads only the
 * node and the theme is a share ({@link defineShare}) that both call, and one that
 * also reads the node's size is a rect share ({@link defineRectShare}). Solve
 * output is a channel ({@link defineChannel}) the solver seals and the painter
 * opens. `solveHandoffConformance.test.ts` guards all three.
 */
import type { Vector2 } from '../../../godot/math/vector';
import type { NativeTheme } from './nativeTheme';
import type { ShareNode } from './solveTree';

/**
 * What a share's callback may see: a `SolveNode` minus `children`, because
 * `sortableView` (`solveTree.ts:336-339`) hands the solver a copy without the
 * promoted children. `n.node.children`, the raw list, stays legal.
 */
// A real `SolveNode` is assignable, so a caller passes one unchanged, and the
// narrowing reaches every helper the callback hands the node to.
export type { ShareNode };

/** One computation on a {@link ShareNode}, called by a slice's solver and by its painter. */
// No `SolveContext`: `combinedMinimumSize` and `tentativeRect` differ between the
// passes a `registerSizeDependentMinimum` type forces, and the `measureText`
// readiness gate differs between solve and paint, so it stays in the solver wrapper.
type Share<T> = (n: ShareNode, theme: NativeTheme) => T;

/** Boxed so a share whose value is `undefined`/`null` is still a cache hit. */
interface Memoised<T> {
  readonly value: T;
}

/**
 * Declares a share: `compute` runs at most once per `(node, theme)` pair, so the
 * solver and the painter cannot disagree. Both maps are weak, so a discarded
 * generation's nodes and a replaced theme take their entries with them.
 */
// Node identity is a sound key: `useBuildSolveTree` rebuilds the forest on every scene,
// texture, resource, theme or font arrival, and on each `onSceneFontSettled` tick
// from `text/sceneFontLoader.ts`.
// A `SolveNode` survives a theme change, so the key needs the theme too.
export function defineShare<T>(compute: Share<T>): Share<T> {
  // Theme identity is stable: `nativeTheme` builds one theme per scale.
  const byNode = new WeakMap<ShareNode, WeakMap<NativeTheme, Memoised<T>>>();
  return (n, theme) => {
    let byTheme = byNode.get(n);
    if (!byTheme) {
      byTheme = new WeakMap<NativeTheme, Memoised<T>>();
      byNode.set(n, byTheme);
    }
    const hit = byTheme.get(theme);
    if (hit) return hit.value;
    const value = compute(n, theme);
    byTheme.set(theme, { value });
    return value;
  };
}

/** One layout of a node at a size, called by a slice's solver and by its painter. */
export type RectShare<T> = (n: ShareNode, size: Vector2, theme: NativeTheme) => T;

interface SizedEntry<T> extends Memoised<T> {
  readonly size: Vector2;
}

/**
 * The sizes a rect share keeps for one node and theme: the tentative size of the second solve
 * pass and the final rect, which the painter asks for too.
 */
const RECT_SHARE_SIZES = 2;

/**
 * Declares a rect share: `compute` runs at most once per `(node, theme, size)` while the size is
 * one of the last {@link RECT_SHARE_SIZES} asked for that node and theme. It gets no `SolveContext`,
 * for the reason {@link Share} gives.
 */
export function defineRectShare<T>(compute: RectShare<T>): RectShare<T> {
  const byNode = new WeakMap<ShareNode, WeakMap<NativeTheme, SizedEntry<T>[]>>();
  return (n, size, theme) => {
    let byTheme = byNode.get(n);
    if (!byTheme) {
      byTheme = new WeakMap<NativeTheme, SizedEntry<T>[]>();
      byNode.set(n, byTheme);
    }
    let entries = byTheme.get(theme);
    if (!entries) {
      entries = [];
      byTheme.set(theme, entries);
    }
    const hit = entries.find((entry) => entry.size.x === size.x && entry.size.y === size.y);
    if (hit) return hit.value;
    const value = compute(n, size, theme);
    entries.push({ size: { x: size.x, y: size.y }, value });
    if (entries.length > RECT_SHARE_SIZES) entries.shift();
    return value;
  };
}

/** Marks a sealed value and names the channel that sealed it. Not exported: the token is the proof, so nothing outside this module forges one. */
const SEALED = Symbol('solveHandoff.sealed');

interface Sealed<T> {
  readonly [SEALED]: object;
  readonly value: T;
}

declare const SEALED_BRAND: unique symbol;

/**
 * A value some channel sealed, as every hop between the producer and the
 * painter sees it (`ContainerLayoutResult.meta`, `SolvedControl.meta`,
 * `NativeControlComponentProps.meta`). Opaque: only {@link Channel.seal}
 * produces one, so neither a producer nor a painter test passes a raw object.
 */
export interface SealedHandoff {
  readonly [SEALED_BRAND]: never;
}

/**
 * A value the producing slice seals onto `ContainerLayoutResult.meta` and its
 * painter opens. Reference equality on the channel proves provenance, which a
 * shape guard cannot: a props literal of the right shape passes it.
 */
export interface Channel<T> {
  /** Diagnostics only: provenance is the channel object, never this string. */
  readonly label: string;
  /** Wraps `value` for `ContainerLayoutResult.meta`. */
  seal(value: T): SealedHandoff;
  /**
   * Unwraps a value this channel sealed, or `undefined` for anything else.
   * Never throws: the walker passes `solvedEntry?.meta` and degrades a mismatched
   * tree and solved pair to a zero rect (`ControlCanvasWalker.tsx:209-211,338`).
   */
  open(sealed: unknown): T | undefined;
}

export function defineChannel<T>(label: string): Channel<T> {
  const token = { label };
  return {
    label,
    // The one cast in this module: `SealedHandoff` is opaque by design, so the
    // real wrapper can only enter the type here.
    seal: (value) => ({ [SEALED]: token, value }) satisfies Sealed<T> as unknown as SealedHandoff,
    open: (sealed) => {
      if (typeof sealed !== 'object' || sealed === null) return undefined;
      const candidate = sealed as Partial<Sealed<T>>;
      if (candidate[SEALED] !== token) return undefined;
      return candidate.value;
    },
  };
}
