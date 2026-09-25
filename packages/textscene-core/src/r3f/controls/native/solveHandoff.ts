/**
 * What a Control's solver hands its painter. A computation that reads only the
 * node and the theme is a share ({@link defineShare}) that both call. Solve
 * output is a channel ({@link defineChannel}) the solver seals and the painter
 * opens. `solveHandoffConformance.test.ts` guards both.
 */
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
export type Share<T> = (n: ShareNode, theme: NativeTheme) => T;

/** Boxed so a share whose value is `undefined`/`null` is still a cache hit. */
interface Memoised<T> {
  readonly value: T;
}

/**
 * Declares a share: `compute` runs at most once per `(node, theme)` pair, so the
 * solver and the painter cannot disagree. Both maps are weak, so a discarded
 * generation's nodes and a replaced theme take their entries with them.
 */
// Node identity is a sound key: `buildSolveTree` rebuilds the forest on every scene,
// texture, resource, theme or font arrival and when a font's metrics settle
// (`buildSolveTree.ts:1031-1097`, `text/sceneFontLoader.ts`'s `onSceneFontMetricsSettled`).
// A `SolveNode` survives a theme change, so the key needs the theme too.
export function defineShare<T>(compute: Share<T>): Share<T> {
  // Theme identity is stable: both builders memoise it on the scale alone
  // (`ControlCanvasLayer.tsx:65`, `ControlRasterPass.tsx:129`).
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

/** Whether `value` was sealed by some channel. The runtime conformance guard asserts it for every solved entry that carries one. */
export function isSealedHandoff(value: unknown): boolean {
  return typeof value === 'object' && value !== null && SEALED in value;
}
