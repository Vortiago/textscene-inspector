/**
 * Ordered viewport pass driver — the pure sort behind it.
 *
 * A viewport's offscreen pass may SAMPLE another viewport's published target
 * (a `ViewportTexture` on content nested inside it, most commonly a nested
 * `SubViewport`). Godot has no such ordering problem — it walks the viewport
 * tree bottom-up every frame — but this previewer drives every offscreen pass
 * from one `useFrame` orchestrator instead, so the passes themselves must be
 * fed to it dependencies-first: a pass that samples another must run AFTER
 * the one it samples, never before.
 *
 * `computePassOrder` is a plain topological sort (depth-first, post-order)
 * over `{ id, dependsOn }` records — no THREE, no React — so the ordering
 * rule is asserted directly rather than inferred from a rendered frame. A
 * cycle (two passes each depending, directly or transitively, on the other)
 * has no valid order; the sort still has to return SOMETHING for every pass
 * every frame, so it breaks the closing edge, keeps going, and reports which
 * pass discovered the impossible dependency — the offending sampler — plus
 * the cycle itself, so a caller can single that pass out (skip driving it,
 * warn) without losing the order of everything else.
 */

/** One pass in the dependency graph. */
export interface ViewportPassDependency {
  /** This pass's own identity — a dispatcher-absolute node path. */
  id: string;
  /** ids of the OTHER passes this pass's content samples — must render before this one. */
  dependsOn: readonly string[];
}

/** A cycle the sort found: no valid order exists between these passes. */
export interface ViewportPassCycle {
  /** The pass whose dependency chain loops back to itself — the offending sampler. */
  sampler: string;
  /** The cycle, starting and ending at the ancestor the closing edge points back to. */
  path: readonly string[];
}

export interface ViewportPassOrder {
  /**
   * Every pass id, dependencies before dependents wherever the graph allows
   * it. A pass inside a cycle still appears — using only whatever acyclic
   * dependencies it has — so the orchestrator has somewhere to put it (even
   * if it then chooses not to drive it).
   */
  order: readonly string[];
  /** Every cycle the sort found, in discovery order. Empty when the graph is a DAG. */
  cycles: readonly ViewportPassCycle[];
}

type VisitState = 'visiting' | 'done';

/**
 * Depth-first post-order over `dependsOn` edges, with cycle detection by the
 * standard white/gray/black colouring: a dependency still marked `visiting`
 * is an ancestor of the current DFS path, so recursing into it again would
 * never terminate. That edge is dropped (not followed) rather than the whole
 * pass being dropped — an unrelated acyclic dependency of the SAME pass must
 * still be ordered correctly.
 */
export function orderViewportPasses(
  passes: readonly ViewportPassDependency[]
): ViewportPassOrder {
  const dependsOn = new Map<string, readonly string[]>();
  for (const pass of passes) dependsOn.set(pass.id, pass.dependsOn);

  const state = new Map<string, VisitState>();
  const stack: string[] = [];
  const order: string[] = [];
  const cycles: ViewportPassCycle[] = [];

  function visit(id: string): void {
    if (state.get(id) === 'done') return;

    state.set(id, 'visiting');
    stack.push(id);

    for (const dep of dependsOn.get(id) ?? []) {
      if (!dependsOn.has(dep)) continue; // dangling reference — nothing to order against
      if (state.get(dep) === 'visiting') {
        const cycleStart = stack.indexOf(dep);
        cycles.push({ sampler: id, path: [...stack.slice(cycleStart), dep] });
        continue; // break the closing edge; this pass's other deps still order normally
      }
      visit(dep);
    }

    stack.pop();
    state.set(id, 'done');
    order.push(id);
  }

  for (const pass of passes) visit(pass.id);

  return { order, cycles };
}
