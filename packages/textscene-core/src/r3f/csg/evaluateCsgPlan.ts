/**
 * Folds a `CsgPlan` into one geometry by running the booleans. The library and each solid arrive
 * as arguments, and contributions arrive ordered with root-local matrices, so the work is baking,
 * folding and mapping the result's material slots back onto the solids' materials.
 */

import * as THREE from 'three';
import { warn } from '../../logger';
import { type CsgContribution, type CsgPlan } from './csgPlan';
import { CsgOperation } from '../../godot/scene/csg';
import type { CsgModule } from './csgModule';
import { hasFaces, type CsgSolid } from './csgRegistration';
import { internMaterial, type CsgMaterialAddress } from './csgMaterials';

export interface CsgEvaluation {
  geometry: THREE.BufferGeometry;
  /**
   * The material of each slot of `geometry`, in slot order. The geometry's groups already index
   * into this array, so the renderer needs no group rewriting.
   */
  materials: CsgMaterialAddress[];
}

/** Resolve a contribution's own solid, in its own local space. */
type ResolveSolid = (contribution: CsgContribution) => CsgSolid | null;

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
    const slot = internMaterial(this.addresses, address);
    if (slot === this.sentinels.length) this.sentinels.push(new THREE.MeshBasicMaterial());
    return this.sentinels[slot]!;
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

    const run = (a: THREE.Mesh, b: THREE.Mesh, operation: number): THREE.Mesh => {
      const result = evaluator.evaluate(a, b, godotToLibraryOperation(operation, csg)) as THREE.Mesh;
      result.updateMatrixWorld(true);
      return result;
    };

    /**
     * `accumulator` with `brush` folded in by `operation`, where null is Godot's empty manifold:
     * it joins nothing, subtracts nothing, and leaves nothing to subtract from or intersect.
     */
    const fold = (accumulator: THREE.Mesh | null, brush: THREE.Mesh | null, operation: number) => {
      if (operation === CsgOperation.INTERSECTION) {
        return accumulator && brush ? run(accumulator, brush, operation) : null;
      }
      if (!brush) return accumulator;
      if (!accumulator) return operation === CsgOperation.SUBTRACTION ? null : brush;
      return run(accumulator, brush, operation);
    };

    /**
     * One node's brush: its own solid, then each child folded in by the child's operation
     * (csg_shape.cpp:472,481). A node with no solid starts empty, as a combiner does, so its own
     * operation applies to the whole fold, not to its first child. An open solid is empty and
     * empties the whole fold of its node, children included, as manifold's error status does.
     */
    const brushOf = (contribution: CsgContribution): THREE.Mesh | null => {
      const own = contribution.hasGeometry ? resolveSolid(contribution) : null;
      if (own && !own.isClosed) return null;

      let accumulator: THREE.Mesh | null = null;
      if (own && hasFaces(own)) {
        // Bake the root-local matrix in so every brush sits at identity: the library
        // copies brush A's world transform onto the result, so mixing baked and
        // transformed brushes would leave the output in whichever space A was in.
        accumulator = new csg.Brush(
          own.geometry.clone().applyMatrix4(contribution.matrix),
          sentinels.brushMaterial(own)
        );
        accumulator.updateMatrixWorld(true);
      }

      for (const child of contribution.children) {
        accumulator = fold(accumulator, brushOf(child), child.operation);
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
