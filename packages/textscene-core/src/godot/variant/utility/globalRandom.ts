import { GodotRandomPCG } from '../../math/randomPcg.js';
import { UnportableUtility } from './unportableUtility.js';

const UNSEEDED =
  'the global random generator, which SceneTree seeds from the clock (scene_tree.cpp:2038), has no seed yet';

/** `Math`'s `default_rand` (math_funcs.cpp:36): its draws are Godot's only after a `seed` in the same run. */
export class GlobalRandom {
  // Nothing until `seed`, and again after `randomize`, which seeds from the clock.
  private generator: GodotRandomPCG | undefined;

  seed(seed: bigint): void {
    this.generator = new GodotRandomPCG(seed);
  }

  randomize(): void {
    this.generator = undefined;
  }

  /** The generator to draw from. Throws UnportableUtility before a seed. */
  draw(): GodotRandomPCG {
    if (!this.generator) throw new UnportableUtility(UNSEEDED);
    return this.generator;
  }
}
