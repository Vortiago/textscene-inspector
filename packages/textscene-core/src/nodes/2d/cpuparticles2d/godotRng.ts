/**
 * The three random sources CPUParticles2D draws from, ported bit-exactly: the
 * frozen pose is one specific draw from the stream, so a uniform substitute puts
 * the sparks in the wrong places.
 *
 * Derived from Godot Engine (`core/math/random_pcg.h`,
 * `thirdparty/misc/pcg.cpp`, and `scene/2d/cpu_particles_2d.cpp`). The Godot
 * portions are used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 *   Permission is hereby granted, free of charge, to any person obtaining
 *   a copy of this software and associated documentation files (the
 *   "Software"), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to
 *   the following conditions:
 *
 *   The above copyright notice and this permission notice shall be
 *   included in all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 *   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 *   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 *   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 *   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 *   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * The PCG algorithm itself (`pcg32_random_r` / `pcg32_srandom_r`) originates
 * with pcg-random.org and is Apache-2.0 licensed; Godot vendors it under
 * `thirdparty/misc/`. See THIRD-PARTY-NOTICES.md.
 */

const PCG_MULTIPLIER = 6364136223846793005n;
/** `PCG_DEFAULT_INC_64`, the stream selector `RandomPCG` never changes. */
const PCG_DEFAULT_INC_64 = 1442695040888963407n;
const UINT64_MASK = 0xffffffffffffffffn;

/**
 * Godot's `RandomPCG` over the vendored minimal PCG32 (XSH-RR, 64-bit state,
 * 32-bit output), exposing only what CPUParticles2D uses: `seed` and `randf`.
 * Re-seeded per particle at birth (`cpu_particles_2d.cpp:922`) for everything
 * decided once per particle.
 */
export class GodotRandomPCG {
  private state = 0n;
  /** `pcg.inc`, fixed by `pcg32_srandom_r` to `(DEFAULT_INC << 1) | 1`. */
  private readonly inc = ((PCG_DEFAULT_INC_64 << 1n) | 1n) & UINT64_MASK;

  constructor(seed: number | bigint = 0) {
    this.seed(seed);
  }

  /**
   * `pcg32_srandom_r(&pcg, seed, DEFAULT_INC)`: start from zero state, step once,
   * add the seed, step again. The two warm-up steps stop a small seed (a particle
   * index) from giving neighbouring particles a near-identical first draw.
   */
  seed(seed: number | bigint): void {
    this.state = 0n;
    this.step();
    this.state = (this.state + (BigInt(seed) & UINT64_MASK)) & UINT64_MASK;
    this.step();
  }

  /**
   * `RandomPCG::randf()`, not `rand() / 2^32`: Godot builds the float from two
   * draws, the first giving a binary exponent through its leading-zero count and
   * the second the mantissa. One draw would desynchronise every later value.
   */
  randf(): number {
    const protoExponent = this.step();
    if (protoExponent === 0) return 0;
    const significand = (this.step() | 0x80000001) >>> 0;
    // `std::ldexp((float)significand, -32 - CLZ32(proto))`. The float32 cast is
    // observable: the significand carries 32 bits and a float keeps 24.
    return Math.fround(significand) * 2 ** (-32 - Math.clz32(protoExponent));
  }

  /** `pcg32_random_r`: advance the state, return the XSH-RR output word. */
  private step(): number {
    const old = this.state;
    this.state = (old * PCG_MULTIPLIER + (this.inc | 1n)) & UINT64_MASK;
    const xorshifted = Number((((old >> 18n) ^ old) >> 27n) & 0xffffffffn) >>> 0;
    const rot = Number((old >> 59n) & 31n);
    return ((xorshifted >>> rot) | (xorshifted << ((0 - rot) & 31))) >>> 0;
  }
}

/** A `uint32` seed passed by reference, the way `rand_from_seed` takes it. */
export interface SeedRef {
  value: number;
}

/**
 * `rand_from_seed` (`cpu_particles_2d.cpp:694-707`): a Park–Miller minimal
 * standard generator using Schrage's trick to stay inside 32-bit arithmetic,
 * threaded through the per-frame update (`cpu_particles_2d.cpp:1072-1109`).
 * Advances `state.value` in place and returns the new state scaled to 0..1.
 */
export function randFromSeed(state: SeedRef): number {
  let s = state.value | 0;
  if (s === 0) s = 305420679;
  const k = Math.trunc(s / 127773);
  s = 16807 * (s - k * 127773) - 2836 * k;
  if (s < 0) s += 2147483647;
  state.value = s >>> 0;
  return (state.value % 65536) / 65535.0;
}

/**
 * `idhash` (`cpu_particles_2d.cpp:687-692`): the xor-multiply avalanche that
 * only `randomness_ratio` uses, to jitter a particle's restart phase
 * (`cpu_particles_2d.cpp:860`).
 */
export function idhash(x: number): number {
  let h = x >>> 0;
  h = Math.imul((h >>> 16) ^ h, 0x45d9f3b) >>> 0;
  h = Math.imul((h >>> 16) ^ h, 0x45d9f3b) >>> 0;
  return ((h >>> 16) ^ h) >>> 0;
}
