/**
 * What a Control's solver computes and hands to its painter rather than either
 * recomputing it — the two mechanisms, and the one question that picks between
 * them.
 *
 * **Does the computation read `SolveContext` beyond `theme`?**
 *
 * NO — it reads only the node and the theme, so it is not solve output at all
 * and nothing needs to travel. It is a **share** ({@link defineShare}): ONE
 * computation, memoised per `(SolveNode, theme)`, that the registered
 * `MinimumSizeFn`/`ContainerLayoutFn` and the painter both call. There is no
 * intermediate and no fallback arm, so the two cannot disagree and no test can
 * exercise an arm production never takes.
 *
 * YES — it genuinely is solve output, reachable only from the pass that ran.
 * It is a **channel** ({@link defineChannel}): a module-level object the
 * producing slice and its painter both import. The producer seals a value onto
 * `ContainerLayoutResult.meta`, the painter opens it against the same channel,
 * and reference equality on the channel proves the value's PROVENANCE rather
 * than merely its shape — which a hand-rolled `isFooShape(meta)` guard cannot,
 * since a props literal of the right shape passes it.
 *
 * ## Why a share's memo key is `(node, theme)` and nothing else
 *
 * The node half is identity, not a deep compare, and that is sound because
 * `buildSolveTree` rebuilds the whole forest whenever anything a solve reads
 * can have changed: its `generation` cache-buster bumps on every scene,
 * texture, resource, theme and font arrival AND on a runtime font's metrics
 * settling (`buildSolveTree.ts:1031-1097`, `text/sceneFontLoader.ts`'s
 * `onSceneFontMetricsSettled`). So a settled font — the one input a share
 * reads through a mutable cache rather than off the node — produces new
 * `SolveNode` objects and a fresh computation.
 *
 * The theme half is load-bearing for the opposite reason: `theme` is NOT a
 * dependency of that memo, so a `SolveNode` SURVIVES a theme change and a
 * node-only key would serve a stale shape. Theme identity is stable across
 * renders because the two places that BUILD one memoise it on the scale alone
 * (`ControlCanvasLayer.tsx:65`, `ControlRasterPass.tsx:129`); every nested
 * walker forwards that same object.
 *
 * ## What a share's callback may not read
 *
 * `n.children` — `sortableView` (`solveTree.ts:336-339`) hands the solver a
 * COPY with promoted children filtered out, so a share reading it would answer
 * differently for the solver and the painter. {@link ShareNode} is what makes
 * that a type error; `n.node.children` (the raw child list, which
 * `sortableView` does not touch) stays legal and is how MenuBar reaches its
 * PopupMenus.
 *
 * `ctx.combinedMinimumSize` / `ctx.tentativeRect` / `ctx.measureText` — the
 * first two differ between the two passes a `registerSizeDependentMinimum`
 * type forces, and the third is a READINESS gate whose answer differs between
 * solve and paint. A share's callback is handed no `SolveContext` at all, so
 * none of the three is in scope; the gate stays in the solver wrapper and the
 * share is the unconditional shaping computation the painter already performs.
 *
 * `solveHandoffConformance.test.ts` holds both halves.
 */
import type { NativeTheme } from './nativeTheme';
import type { ShareNode } from './solveTree';

/**
 * What a share's callback may see: a `SolveNode` minus `children`.
 *
 * A real `SolveNode` is assignable, so every caller passes one unchanged —
 * the narrowing exists only inside the callback, and travels transitively to
 * every helper the callback hands the node to.
 */
export type { ShareNode };

/** One computation, called by a slice's solver and by its painter — see this module's own doc. */
export type Share<T> = (n: ShareNode, theme: NativeTheme) => T;

/** Boxed so a share whose value is `undefined`/`null` is still a cache HIT. */
interface Memoised<T> {
  readonly value: T;
}

/**
 * Declares a share: `compute` runs at most once per `(node, theme)` pair and
 * every later call with the same pair returns the same object.
 *
 * Both maps are weak, so a discarded generation's nodes and a replaced theme
 * take their memo entries with them.
 */
export function defineShare<T>(compute: Share<T>): Share<T> {
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

/** Marks a sealed value and names the channel that sealed it. Not exported: the token IS the proof, so nothing outside this module may forge one. */
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
 * produces one, so a producer cannot attach a raw object and a painter test
 * cannot fabricate one — the mistake the old `unknown` let through silently.
 */
export interface SealedHandoff {
  readonly [SEALED_BRAND]: never;
}

/** A value the producing slice seals and its own painter opens — see this module's own doc. */
export interface Channel<T> {
  /** The name this channel reports itself by. Diagnostics only — provenance is the channel OBJECT, never this string. */
  readonly label: string;
  /** Wraps `value` for `ContainerLayoutResult.meta`. */
  seal(value: T): SealedHandoff;
  /**
   * Unwraps a value THIS channel sealed, or `undefined` for anything else —
   * another channel's value, a hand-built object, or no value at all.
   *
   * Total by contract: the walker passes `solvedEntry?.meta` and degrades a
   * mismatched tree/solved pair to a zero rect rather than crashing
   * (`ControlCanvasWalker.tsx:209-211,338`), so an opener that threw would
   * reintroduce that crash.
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

/** Whether `value` was sealed by SOME channel — what the runtime conformance guard asserts about every solved entry that carries one. */
export function isSealedHandoff(value: unknown): boolean {
  return typeof value === 'object' && value !== null && SEALED in value;
}
