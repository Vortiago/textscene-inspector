/**
 * Folds a `CsgPlan` into one geometry by running the booleans. The library and each solid arrive
 * as arguments, and contributions arrive ordered with root-local matrices, so the work is baking,
 * folding and mapping the result's material slots back onto the solids' materials.
 */

import * as THREE from 'three';
import { warn } from '../../logger';
import { CsgOperation, type CsgContribution, type CsgPlan } from './csgPlan';
import type { CsgModule } from './csgModule';
import type { CsgSolid } from './csgRegistration';
import type { CsgMaterialAddress } from './csgMaterials';

export interface CsgEvaluation {
  geometry: THREE.BufferGeometry;
  /**
   * The material of each slot of `geometry`, in slot order. The geometry's groups already index
   * into this array, so the renderer needs no group rewriting.
   */
  materials: CsgMaterialAddress[];
}

/** Resolve a contribution's own solid, in its own local space. */
export type ResolveSolid = (contribution: CsgContribution) => CsgSolid | null;

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

function emptyEvaluation(): CsgEvaluation {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  return { geometry, materials: [] };
}

/**
 * One sentinel material per distinct address, in first-seen order. They are never rendered: they
 * exist so the library can group faces by material and so the result's slots map back.
 */
class MaterialSentinels {
  readonly addresses: CsgMaterialAddress[] = [];
  private readonly sentinels: THREE.Material[] = [];

  sentinelFor(address: CsgMaterialAddress): THREE.Material {
    const existing = this.addresses.indexOf(address);
    if (existing !== -1) return this.sentinels[existing]!;
    this.addresses.push(address);
    const sentinel = new THREE.MeshBasicMaterial();
    this.sentinels.push(sentinel);
    return sentinel;
  }

  /** A slot whose sentinel is not ours means the library synthesised a material: it takes the first. */
  addressOf(material: THREE.Material): CsgMaterialAddress {
    const index = this.sentinels.indexOf(material);
    return this.addresses[index === -1 ? 0 : index];
  }

  /** The solid's one material, or the list its draw groups index. */
  brushMaterial(solid: CsgSolid): THREE.Material | THREE.Material[] {
    const materials = solid.materials.map((address) => this.sentinelFor(address));
    return materials.length > 1 ? materials : materials[0]!;
  }
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
  resolveSolid: ResolveSolid
): CsgEvaluation | null {
  if (!plan.root) return emptyEvaluation();

  const sentinels = new MaterialSentinels();

  try {
    const evaluator = new csg.Evaluator();
    evaluator.useGroups = true;

    /**
     * One node's brush: its own solid, then each child folded in by the child's operation
     * (csg_shape.cpp:472,481). A node with no solid is seeded by its first child, so a combiner's
     * own operation applies to the whole fold, not to its first child.
     */
    const brushOf = (contribution: CsgContribution): THREE.Mesh | null => {
      let accumulator: THREE.Mesh | null = null;
      if (contribution.hasGeometry) {
        const own = resolveSolid(contribution);
        if (own && (own.geometry.getAttribute('position')?.count ?? 0) > 0) {
          // Bake the root-local matrix in so every brush sits at identity: the library
          // copies brush A's world transform onto the result, so mixing baked and
          // transformed brushes would leave the output in whichever space A was in.
          accumulator = new csg.Brush(
            own.geometry.clone().applyMatrix4(contribution.matrix),
            sentinels.brushMaterial(own)
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
    if (!accumulator) return emptyEvaluation();

    const slots = Array.isArray(accumulator.material) ? accumulator.material : [accumulator.material];
    return { geometry: accumulator.geometry, materials: slots.map((m) => sentinels.addressOf(m)) };
  } catch (error) {
    warn(
      `[CSG] Boolean evaluation failed for '${plan.rootPath}' ` +
        `(${plan.geometryCount} contributions): ${String(error)}`
    );
    return null;
  }
}
