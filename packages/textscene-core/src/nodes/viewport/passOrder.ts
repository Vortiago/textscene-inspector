/**
 * The order of the offscreen viewport passes. One `useFrame` orchestrator drives them all, in the
 * order Godot's `_sort_active_viewports` gives (`renderer_viewport.cpp:91-125`): the deepest level
 * of nested viewports first, the viewports of one level in tree order. A viewport that samples a
 * deeper viewport outside its own subtree sees this frame's image, and one that samples a
 * shallower viewport sees the last frame's.
 */

import { compareTreeOrder, type TreeOrder } from '../../r3f/contexts/treeOrder.js';

/** One pass in the dependency graph. */
interface ViewportPassDependency {
  /** This pass's own identity: a dispatcher-absolute node path. */
  id: string;
  /** ids of the viewports nested one level down in this one's subtree, in tree order. */
  dependsOn: readonly string[];
  /**
   * The viewport node's place in tree order, or null while the dispatcher has not placed it. Only
   * a pass that no other pass encloses reads it: a nested one takes its place from `dependsOn`.
   */
  treeOrder: TreeOrder | null;
}

/** A cycle the sort found: no valid order exists between these passes. */
export interface ViewportPassCycle {
  /** The offending sampler: the pass whose dependency chain loops back to itself. */
  sampler: string;
  /** The cycle, starting and ending at the ancestor the closing edge points back to. */
  path: readonly string[];
}

interface ViewportPassOrder {
  /** Every pass id, in draw order. A pass inside a cycle still appears, so the orchestrator can skip it. */
  order: readonly string[];
  /** Every cycle the sort found, in discovery order. Empty when the graph is a DAG. */
  cycles: readonly ViewportPassCycle[];
}

/** Where a pass sits among the viewports: its nesting level, and its place in tree order. */
interface ViewportPlace {
  /** How many passes enclose it. Godot's level counts the root window too, which changes no order. */
  level: number;
  /** Null when the outermost pass around it has no place yet. */
  treeOrder: TreeOrder | null;
}

type VisitState = 'visiting' | 'done';

export function orderViewportPasses(passes: readonly ViewportPassDependency[]): ViewportPassOrder {
  const places = viewportPlaces(passes);
  // A stable sort, so passes that tie keep the order they registered in.
  const order = passes
    .map(({ id }) => ({ id, place: places.get(id)! }))
    .sort(
      (a, b) => b.place.level - a.place.level || compareKnownTreeOrder(a.place.treeOrder, b.place.treeOrder)
    )
    .map(({ id }) => id);
  return { order, cycles: findCycles(passes) };
}

/** Tree order, with an unplaced viewport after every placed one until the dispatcher places it. */
function compareKnownTreeOrder(a: TreeOrder | null, b: TreeOrder | null): number {
  if (a && b) return compareTreeOrder(a, b);
  return Number(a === null) - Number(b === null);
}

/**
 * Each pass's place. A nested pass takes the place the dispatcher gave it. One the dispatcher did
 * not reach extends its enclosing pass's place by its index in that pass's `dependsOn`, which lists
 * the nested viewports in tree order. A walk up a cycle stops where it repeats.
 */
function viewportPlaces(passes: readonly ViewportPassDependency[]): Map<string, ViewportPlace> {
  const byId = new Map(passes.map((pass) => [pass.id, pass]));
  const enclosing = new Map<string, { id: string; index: number }>();
  for (const pass of passes) {
    pass.dependsOn.forEach((nested, index) => {
      if (byId.has(nested) && nested !== pass.id) enclosing.set(nested, { id: pass.id, index });
    });
  }
  const places = new Map<string, ViewportPlace>();
  for (const { id } of passes) {
    const chain = [id];
    for (let up = enclosing.get(id); up && !chain.includes(up.id); up = enclosing.get(up.id))
      chain.push(up.id);
    places.set(id, { level: chain.length - 1, treeOrder: placedOrDerived(chain, byId, enclosing) });
  }
  return places;
}

/** The tree order of `chain[0]`, from the nearest pass in `chain`, inner to outer, that has a place. */
function placedOrDerived(
  chain: readonly string[],
  byId: ReadonlyMap<string, ViewportPassDependency>,
  enclosing: ReadonlyMap<string, { id: string; index: number }>
): TreeOrder | null {
  const indices: number[] = [];
  for (const id of chain) {
    const placed = byId.get(id)!.treeOrder;
    if (placed) return [...placed, ...indices];
    const up = enclosing.get(id);
    if (up) indices.unshift(up.index);
  }
  return null;
}

/**
 * Depth-first search over `dependsOn` edges, with white/gray/black cycle detection. A cycle has no
 * valid order, so it is reported with the sampler that closed it, and a caller can skip or warn
 * about that pass alone.
 */
function findCycles(passes: readonly ViewportPassDependency[]): ViewportPassCycle[] {
  const dependsOn = new Map<string, readonly string[]>();
  for (const pass of passes) dependsOn.set(pass.id, pass.dependsOn);

  const state = new Map<string, VisitState>();
  const stack: string[] = [];
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
        continue;
      }
      visit(dep);
    }

    stack.pop();
    state.set(id, 'done');
  }

  for (const pass of passes) visit(pass.id);

  return cycles;
}
