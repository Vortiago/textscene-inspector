/**
 * The order of the offscreen viewport passes. One `useFrame` orchestrator drives
 * them all, where Godot walks the viewport tree bottom-up, so a pass that samples
 * another's target (a `ViewportTexture`, often on a nested `SubViewport`) runs after it.
 */

/** One pass in the dependency graph. */
export interface ViewportPassDependency {
  /** This pass's own identity: a dispatcher-absolute node path. */
  id: string;
  /** ids of the other passes this pass's content samples, which render before it. */
  dependsOn: readonly string[];
}

/** A cycle the sort found: no valid order exists between these passes. */
export interface ViewportPassCycle {
  /** The offending sampler: the pass whose dependency chain loops back to itself. */
  sampler: string;
  /** The cycle, starting and ending at the ancestor the closing edge points back to. */
  path: readonly string[];
}

export interface ViewportPassOrder {
  /**
   * Every pass id, dependencies before dependents wherever the graph allows.
   * A pass inside a cycle still appears, ordered by its acyclic dependencies,
   * so the orchestrator can place it or skip it.
   */
  order: readonly string[];
  /** Every cycle the sort found, in discovery order. Empty when the graph is a DAG. */
  cycles: readonly ViewportPassCycle[];
}

type VisitState = 'visiting' | 'done';

/**
 * Depth-first post-order over `dependsOn` edges, with white/gray/black cycle
 * detection. A cycle has no valid order, so the closing edge is dropped, not the
 * pass: its other dependencies still order, and the cycle is reported with the
 * sampler that closed it, so a caller can skip or warn about that pass alone.
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
      if (!dependsOn.has(dep)) continue; // A dangling reference has nothing to order against.
      if (state.get(dep) === 'visiting') {
        const cycleStart = stack.indexOf(dep);
        cycles.push({ sampler: id, path: [...stack.slice(cycleStart), dep] });
        continue; // Break the closing edge. This pass's other dependencies still order.
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
