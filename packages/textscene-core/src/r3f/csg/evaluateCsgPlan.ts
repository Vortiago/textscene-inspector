/**
 * Folds a `CsgPlan` into one geometry by running the booleans.
 *
 * Pure apart from the library it is handed: the module and the per-contribution geometry
 * both arrive as arguments, so this is testable directly and could move behind a worker
 * later without touching a call site.
 *
 * Contributions arrive already ordered and already carrying root-local matrices, so the
 * only work here is baking, folding, and mapping the result's material slots back onto
 * the plan's surfaces.
 */

import * as THREE from 'three';
import { warn } from '../../logger';
import { CsgOperation, type CsgContribution, type CsgPlan } from './csgPlan';
import type { CsgModule } from './csgModule';

export interface CsgEvaluation {
  geometry: THREE.BufferGeometry;
  /**
   * Plan surface index per material slot of `geometry`, in slot order. The geometry's
   * groups already index into THIS array, so the renderer maps slot `i` to
   * `plan.surfaces[surfaceSlots[i]]` and needs no group rewriting.
   */
  surfaceSlots: number[];
}

/** Resolve a contribution's own solid, in its own local space. */
export type ResolveGeometry = (contribution: CsgContribution) => THREE.BufferGeometry | null;

function godotToLibraryOperation(operation: number, csg: CsgModule): number {
  switch (operation) {
    case CsgOperation.SUBTRACTION:
      return csg.SUBTRACTION;
    case CsgOperation.INTERSECTION:
      return csg.INTERSECTION;
    default:
      return csg.ADDITION;
  }
}

function emptyGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  return g;
}

/**
 * Evaluate a plan. Returns null when the booleans could not be run at all, which the
 * caller reports as `failed` and degrades to base primitives.
 *
 * A plan with no usable contributions evaluates to empty geometry rather than null:
 * "this root draws nothing" is a successful answer.
 */
export function evaluateCsgPlan(
  plan: CsgPlan,
  csg: CsgModule,
  resolveGeometry: ResolveGeometry
): CsgEvaluation | null {
  if (!plan.root) return { geometry: emptyGeometry(), surfaceSlots: [] };

  // One sentinel per plan surface. They are never rendered; they exist so the library can
  // group faces by material and so the result's material array can be mapped back.
  const sentinels = plan.surfaces.map(() => new THREE.MeshBasicMaterial());
  const slotOf = (material: THREE.Material | THREE.Material[]): number[] =>
    (Array.isArray(material) ? material : [material]).map((m) => sentinels.indexOf(m as THREE.MeshBasicMaterial));

  try {
    const evaluator = new csg.Evaluator();
    evaluator.useGroups = true;

    /**
     * One node's brush: its own solid, then each child folded in by the CHILD's operation
     * (csg_shape.cpp:472,481). A node with no own solid is seeded by its first child, whose
     * operation has nothing to fold into — which is what makes a combiner's own operation
     * apply to the whole fold rather than to its first child.
     */
    const brushOf = (contribution: CsgContribution): THREE.Mesh | null => {
      let accumulator: THREE.Mesh | null = null;
      if (contribution.hasGeometry) {
        const own = resolveGeometry(contribution);
        if (own && (own.getAttribute('position')?.count ?? 0) > 0) {
          // Bake the root-local matrix in so every brush sits at identity: the library
          // copies brush A's world transform onto the result, so mixing baked and
          // transformed brushes would leave the output in whichever space A was in.
          accumulator = new csg.Brush(
            own.clone().applyMatrix4(contribution.matrix),
            sentinels[contribution.surface]
          );
          accumulator.updateMatrixWorld(true);
        }
      }

      for (const child of contribution.children) {
        const brush = brushOf(child);
        if (!brush) continue;
        if (!accumulator) {
          accumulator = brush;
          continue;
        }
        accumulator = evaluator.evaluate(
          accumulator,
          brush,
          godotToLibraryOperation(child.operation, csg)
        ) as THREE.Mesh;
        accumulator.updateMatrixWorld(true);
      }
      return accumulator;
    };

    const accumulator = brushOf(plan.root);
    if (!accumulator) return { geometry: emptyGeometry(), surfaceSlots: [] };

    const surfaceSlots = slotOf(accumulator.material);
    // A slot whose sentinel is not ours means the library synthesised a material we did
    // not supply; fall back to surface 0 rather than indexing with -1.
    const safeSlots = surfaceSlots.map((s) => (s === -1 ? 0 : s));

    return { geometry: accumulator.geometry, surfaceSlots: safeSlots };
  } catch (error) {
    warn(
      `[CSG] Boolean evaluation failed for '${plan.rootPath}' ` +
        `(${plan.geometryCount} contributions): ${String(error)}`
    );
    return null;
  }
}
